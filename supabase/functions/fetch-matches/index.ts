import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// API-Football league IDs for popular leagues
const POPULAR_LEAGUE_IDS = [
  61,   // Ligue 1
  39,   // Premier League
  140,  // La Liga
  135,  // Serie A
  78,   // Bundesliga
  2,    // Champions League
  3,    // Europa League
  848,  // Conference League
  253,  // MLS
  307,  // Saudi Pro League
  88,   // Eredivisie
  94,   // Primeira Liga
  40,   // Championship
  203,  // Super Lig
  144,  // Belgian Pro League
  179,  // Scottish Premiership
  13,   // Copa Libertadores
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) {
      throw new Error("RAPIDAPI_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    console.log(`Fetching matches for date: ${dateParam}`);

    // Fetch fixtures from API-Football
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${dateParam}`,
      {
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": "v3.football.api-sports.io",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API-Football error [${response.status}]:`, errorText);
      throw new Error(`API-Football returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error("API-Football errors:", JSON.stringify(data.errors));
      throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
    }

    const fixtures = data.response || [];
    console.log(`Got ${fixtures.length} total fixtures`);

    // Filter to popular leagues only
    const popularFixtures = fixtures.filter((f: any) =>
      POPULAR_LEAGUE_IDS.includes(f.league.id)
    );

    console.log(`${popularFixtures.length} fixtures in popular leagues`);

    // Upsert matches into database
    const matchRows = popularFixtures.map((f: any) => ({
      api_fixture_id: f.fixture.id,
      league_id: f.league.id,
      league_name: f.league.name,
      league_country: f.league.country,
      league_logo: f.league.logo,
      league_flag: f.league.flag,
      league_round: f.league.round,
      home_team_id: f.teams.home.id,
      home_team_name: f.teams.home.name,
      home_team_logo: f.teams.home.logo,
      away_team_id: f.teams.away.id,
      away_team_name: f.teams.away.name,
      away_team_logo: f.teams.away.logo,
      kickoff: f.fixture.date,
      venue_name: f.fixture.venue?.name,
      venue_city: f.fixture.venue?.city,
      status_short: f.fixture.status.short,
      status_long: f.fixture.status.long,
      home_score: f.goals.home,
      away_score: f.goals.away,
      home_score_ht: f.score?.halftime?.home,
      away_score_ht: f.score?.halftime?.away,
      fetched_at: new Date().toISOString(),
    }));

    if (matchRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("matches")
        .upsert(matchRows, { onConflict: "api_fixture_id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw new Error(`Database upsert failed: ${upsertError.message}`);
      }
    }

    // Read back matches for the requested date (with any existing analysis status)
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
