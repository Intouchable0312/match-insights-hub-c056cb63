import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ESPN_LEAGUES = [
  { slug: "fra.1", leagueId: 61, name: "Ligue 1", country: "France", flag: "https://media.api-sports.io/flags/fr.svg" },
  { slug: "eng.1", leagueId: 39, name: "Premier League", country: "England", flag: "https://media.api-sports.io/flags/gb.svg" },
  { slug: "esp.1", leagueId: 140, name: "La Liga", country: "Spain", flag: "https://media.api-sports.io/flags/es.svg" },
  { slug: "ita.1", leagueId: 135, name: "Serie A", country: "Italy", flag: "https://media.api-sports.io/flags/it.svg" },
  { slug: "ger.1", leagueId: 78, name: "Bundesliga", country: "Germany", flag: "https://media.api-sports.io/flags/de.svg" },
  { slug: "uefa.champions", leagueId: 2, name: "Champions League", country: "Europe", flag: null },
  { slug: "uefa.europa", leagueId: 3, name: "Europa League", country: "Europe", flag: null },
  { slug: "por.1", leagueId: 94, name: "Primeira Liga", country: "Portugal", flag: "https://media.api-sports.io/flags/pt.svg" },
  { slug: "ned.1", leagueId: 88, name: "Eredivisie", country: "Netherlands", flag: "https://media.api-sports.io/flags/nl.svg" },
  { slug: "bel.1", leagueId: 144, name: "Jupiler Pro League", country: "Belgium", flag: "https://media.api-sports.io/flags/be.svg" },
  { slug: "tur.1", leagueId: 203, name: "Super Lig", country: "Turkey", flag: "https://media.api-sports.io/flags/tr.svg" },
  { slug: "sco.1", leagueId: 179, name: "Premiership", country: "Scotland", flag: "https://media.api-sports.io/flags/gb-sct.svg" },
  { slug: "usa.1", leagueId: 253, name: "Major League Soccer", country: "USA", flag: "https://media.api-sports.io/flags/us.svg" },
  { slug: "bra.1", leagueId: 71, name: "Brasileirão", country: "Brazil", flag: "https://media.api-sports.io/flags/br.svg" },
  { slug: "eng.2", leagueId: 40, name: "Championship", country: "England", flag: "https://media.api-sports.io/flags/gb.svg" },
  { slug: "fra.2", leagueId: 63, name: "Ligue 2", country: "France", flag: "https://media.api-sports.io/flags/fr.svg" },
];

function mapStatus(competition: any): { short: string; long: string } {
  const type = competition?.status?.type;
  if (!type) return { short: "NS", long: "Not Started" };

  const state = type.state;
  const desc = type.description || "";

  if (state === "post") return { short: "FT", long: "Match Finished" };
  if (state === "pre") return { short: "NS", long: "Not Started" };
  if (state === "in") {
    if (desc === "Halftime") return { short: "HT", long: "Halftime" };
    const period = type.period || 0;
    if (period === 1) return { short: "1H", long: "First Half" };
    if (period === 2) return { short: "2H", long: "Second Half" };
    return { short: "LIVE", long: desc || "In Progress" };
  }
  if (desc?.includes("Postponed")) return { short: "PST", long: "Match Postponed" };
  if (desc?.includes("Cancelled")) return { short: "CANC", long: "Match Cancelled" };
  return { short: "NS", long: desc || "Not Started" };
}

async function fetchESPNLeague(slug: string, date: string, league: any): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const dateFormatted = date.replace(/-/g, "");
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateFormatted}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = await res.json();
    const events = data?.events || [];
    const leagueLogo = data.leagues?.[0]?.logos?.[0]?.href || null;

    return events.map((event: any) => {
      const comp = event.competitions?.[0];
      if (!comp) return null;
      const home = comp.competitors?.find((c: any) => c.homeAway === "home");
      const away = comp.competitors?.find((c: any) => c.homeAway === "away");
      if (!home || !away) return null;

      const status = mapStatus(comp);

      return {
        api_fixture_id: parseInt(event.id) || 0,
        league_id: league.leagueId,
        league_name: league.name,
        league_country: league.country,
        league_logo: leagueLogo,
        league_flag: league.flag,
        league_round: comp.status?.type?.detail || null,
        home_team_id: parseInt(home.id) || 0,
        home_team_name: home.team?.displayName || home.team?.name || "?",
        home_team_logo: home.team?.logo || null,
        away_team_id: parseInt(away.id) || 0,
        away_team_name: away.team?.displayName || away.team?.name || "?",
        away_team_logo: away.team?.logo || null,
        kickoff: event.date,
        venue_name: comp.venue?.fullName || null,
        venue_city: comp.venue?.address?.city || null,
        status_short: status.short,
        status_long: status.long,
        home_score: home.score != null ? parseInt(home.score) : null,
        away_score: away.score != null ? parseInt(away.score) : null,
        home_score_ht: null,
        away_score_ht: null,
        fetched_at: new Date().toISOString(),
      };
    }).filter((m: any) => m && m.api_fixture_id > 0);
  } catch (e) {
    console.warn(`ESPN ${slug} failed:`, e);
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase config");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    console.log(`Fetching matches for ${dateParam} via ESPN (free, unlimited)`);

    const results = await Promise.all(
      ESPN_LEAGUES.map(l => fetchESPNLeague(l.slug, dateParam, l))
    );
    const allMatches = results.flat();
    console.log(`ESPN: ${allMatches.length} matches found`);

    if (allMatches.length > 0) {
      const { error } = await supabase
        .from("matches")
        .upsert(allMatches, { onConflict: "api_fixture_id" });
      if (error) console.error("Upsert error:", error.message);
      else console.log(`Upserted ${allMatches.length} matches`);
    }

    // Read back
    const startOfDay = `${dateParam}T00:00:00Z`;
    const endOfDay = `${dateParam}T23:59:59Z`;
    const { data: matches, error: readError } = await supabase
      .from("matches")
      .select(`*, analyses(id, status, analysis_type, prediction, completed_at, data_quality_score, uncertainty_score)`)
      .gte("kickoff", startOfDay)
      .lte("kickoff", endOfDay)
      .order("kickoff", { ascending: true });

    if (readError) throw new Error(readError.message);
    console.log(`Returning ${matches?.length || 0} matches`);

    return new Response(JSON.stringify({ matches: matches || [], date: dateParam }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
