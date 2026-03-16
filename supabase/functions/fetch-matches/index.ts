import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ESPN league slugs mapped to our internal league IDs + metadata
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

// Map ESPN status to our status format
function mapStatus(espnStatus: any): { short: string; long: string } {
  const type = espnStatus?.type;
  if (!type) return { short: "NS", long: "Not Started" };

  const state = type.state; // "pre", "in", "post"
  const desc = type.description || "";
  const shortDetail = espnStatus.type?.shortDetail || "";
  const detail = espnStatus.displayClock || "";
  const period = type.period || 0;

  if (state === "post") return { short: "FT", long: "Match Finished" };
  if (state === "pre") return { short: "NS", long: "Not Started" };
  
  // In progress
  if (state === "in") {
    if (desc === "Halftime") return { short: "HT", long: "Halftime" };
    if (period === 1) return { short: "1H", long: "First Half" };
    if (period === 2) return { short: "2H", long: "Second Half" };
    return { short: "LIVE", long: shortDetail || "In Progress" };
  }

  // Other statuses
  if (desc?.includes("Postponed")) return { short: "PST", long: "Match Postponed" };
  if (desc?.includes("Cancelled")) return { short: "CANC", long: "Match Cancelled" };
  
  return { short: type.shortDetail?.slice(0, 5) || "NS", long: desc || "Not Started" };
}

async function fetchESPNLeague(slug: string, date: string, league: any): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const dateFormatted = date.replace(/-/g, ""); // YYYYMMDD
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateFormatted}`;
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) {
      console.warn(`ESPN ${slug}: HTTP ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    const events = data?.events || [];
    
    return events.map((event: any) => {
      const competition = event.competitions?.[0];
      if (!competition) return null;
      
      const homeTeam = competition.competitors?.find((c: any) => c.homeAway === "home");
      const awayTeam = competition.competitors?.find((c: any) => c.homeAway === "away");
      if (!homeTeam || !awayTeam) return null;
      
      const status = mapStatus(competition.status);
      const venue = competition.venue;
      const leagueLogo = data.leagues?.[0]?.logos?.[0]?.href || null;
      
      return {
        api_fixture_id: parseInt(event.id) || 0,
        league_id: league.leagueId,
        league_name: league.name,
        league_country: league.country,
        league_logo: leagueLogo,
        league_flag: league.flag,
        league_round: event.season?.slug || null,
        home_team_id: parseInt(homeTeam.id) || 0,
        home_team_name: homeTeam.team?.displayName || homeTeam.team?.name || "?",
        home_team_logo: homeTeam.team?.logo || null,
        away_team_id: parseInt(awayTeam.id) || 0,
        away_team_name: awayTeam.team?.displayName || awayTeam.team?.name || "?",
        away_team_logo: awayTeam.team?.logo || null,
        kickoff: event.date,
        venue_name: venue?.fullName || null,
        venue_city: venue?.address?.city || null,
        status_short: status.short,
        status_long: status.long,
        home_score: homeTeam.score != null ? parseInt(homeTeam.score) : null,
        away_score: awayTeam.score != null ? parseInt(awayTeam.score) : null,
        home_score_ht: null, // ESPN doesn't always provide HT scores in scoreboard
        away_score_ht: null,
        fetched_at: new Date().toISOString(),
      };
    }).filter(Boolean);
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    console.log(`Fetching matches for date: ${dateParam} via ESPN`);

    // Fetch all leagues in parallel from ESPN (FREE, UNLIMITED)
    const results = await Promise.all(
      ESPN_LEAGUES.map(league => fetchESPNLeague(league.slug, dateParam, league))
    );

    const allMatches = results.flat();
    console.log(`ESPN returned ${allMatches.length} total matches`);

    // Also try to update existing API-Football matches with ESPN data
    // by matching team names for today's date
    if (allMatches.length > 0) {
      // First, get existing matches for this date to cross-reference
      const startOfDay = `${dateParam}T00:00:00Z`;
      const endOfDay = `${dateParam}T23:59:59Z`;
      
      const { data: existingMatches } = await supabase
        .from("matches")
        .select("id, api_fixture_id, home_team_name, away_team_name")
        .gte("kickoff", startOfDay)
        .lte("kickoff", endOfDay);

      // For each ESPN match, check if there's an existing match with different api_fixture_id
      // but same teams (from old API-Football data)
      const toUpdate: any[] = [];
      const toInsert: any[] = [];

      for (const espnMatch of allMatches) {
        if (espnMatch.api_fixture_id <= 0) continue;

        const existing = existingMatches?.find(em => {
          const homeMatch = normalize(em.home_team_name) === normalize(espnMatch.home_team_name) ||
                           normalize(em.home_team_name).includes(normalize(espnMatch.home_team_name)) ||
                           normalize(espnMatch.home_team_name).includes(normalize(em.home_team_name));
          const awayMatch = normalize(em.away_team_name) === normalize(espnMatch.away_team_name) ||
                           normalize(em.away_team_name).includes(normalize(espnMatch.away_team_name)) ||
                           normalize(espnMatch.away_team_name).includes(normalize(em.away_team_name));
          return homeMatch && awayMatch;
        });

        if (existing) {
          // Update existing record with fresh ESPN data (scores, status)
          toUpdate.push({
            id: existing.id,
            status_short: espnMatch.status_short,
            status_long: espnMatch.status_long,
            home_score: espnMatch.home_score,
            away_score: espnMatch.away_score,
            fetched_at: espnMatch.fetched_at,
          });
        } else {
          // New match from ESPN, insert it
          toInsert.push(espnMatch);
        }
      }

      // Update existing matches with fresh scores
      for (const update of toUpdate) {
        const { error } = await supabase
          .from("matches")
          .update({
            status_short: update.status_short,
            status_long: update.status_long,
            home_score: update.home_score,
            away_score: update.away_score,
            fetched_at: update.fetched_at,
          })
          .eq("id", update.id);
        if (error) console.warn(`Update error for ${update.id}:`, error.message);
      }

      // Insert new ESPN matches
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("matches")
          .upsert(toInsert, { onConflict: "api_fixture_id" });
        if (insertError) console.warn("Insert error:", insertError.message);
      }

      console.log(`Updated ${toUpdate.length} existing matches, inserted ${toInsert.length} new`);
    }

    // Read back all matches for the date
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

    if (readError) throw new Error(`Database read failed: ${readError.message}`);

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

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/fc |ac |as |rc |sc |ssc |afc |cf |cd |ca |rcd |ud |sd /gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}
