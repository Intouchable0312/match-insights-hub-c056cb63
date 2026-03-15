import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// API-Football league IDs
const LEAGUE_IDS = [
  61,   // Ligue 1
  39,   // Premier League
  140,  // La Liga
  135,  // Serie A
  78,   // Bundesliga
  2,    // Champions League
  3,    // Europa League
  94,   // Primeira Liga
  88,   // Eredivisie
  144,  // Jupiler Pro League
  203,  // Super Lig
  179,  // Scottish Premiership
  253,  // MLS
  71,   // Brazilian Serie A
  40,   // Championship
  63,   // Ligue 2
];

async function fetchFromAPIFootball(date: string, rapidApiKey: string): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const res = await fetch(
      `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${date}`,
      {
        headers: {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (res.status === 429) {
      console.warn("API-Football rate limited");
      return [];
    }
    if (!res.ok) {
      console.warn(`API-Football HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const fixtures = data?.response || [];
    
    // Filter to our tracked leagues only
    return fixtures.filter((f: any) => LEAGUE_IDS.includes(f.league?.id));
  } catch (e) {
    console.error("API-Football fetch failed:", e);
    return [];
  }
}

function mapAPIFootballFixture(f: any) {
  return {
    api_fixture_id: f.fixture.id,
    league_id: f.league.id,
    league_name: f.league.name,
    league_country: f.league.country,
    league_logo: f.league.logo || null,
    league_flag: f.league.flag || null,
    league_round: f.league.round || null,
    home_team_id: f.teams.home.id,
    home_team_name: f.teams.home.name,
    home_team_logo: f.teams.home.logo || null,
    away_team_id: f.teams.away.id,
    away_team_name: f.teams.away.name,
    away_team_logo: f.teams.away.logo || null,
    kickoff: f.fixture.date,
    venue_name: f.fixture.venue?.name || null,
    venue_city: f.fixture.venue?.city || null,
    status_short: f.fixture.status?.short || "NS",
    status_long: f.fixture.status?.long || "Not Started",
    home_score: f.goals?.home ?? null,
    away_score: f.goals?.away ?? null,
    home_score_ht: f.score?.halftime?.home ?? null,
    away_score_ht: f.score?.halftime?.away ?? null,
    fetched_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    console.log(`Fetching matches for date: ${dateParam}`);

    // Try API-Football if key is available
    let matchRows: any[] = [];
    if (RAPIDAPI_KEY) {
      const fixtures = await fetchFromAPIFootball(dateParam, RAPIDAPI_KEY);
      console.log(`API-Football returned ${fixtures.length} fixtures for tracked leagues`);
      matchRows = fixtures.map(mapAPIFootballFixture);
    } else {
      console.warn("No RAPIDAPI_KEY configured, using cached data only");
    }

    // Upsert fresh data
    if (matchRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("matches")
        .upsert(matchRows, { onConflict: "api_fixture_id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      } else {
        console.log(`Upserted ${matchRows.length} matches`);
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
