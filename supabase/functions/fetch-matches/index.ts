import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// TheSportsDB league IDs mapped to our internal league IDs
// We use TheSportsDB idLeague as our league_id now
const LEAGUES = [
  { tsdbId: "4334", name: "Ligue 1", country: "France", leagueId: 4334 },
  { tsdbId: "4328", name: "English Premier League", country: "England", leagueId: 4328 },
  { tsdbId: "4335", name: "Spanish La Liga", country: "Spain", leagueId: 4335 },
  { tsdbId: "4332", name: "Italian Serie A", country: "Italy", leagueId: 4332 },
  { tsdbId: "4331", name: "German Bundesliga", country: "Germany", leagueId: 4331 },
  { tsdbId: "4480", name: "UEFA Champions League", country: "Europe", leagueId: 4480 },
  { tsdbId: "4481", name: "UEFA Europa League", country: "Europe", leagueId: 4481 },
  { tsdbId: "4344", name: "Primeira Liga", country: "Portugal", leagueId: 4344 },
  { tsdbId: "4337", name: "Eredivisie", country: "Netherlands", leagueId: 4337 },
  { tsdbId: "4338", name: "Belgian Pro League", country: "Belgium", leagueId: 4338 },
  { tsdbId: "4346", name: "Super Lig", country: "Turkey", leagueId: 4346 },
  { tsdbId: "4330", name: "Scottish Premiership", country: "Scotland", leagueId: 4330 },
  { tsdbId: "4347", name: "MLS", country: "USA", leagueId: 4347 },
  { tsdbId: "4351", name: "Brazilian Serie A", country: "Brazil", leagueId: 4351 },
  { tsdbId: "4336", name: "English Championship", country: "England", leagueId: 4336 },
  { tsdbId: "4396", name: "Ligue 2", country: "France", leagueId: 4396 },
  { tsdbId: "4339", name: "Liga Portugal 2", country: "Portugal", leagueId: 4339 },
];

async function fetchLeagueEvents(tsdbId: string, date: string, label: string): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${date}&l=${tsdbId}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.events || [];
  } catch {
    console.error(`  ✗ ${label}: fetch failed`);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    console.log(`Fetching matches for date: ${dateParam} via TheSportsDB`);

    // Fetch all leagues in parallel
    const results = await Promise.all(
      LEAGUES.map(league =>
        fetchLeagueEvents(league.tsdbId, dateParam, league.name)
          .then(events => events.map(e => ({ ...e, _league: league })))
      )
    );

    const allEvents = results.flat();
    console.log(`Got ${allEvents.length} total events from TheSportsDB`);

    // Map to our DB schema
    const matchRows = allEvents
      .filter((e: any) => e.strSport === "Soccer" || !e.strSport) // Only soccer
      .map((e: any) => {
        const kickoff = e.strTimestamp || `${e.dateEvent}T${e.strTime || "00:00:00"}+00:00`;
        const statusMap: Record<string, { short: string; long: string }> = {
          "Match Finished": { short: "FT", long: "Match Finished" },
          "Not Started": { short: "NS", long: "Not Started" },
          "Match Postponed": { short: "PST", long: "Match Postponed" },
          "Match Cancelled": { short: "CANC", long: "Match Cancelled" },
        };
        const status = statusMap[e.strStatus] || { short: e.strStatus?.slice(0, 5) || "NS", long: e.strStatus || "Not Started" };

        return {
          api_fixture_id: parseInt(e.idEvent) || 0,
          league_id: e._league.leagueId,
          league_name: e.strLeague || e._league.name,
          league_country: e._league.country,
          league_logo: e.strLeagueBadge || null,
          league_flag: null,
          league_round: e.intRound ? `Round ${e.intRound}` : null,
          home_team_id: parseInt(e.idHomeTeam) || 0,
          home_team_name: e.strHomeTeam || "?",
          home_team_logo: e.strHomeTeamBadge || null,
          away_team_id: parseInt(e.idAwayTeam) || 0,
          away_team_name: e.strAwayTeam || "?",
          away_team_logo: e.strAwayTeamBadge || null,
          kickoff,
          venue_name: e.strVenue || null,
          venue_city: e.strCity || null,
          status_short: status.short,
          status_long: status.long,
          home_score: e.intHomeScore != null ? parseInt(e.intHomeScore) : null,
          away_score: e.intAwayScore != null ? parseInt(e.intAwayScore) : null,
          home_score_ht: e.intHomeScore_HT != null ? parseInt(e.intHomeScore_HT) : null,
          away_score_ht: e.intAwayScore_HT != null ? parseInt(e.intAwayScore_HT) : null,
          fetched_at: new Date().toISOString(),
        };
      })
      .filter((m: any) => m.api_fixture_id > 0);

    console.log(`${matchRows.length} valid match rows to upsert`);

    if (matchRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("matches")
        .upsert(matchRows, { onConflict: "api_fixture_id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw new Error(`Database upsert failed: ${upsertError.message}`);
      }
    }

    // Read back matches for the requested date
    const startOfDay = `${dateParam}T00:00:00Z`;
    const endOfDay = `${dateParam}T23:59:59Z`;

    const { data: matches, error: readError } = await supabase
      .from("matches")
      .select(`
        *,
        analyses (
          id,
          status,
          analysis_type,
          prediction,
          completed_at,
          data_quality_score,
          uncertainty_score
        )
      `)
      .gte("kickoff", startOfDay)
      .lte("kickoff", endOfDay)
      .order("kickoff", { ascending: true });

    if (readError) {
      console.error("Read error:", readError);
      throw new Error(`Database read failed: ${readError.message}`);
    }

    console.log(`Returning ${matches?.length || 0} matches`);

    return new Response(JSON.stringify({ matches: matches || [], date: dateParam }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-matches error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
