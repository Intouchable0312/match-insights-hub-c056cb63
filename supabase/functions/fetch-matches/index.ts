import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ESPN league slugs mapped to our internal league IDs + metadata
const ESPN_LEAGUES = [
  // 🇩🇪 Germany
  { slug: "ger.1", leagueId: 78, name: "Bundesliga", country: "Germany", flag: "https://media.api-sports.io/flags/de.svg" },
  { slug: "ger.2", leagueId: 79, name: "Bundesliga 2", country: "Germany", flag: "https://media.api-sports.io/flags/de.svg" },
  { slug: "ger.dfb_pokal", leagueId: 81, name: "DFB Pokal", country: "Germany", flag: "https://media.api-sports.io/flags/de.svg" },
  // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England
  { slug: "eng.1", leagueId: 39, name: "Premier League", country: "England", flag: "https://media.api-sports.io/flags/gb.svg" },
  { slug: "eng.2", leagueId: 40, name: "Championship", country: "England", flag: "https://media.api-sports.io/flags/gb.svg" },
  { slug: "eng.league_cup", leagueId: 46, name: "EFL Cup", country: "England", flag: "https://media.api-sports.io/flags/gb.svg" },
  { slug: "eng.fa", leagueId: 45, name: "FA Cup", country: "England", flag: "https://media.api-sports.io/flags/gb.svg" },
  // 🇦🇷 Argentina
  { slug: "arg.1", leagueId: 128, name: "Primera División", country: "Argentina", flag: "https://media.api-sports.io/flags/ar.svg" },
  // 🇦🇺 Australia
  { slug: "aus.1", leagueId: 188, name: "A-League", country: "Australia", flag: "https://media.api-sports.io/flags/au.svg" },
  // 🇦🇹 Austria
  { slug: "aut.1", leagueId: 218, name: "Bundesliga", country: "Austria", flag: "https://media.api-sports.io/flags/at.svg" },
  // 🇦🇿 Azerbaijan
  { slug: "aze.1", leagueId: 370, name: "Premyer Liqası", country: "Azerbaijan", flag: "https://media.api-sports.io/flags/az.svg" },
  // 🇧🇪 Belgium
  { slug: "bel.1", leagueId: 144, name: "Jupiler Pro League", country: "Belgium", flag: "https://media.api-sports.io/flags/be.svg" },
  { slug: "bel.cup", leagueId: 147, name: "Coupe de Belgique", country: "Belgium", flag: "https://media.api-sports.io/flags/be.svg" },
  // 🇧🇦 Bosnia
  { slug: "bih.1", leagueId: 225, name: "Premijer Liga", country: "Bosnia", flag: "https://media.api-sports.io/flags/ba.svg" },
  // 🇧🇷 Brazil
  { slug: "bra.1", leagueId: 71, name: "Série A", country: "Brazil", flag: "https://media.api-sports.io/flags/br.svg" },
  // 🇧🇬 Bulgaria
  { slug: "bul.1", leagueId: 172, name: "First League", country: "Bulgaria", flag: "https://media.api-sports.io/flags/bg.svg" },
  // 🇨🇱 Chile
  { slug: "chi.1", leagueId: 265, name: "Primera División", country: "Chile", flag: "https://media.api-sports.io/flags/cl.svg" },
  // 🇨🇳 China
  { slug: "chn.1", leagueId: 169, name: "Super League", country: "China", flag: "https://media.api-sports.io/flags/cn.svg" },
  // 🇨🇾 Cyprus
  { slug: "cyp.1", leagueId: 318, name: "Division 1", country: "Cyprus", flag: "https://media.api-sports.io/flags/cy.svg" },
  // 🇨🇴 Colombia
  { slug: "col.1", leagueId: 239, name: "Primera A", country: "Colombia", flag: "https://media.api-sports.io/flags/co.svg" },
  // 🇰🇷 South Korea
  { slug: "kor.1", leagueId: 292, name: "K-League 1", country: "South Korea", flag: "https://media.api-sports.io/flags/kr.svg" },
  // 🇭🇷 Croatia
  { slug: "cro.1", leagueId: 210, name: "HNL", country: "Croatia", flag: "https://media.api-sports.io/flags/hr.svg" },
  // 🇩🇰 Denmark
  { slug: "den.1", leagueId: 120, name: "Superliga", country: "Denmark", flag: "https://media.api-sports.io/flags/dk.svg" },
  // 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland
  { slug: "sco.1", leagueId: 179, name: "Premiership", country: "Scotland", flag: "https://media.api-sports.io/flags/gb-sct.svg" },
  { slug: "sco.fa", leagueId: 180, name: "FA Cup", country: "Scotland", flag: "https://media.api-sports.io/flags/gb-sct.svg" },
  // 🇪🇨 Ecuador
  { slug: "ecu.1", leagueId: 242, name: "Serie A", country: "Ecuador", flag: "https://media.api-sports.io/flags/ec.svg" },
  // 🇪🇸 Spain
  { slug: "esp.1", leagueId: 140, name: "La Liga", country: "Spain", flag: "https://media.api-sports.io/flags/es.svg" },
  { slug: "esp.2", leagueId: 141, name: "Liga Segunda", country: "Spain", flag: "https://media.api-sports.io/flags/es.svg" },
  { slug: "esp.copa_del_rey", leagueId: 143, name: "Copa del Rey", country: "Spain", flag: "https://media.api-sports.io/flags/es.svg" },
  // 🇪🇪 Estonia
  { slug: "est.1", leagueId: 329, name: "Meistriliiga", country: "Estonia", flag: "https://media.api-sports.io/flags/ee.svg" },
  // 🇺🇸 USA
  { slug: "usa.1", leagueId: 253, name: "MLS", country: "USA", flag: "https://media.api-sports.io/flags/us.svg" },
  // 🇪🇺 UEFA
  { slug: "uefa.champions", leagueId: 2, name: "Ligue des Champions", country: "Europe", flag: null },
  { slug: "uefa.europa", leagueId: 3, name: "Ligue Europa", country: "Europe", flag: null },
  { slug: "uefa.europa.conf", leagueId: 848, name: "Ligue Conférence", country: "Europe", flag: null },
  { slug: "uefa.champions.women", leagueId: 309, name: "Ligue des Champions F", country: "Europe", flag: null },
  // 🇫🇮 Finland
  { slug: "fin.1", leagueId: 244, name: "Veikkausliiga", country: "Finland", flag: "https://media.api-sports.io/flags/fi.svg" },
  // 🇫🇷 France
  { slug: "fra.1", leagueId: 61, name: "Ligue 1", country: "France", flag: "https://media.api-sports.io/flags/fr.svg" },
  { slug: "fra.2", leagueId: 63, name: "Ligue 2", country: "France", flag: "https://media.api-sports.io/flags/fr.svg" },
  { slug: "fra.coupe_de_france", leagueId: 66, name: "Coupe de France", country: "France", flag: "https://media.api-sports.io/flags/fr.svg" },
  // 🇬🇪 Georgia
  { slug: "geo.1", leagueId: 327, name: "Erovnuli Liga", country: "Georgia", flag: "https://media.api-sports.io/flags/ge.svg" },
  // 🇬🇷 Greece
  { slug: "gre.1", leagueId: 197, name: "Super League", country: "Greece", flag: "https://media.api-sports.io/flags/gr.svg" },
  // 🇭🇺 Hungary
  { slug: "hun.1", leagueId: 271, name: "NB I", country: "Hungary", flag: "https://media.api-sports.io/flags/hu.svg" },
  // 🌍 International / Continental
  { slug: "caf.champions", leagueId: 12, name: "CAF Champions League", country: "Africa", flag: null },
  { slug: "conmebol.libertadores", leagueId: 13, name: "Copa Libertadores", country: "South America", flag: null },
  { slug: "conmebol.sudamericana", leagueId: 11, name: "Copa Sudamericana", country: "South America", flag: null },
  { slug: "concacaf.champions", leagueId: 16, name: "CONCACAF Champions Cup", country: "North America", flag: null },
  { slug: "fifa.world", leagueId: 1, name: "Coupe du Monde 2026", country: "World", flag: null },
  { slug: "fifa.worldq.uefa", leagueId: 32, name: "Qualif. Europe CDM", country: "Europe", flag: null },
  // 🇬🇧 Northern Ireland
  { slug: "nir.1", leagueId: 408, name: "Premiership", country: "N. Ireland", flag: "https://media.api-sports.io/flags/gb-nir.svg" },
  // 🇮🇹 Italy
  { slug: "ita.1", leagueId: 135, name: "Serie A", country: "Italy", flag: "https://media.api-sports.io/flags/it.svg" },
  { slug: "ita.2", leagueId: 136, name: "Serie B", country: "Italy", flag: "https://media.api-sports.io/flags/it.svg" },
  { slug: "ita.coppa_italia", leagueId: 137, name: "Coppa Italia", country: "Italy", flag: "https://media.api-sports.io/flags/it.svg" },
  // 🇯🇵 Japan
  { slug: "jpn.1", leagueId: 98, name: "J-League", country: "Japan", flag: "https://media.api-sports.io/flags/jp.svg" },
  // 🇱🇻 Latvia
  { slug: "lat.1", leagueId: 365, name: "Virsliga", country: "Latvia", flag: "https://media.api-sports.io/flags/lv.svg" },
  // 🇱🇹 Lithuania
  { slug: "ltu.1", leagueId: 362, name: "A Lyga", country: "Lithuania", flag: "https://media.api-sports.io/flags/lt.svg" },
  // 🇱🇺 Luxembourg
  { slug: "lux.1", leagueId: 374, name: "Division Nationale", country: "Luxembourg", flag: "https://media.api-sports.io/flags/lu.svg" },
  // 🇲🇹 Malta
  { slug: "mlt.1", leagueId: 393, name: "Premier League", country: "Malta", flag: "https://media.api-sports.io/flags/mt.svg" },
  // 🇲🇽 Mexico
  { slug: "mex.1", leagueId: 262, name: "Liga MX", country: "Mexico", flag: "https://media.api-sports.io/flags/mx.svg" },
  // 🇳🇴 Norway
  { slug: "nor.1", leagueId: 103, name: "Eliteserien", country: "Norway", flag: "https://media.api-sports.io/flags/no.svg" },
  // 🇵🇾 Paraguay
  { slug: "par.1", leagueId: 249, name: "Primera División", country: "Paraguay", flag: "https://media.api-sports.io/flags/py.svg" },
  // 🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales
  { slug: "wal.1", leagueId: 110, name: "Premier League", country: "Wales", flag: "https://media.api-sports.io/flags/gb-wls.svg" },
  // 🇳🇱 Netherlands
  { slug: "ned.1", leagueId: 88, name: "Eredivisie", country: "Netherlands", flag: "https://media.api-sports.io/flags/nl.svg" },
  // 🇵🇱 Poland
  { slug: "pol.1", leagueId: 106, name: "Ekstraklasa", country: "Poland", flag: "https://media.api-sports.io/flags/pl.svg" },
  // 🇵🇹 Portugal
  { slug: "por.1", leagueId: 94, name: "Liga Portugal", country: "Portugal", flag: "https://media.api-sports.io/flags/pt.svg" },
  { slug: "por.2", leagueId: 95, name: "Segunda Liga", country: "Portugal", flag: "https://media.api-sports.io/flags/pt.svg" },
  // 🇮🇪 Ireland
  { slug: "irl.1", leagueId: 353, name: "Premier Division", country: "Ireland", flag: "https://media.api-sports.io/flags/ie.svg" },
  // 🇨🇿 Czech Republic
  { slug: "cze.1", leagueId: 345, name: "First League", country: "Czech Republic", flag: "https://media.api-sports.io/flags/cz.svg" },
  // 🇷🇴 Romania
  { slug: "rou.1", leagueId: 283, name: "Liga I", country: "Romania", flag: "https://media.api-sports.io/flags/ro.svg" },
  // 🇷🇸 Serbia
  { slug: "srb.1", leagueId: 286, name: "Super Liga", country: "Serbia", flag: "https://media.api-sports.io/flags/rs.svg" },
  // 🇸🇰 Slovakia
  { slug: "svk.1", leagueId: 332, name: "Super Liga", country: "Slovakia", flag: "https://media.api-sports.io/flags/sk.svg" },
  // 🇸🇮 Slovenia
  { slug: "svn.1", leagueId: 373, name: "PrvaLiga", country: "Slovenia", flag: "https://media.api-sports.io/flags/si.svg" },
  // 🇸🇪 Sweden
  { slug: "swe.1", leagueId: 113, name: "Allsvenskan", country: "Sweden", flag: "https://media.api-sports.io/flags/se.svg" },
  // 🇨🇭 Switzerland
  { slug: "sui.1", leagueId: 207, name: "Super League", country: "Switzerland", flag: "https://media.api-sports.io/flags/ch.svg" },
  // 🇹🇷 Turkey
  { slug: "tur.1", leagueId: 203, name: "Süper Lig", country: "Turkey", flag: "https://media.api-sports.io/flags/tr.svg" },
  // 🇺🇦 Ukraine
  { slug: "ukr.1", leagueId: 333, name: "Premier League", country: "Ukraine", flag: "https://media.api-sports.io/flags/ua.svg" },
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
