import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ====== SAFE FETCH ======
async function safeFetch(url: string, headers: Record<string, string>, label: string, timeoutMs = 10000): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) { const b = await res.text(); console.error(`  ✗ ${label}: ${res.status} ${b.slice(0,150)}`); return null; }
    const data = await res.json();
    const c = Array.isArray(data?.response) ? data.response.length : (data?.response ? 'obj' : 0);
    console.log(`  ✓ ${label}: ${c} results`);
    return data;
  } catch (err) { console.error(`  ✗ ${label}: ${err.message}`); return null; }
}

async function simpleFetch(url: string, label: string, timeoutMs = 8000): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) { await res.text(); console.error(`  ✗ ${label}: ${res.status}`); return null; }
    const data = await res.json();
    console.log(`  ✓ ${label}: OK`);
    return data;
  } catch (err) { console.error(`  ✗ ${label}: ${err.message}`); return null; }
}

// ====== LEAGUE MAPPINGS ======
const LEAGUE_ESPN_MAP: Record<number, string> = {
  61: 'fra.1', 39: 'eng.1', 140: 'esp.1', 135: 'ita.1', 78: 'ger.1',
  2: 'uefa.champions', 3: 'uefa.europa', 848: 'uefa.europa.conf',
  94: 'por.1', 88: 'ned.1', 144: 'bel.1', 203: 'tur.1', 179: 'sco.1',
  63: 'fra.2', 40: 'eng.2', 41: 'eng.3', 42: 'eng.4',
  141: 'esp.2', 79: 'ger.2', 136: 'ita.2',
};

const LEAGUE_THESPORTSDB_MAP: Record<number, string> = {
  61: '4334', 39: '4328', 140: '4335', 135: '4332', 78: '4331',
  2: '4480', 3: '4481', 94: '4344', 88: '4337', 144: '4338',
};

// ====== FREE DATA SOURCES ======

// 1. ESPN Standings (free, no key)
async function fetchESPNStandings(leagueId: number, season: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season}`,
    "ESPN-Standings"
  );
  const entries = data?.children?.[0]?.standings?.entries;
  if (!entries?.length) {
    // Try next year
    const data2 = await simpleFetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season + 1}`,
      "ESPN-Standings-alt"
    );
    const entries2 = data2?.children?.[0]?.standings?.entries;
    if (!entries2?.length) return "";
    return formatESPNStandings(entries2);
  }
  return formatESPNStandings(entries);
}

function formatESPNStandings(entries: any[]): string {
  return entries.slice(0, 20).map((e: any) => {
    const t = e.team;
    const s = e.stats || [];
    const g = (n: string) => s.find((x: any) => x.name === n)?.value ?? '?';
    return `${g('rank')}. ${t.displayName} - ${g('points')}pts | ${g('gamesPlayed')}J ${g('wins')}V ${g('ties')}N ${g('losses')}D | BM:${g('pointsFor')} BE:${g('pointsAgainst')} Diff:${g('pointDifferential')}`;
  }).join("\n");
}

// 2. ESPN Team Recent Results
async function fetchESPNTeamResults(teamName: string, leagueId: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`,
    `ESPN-Scores-${teamName.slice(0,10)}`
  );
  if (!data?.events?.length) return "";
  const keyword = teamName.toLowerCase().split(' ')[0];
  const teamEvents = data.events.filter((e: any) =>
    e.competitions?.[0]?.competitors?.some((c: any) =>
      c.team?.displayName?.toLowerCase().includes(keyword)
    )
  ).slice(0, 10);
  if (!teamEvents.length) return "";
  return teamEvents.map((e: any) => {
    const comp = e.competitions[0];
    const h = comp.competitors.find((c: any) => c.homeAway === 'home');
    const a = comp.competitors.find((c: any) => c.homeAway === 'away');
    const status = e.status?.type?.completed ? 'FT' : e.status?.type?.shortDetail || '?';
    return `  ${h?.team?.abbreviation} ${h?.score ?? '?'}-${a?.score ?? '?'} ${a?.team?.abbreviation} (${status}, ${e.date?.split('T')[0]})`;
  }).join("\n");
}

// 3. ESPN Team Stats & Details
async function fetchESPNTeamStats(teamName: string, leagueId: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  // Search for team in ESPN
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`,
    `ESPN-Teams-${teamName.slice(0,10)}`
  );
  if (!data?.sports?.[0]?.leagues?.[0]?.teams?.length) return "";
  const keyword = teamName.toLowerCase().split(' ')[0];
  const team = data.sports[0].leagues[0].teams.find((t: any) =>
    t.team?.displayName?.toLowerCase().includes(keyword) ||
    t.team?.shortDisplayName?.toLowerCase().includes(keyword)
  );
  if (!team) return "";
  const t = team.team;
  let txt = `${t.displayName}: ${t.location || ''}, ${t.nickname || ''}`;
  if (t.record?.items?.[0]) {
    const rec = t.record.items[0];
    txt += ` | Bilan: ${rec.summary || '?'}`;
    const stats = rec.stats || [];
    const g = (n: string) => stats.find((x: any) => x.name === n)?.value;
    if (g('pointsFor')) txt += ` | BM:${g('pointsFor')} BE:${g('pointsAgainst')}`;
    if (g('streak')) txt += ` | Série: ${g('streak')}`;
  }
  return txt;
}

// 4. TheSportsDB - Team Info Deep
async function fetchTheSportsDBTeam(teamName: string): Promise<{ info: string; id: string }> {
  const data = await simpleFetch(
    `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`,
    `TSDB-Team-${teamName.slice(0,10)}`
  );
  const team = data?.teams?.[0];
  if (!team) return { info: "", id: "" };
  let txt = `${teamName}:
  Fondé: ${team.intFormedYear || '?'} | Stade: ${team.strStadium || '?'} (${team.intStadiumCapacity || '?'} places)
  Pays: ${team.strCountry || '?'} | Ligue: ${team.strLeague || '?'}
  Manager: ${team.strManager || '?'}
  Couleurs: ${team.strTeamJersey || '?'}
  ${team.strKeywords ? `Mots-clés: ${team.strKeywords}` : ''}`;
  // Description courte
  const desc = team.strDescriptionFR || team.strDescriptionEN || '';
  if (desc) txt += `\n  Bio: ${desc.slice(0, 300)}...`;
  return { info: txt, id: team.idTeam || "" };
}

// 5. TheSportsDB - Last 5 & Next 5 Events
async function fetchTheSportsDBEvents(teamId: string, teamName: string): Promise<string> {
  if (!teamId) return "";
  const [lastData, nextData] = await Promise.all([
    simpleFetch(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${teamId}`, `TSDB-Last-${teamName.slice(0,8)}`),
    simpleFetch(`https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${teamId}`, `TSDB-Next-${teamName.slice(0,8)}`),
  ]);
  let txt = "";
  if (lastData?.results?.length) {
    txt += `${teamName} - 5 derniers matchs (TheSportsDB):\n`;
    txt += lastData.results.map((e: any) =>
      `  ${e.strHomeTeam} ${e.intHomeScore ?? '?'}-${e.intAwayScore ?? '?'} ${e.strAwayTeam} (${e.dateEvent}, ${e.strLeague})`
    ).join("\n");
  }
  if (nextData?.events?.length) {
    txt += `\n${teamName} - Prochains matchs:\n`;
    txt += nextData.events.slice(0, 3).map((e: any) =>
      `  ${e.strHomeTeam} vs ${e.strAwayTeam} (${e.dateEvent}, ${e.strLeague})`
    ).join("\n");
  }
  return txt;
}

// 6. TheSportsDB - H2H
async function fetchTheSportsDBH2H(homeTeam: string, awayTeam: string): Promise<string> {
  // Try both orders
  const [d1, d2] = await Promise.all([
    simpleFetch(`https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(homeTeam)}_vs_${encodeURIComponent(awayTeam)}`, "TSDB-H2H"),
    simpleFetch(`https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(awayTeam)}_vs_${encodeURIComponent(homeTeam)}`, "TSDB-H2H-rev"),
  ]);
  const events = [...(d1?.event || []), ...(d2?.event || [])];
  if (!events.length) return "";
  // Deduplicate by event ID
  const seen = new Set();
  const unique = events.filter((e: any) => { if (seen.has(e.idEvent)) return false; seen.add(e.idEvent); return true; });
  unique.sort((a: any, b: any) => (b.dateEvent || '').localeCompare(a.dateEvent || ''));
  return "H2H (TheSportsDB):\n" + unique.slice(0, 10).map((e: any) =>
    `  ${e.strHomeTeam} ${e.intHomeScore ?? '?'}-${e.intAwayScore ?? '?'} ${e.strAwayTeam} (${e.dateEvent}, ${e.strLeague})`
  ).join("\n");
}

// 7. TheSportsDB - League Table
async function fetchTheSportsDBTable(leagueId: number, season: string): Promise<string> {
  const tsdbId = LEAGUE_THESPORTSDB_MAP[leagueId];
  if (!tsdbId) return "";
  const data = await simpleFetch(
    `https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${tsdbId}&s=${season}`,
    "TSDB-Table"
  );
  if (!data?.table?.length) return "";
  return "Classement (TheSportsDB):\n" + data.table.slice(0, 20).map((t: any) =>
    `${t.intRank}. ${t.strTeam} - ${t.intPoints}pts | ${t.intPlayed}J ${t.intWin}V ${t.intDraw}N ${t.intLoss}D | BM:${t.intGoalsFor} BE:${t.intGoalsAgainst} Diff:${t.intGoalDifference}`
  ).join("\n");
}

// 8. Weather at Match Venue (Open-Meteo, 100% free)
async function fetchMatchWeather(city: string, kickoff: string): Promise<string> {
  if (!city) return "";
  // Step 1: Geocode city
  const geoData = await simpleFetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`,
    "Geo-" + city.slice(0, 10)
  );
  const loc = geoData?.results?.[0];
  if (!loc) return "";
  // Step 2: Get weather
  const matchDate = kickoff.split('T')[0];
  const weatherData = await simpleFetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code&timezone=auto&start_date=${matchDate}&end_date=${matchDate}`,
    "Weather"
  );
  if (!weatherData?.hourly) return "";
  // Find closest hour to kickoff
  const kickoffHour = new Date(kickoff).getHours();
  const idx = Math.min(kickoffHour, (weatherData.hourly.time?.length || 1) - 1);
  const temp = weatherData.hourly.temperature_2m?.[idx];
  const precip = weatherData.hourly.precipitation?.[idx];
  const precipProb = weatherData.hourly.precipitation_probability?.[idx];
  const wind = weatherData.hourly.wind_speed_10m?.[idx];
  const code = weatherData.hourly.weather_code?.[idx];
  const weatherDesc: Record<number, string> = {
    0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
    45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine',
    55: 'Bruine forte', 61: 'Pluie légère', 63: 'Pluie modérée', 65: 'Pluie forte',
    71: 'Neige légère', 73: 'Neige', 75: 'Neige forte', 80: 'Averses', 95: 'Orage',
  };
  return `Météo ${city} (${matchDate} ~${kickoffHour}h):
  ${weatherDesc[code] || `Code ${code}`} | ${temp ?? '?'}°C | Vent: ${wind ?? '?'} km/h
  Précipitations: ${precip ?? 0}mm (probabilité: ${precipProb ?? '?'}%)
  ${(wind && wind > 30) ? '⚠️ VENT FORT - peut impacter le jeu aérien' : ''}
  ${(precip && precip > 2) ? '⚠️ PLUIE - terrain potentiellement glissant' : ''}
  ${(temp && temp < 3) ? '⚠️ FROID - risque de terrain gelé' : ''}`;
}

// 9. League Averages from ESPN
async function fetchLeagueStats(leagueId: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`,
    "ESPN-LeagueScores"
  );
  if (!data?.events?.length) return "";
  const completed = data.events.filter((e: any) => e.status?.type?.completed);
  if (completed.length < 5) return "";
  let totalGoals = 0, bttsCount = 0, over25Count = 0, over15Count = 0;
  completed.forEach((e: any) => {
    const comp = e.competitions[0];
    const h = parseInt(comp.competitors.find((c: any) => c.homeAway === 'home')?.score || '0');
    const a = parseInt(comp.competitors.find((c: any) => c.homeAway === 'away')?.score || '0');
    totalGoals += h + a;
    if (h > 0 && a > 0) bttsCount++;
    if (h + a > 2.5) over25Count++;
    if (h + a > 1.5) over15Count++;
  });
  const avg = (totalGoals / completed.length).toFixed(2);
  return `Statistiques ligue (${completed.length} matchs récents):
  Moyenne buts/match: ${avg}
  BTTS: ${Math.round(bttsCount / completed.length * 100)}%
  Over 2.5: ${Math.round(over25Count / completed.length * 100)}%
  Over 1.5: ${Math.round(over15Count / completed.length * 100)}%`;
}

// ====== NORMALIZE AI VALUES ======
function normalizePrediction(prediction: any): any {
  const probFields = [
    'home_win_prob', 'draw_prob', 'away_win_prob',
    'btts_prob', 'over_25_prob', 'over_15_prob', 'under_25_prob',
    'first_to_score_home', 'first_to_score_away', 'first_to_score_none',
    'confidence'
  ];
  const smallCount = probFields.filter(f => Math.abs(prediction[f] ?? 0) <= 1.01).length;
  if (smallCount >= probFields.length * 0.7) {
    console.log("  ⚠️ Normalizing 0-1 → 0-100");
    probFields.forEach(f => { if (prediction[f] != null) prediction[f] = Math.round(prediction[f] * 10000) / 100; });
  }
  prediction.predicted_score_home = Math.round(prediction.predicted_score_home ?? 0);
  prediction.predicted_score_away = Math.round(prediction.predicted_score_away ?? 0);
  probFields.forEach(f => { if (prediction[f] != null) prediction[f] = Math.max(0, Math.min(100, Math.round(prediction[f] * 100) / 100)); });
  const sum = (prediction.home_win_prob || 0) + (prediction.draw_prob || 0) + (prediction.away_win_prob || 0);
  if (sum > 0 && (sum < 90 || sum > 110)) {
    const f = 100 / sum;
    prediction.home_win_prob = Math.round(prediction.home_win_prob * f * 100) / 100;
    prediction.draw_prob = Math.round(prediction.draw_prob * f * 100) / 100;
    prediction.away_win_prob = Math.round(prediction.away_win_prob * f * 100) / 100;
  }
  return prediction;
}

// ====== MAIN ======
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { match_id, analysis_type } = await req.json();
    if (!match_id) return new Response(JSON.stringify({ error: "match_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", match_id).single();
    if (matchError || !match) throw new Error(`Match not found: ${matchError?.message}`);

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🔍 ${match.home_team_name} vs ${match.away_team_name}`);
    console.log(`📋 ${match.league_name} (${match.league_country}) - ${match.league_round || '?'}`);
    console.log(`${'═'.repeat(50)}`);

    const { data: analysisRow, error: insertError } = await supabase
      .from("analyses").insert({ match_id: match.id, status: "generating", analysis_type: analysis_type || "full" }).select().single();
    if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

    const matchDate = new Date(match.kickoff);
    const currentSeason = matchDate.getMonth() >= 7 ? matchDate.getFullYear() : matchDate.getFullYear() - 1;
    const seasonStr = `${currentSeason}-${currentSeason + 1}`;

    // ══════════ PHASE 1: API-Football ══════════
    let h2hData = null, standingsData = null, oddsData = null;
    let injuriesHomeData = null, injuriesAwayData = null;
    let lastHomeData = null, lastAwayData = null;
    let predictionsData = null, homeStatsData = null, awayStatsData = null;

    if (RAPIDAPI_KEY) {
      console.log(`\n📡 PHASE 1: API-Football (saison ${currentSeason})...`);
      const hdr = { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "v3.football.api-sports.io" };
      const B = "https://v3.football.api-sports.io";
      [h2hData, standingsData, oddsData, injuriesHomeData, injuriesAwayData, lastHomeData, lastAwayData, predictionsData, homeStatsData, awayStatsData] = await Promise.all([
        safeFetch(`${B}/fixtures/headtohead?h2h=${match.home_team_id}-${match.away_team_id}&last=10`, hdr, "H2H"),
        safeFetch(`${B}/standings?league=${match.league_id}&season=${currentSeason}`, hdr, "Standings"),
        safeFetch(`${B}/odds?fixture=${match.api_fixture_id}`, hdr, "Odds"),
        safeFetch(`${B}/injuries?league=${match.league_id}&season=${currentSeason}&team=${match.home_team_id}`, hdr, "Inj-Home"),
        safeFetch(`${B}/injuries?league=${match.league_id}&season=${currentSeason}&team=${match.away_team_id}`, hdr, "Inj-Away"),
        safeFetch(`${B}/fixtures?team=${match.home_team_id}&season=${currentSeason}&last=10`, hdr, "Last-Home"),
        safeFetch(`${B}/fixtures?team=${match.away_team_id}&season=${currentSeason}&last=10`, hdr, "Last-Away"),
        safeFetch(`${B}/predictions?fixture=${match.api_fixture_id}`, hdr, "Predictions"),
        safeFetch(`${B}/teams/statistics?team=${match.home_team_id}&league=${match.league_id}&season=${currentSeason}`, hdr, "Stats-Home"),
        safeFetch(`${B}/teams/statistics?team=${match.away_team_id}&league=${match.league_id}&season=${currentSeason}`, hdr, "Stats-Away"),
      ]);
    }

    // ══════════ PHASE 2: FREE SCRAPING (parallel) ══════════
    console.log(`\n🆓 PHASE 2: Free scraping...`);

    const [
      espnStandings,
      homeTeamTSDB, awayTeamTSDB,
      tsdbH2H, tsdbTable,
      weatherTxt, leagueStatsTxt,
      espnHomeStats, espnAwayStats,
      espnHomeResults, espnAwayResults,
    ] = await Promise.all([
      // ESPN standings (fallback)
      !standingsData?.response?.[0]?.league?.standings ? fetchESPNStandings(match.league_id, currentSeason) : Promise.resolve(""),
      // TheSportsDB team info
      fetchTheSportsDBTeam(match.home_team_name),
      fetchTheSportsDBTeam(match.away_team_name),
      // TheSportsDB H2H (fallback)
      !h2hData?.response?.length ? fetchTheSportsDBH2H(match.home_team_name, match.away_team_name) : Promise.resolve(""),
      // TheSportsDB league table (extra source)
      fetchTheSportsDBTable(match.league_id, seasonStr),
      // Weather
      fetchMatchWeather(match.venue_city || match.league_country, match.kickoff),
      // League averages
      fetchLeagueStats(match.league_id),
      // ESPN team details
      fetchESPNTeamStats(match.home_team_name, match.league_id),
      fetchESPNTeamStats(match.away_team_name, match.league_id),
      // ESPN recent results (fallback)
      !lastHomeData?.response?.length ? fetchESPNTeamResults(match.home_team_name, match.league_id) : Promise.resolve(""),
      !lastAwayData?.response?.length ? fetchESPNTeamResults(match.away_team_name, match.league_id) : Promise.resolve(""),
    ]);

    // TheSportsDB last/next events
    const [homeEventsTxt, awayEventsTxt] = await Promise.all([
      fetchTheSportsDBEvents(homeTeamTSDB.id, match.home_team_name),
      fetchTheSportsDBEvents(awayTeamTSDB.id, match.away_team_name),
    ]);

    // ══════════ FORMAT ALL DATA ══════════
    console.log(`\n📝 Formatting data...`);

    // Standings
    let standingsTxt = "";
    if (standingsData?.response?.[0]?.league?.standings) {
      const all = standingsData.response[0].league.standings;
      const flat = Array.isArray(all[0]) ? all.flat() : all;
      const fmt = (t: any, n: string) => t
        ? `${n}: ${t.rank}e/${flat.length} - ${t.points}pts | ${t.all.played}J ${t.all.win}V ${t.all.draw}N ${t.all.lose}D | BM:${t.all.goals.for} BE:${t.all.goals.against} Diff:${t.goalsDiff}\n  Dom: ${t.home.win}V ${t.home.draw}N ${t.home.lose}D | Ext: ${t.away.win}V ${t.away.draw}N ${t.away.lose}D | Forme: ${t.form || '?'}`
        : `${n}: Non classé`;
      standingsTxt = `${fmt(flat.find((s: any) => s.team.id === match.home_team_id), match.home_team_name)}\n${fmt(flat.find((s: any) => s.team.id === match.away_team_id), match.away_team_name)}`;
    } else if (espnStandings) {
      standingsTxt = espnStandings;
    }
    if (tsdbTable) standingsTxt += `\n\n${tsdbTable}`;
    if (!standingsTxt) standingsTxt = "Classement non disponible";

    // Recent form
    let recentFormTxt = "";
    const fmtForm = (data: any, teamId: number, teamName: string) => {
      const fix = data.response.slice(0, 15);
      let streak = { type: '', count: 0 }, cs = 0, fts = 0, gf = 0, ga = 0;
      const res = fix.map((f: any, i: number) => {
        const isH = f.teams.home.id === teamId;
        const g1 = isH ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
        const g2 = isH ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
        const r = g1 > g2 ? 'V' : g1 < g2 ? 'D' : 'N';
        gf += g1; ga += g2; if (g2 === 0) cs++; if (g1 === 0) fts++;
        if (i === 0) streak = { type: r, count: 1 }; else if (r === streak.type && streak.count === i) streak.count++;
        return `  ${r} ${g1}-${g2} vs ${isH ? f.teams.away.name : f.teams.home.name} (${isH ? 'Dom' : 'Ext'}, ${f.fixture.date?.split("T")[0]})`;
      });
      const w = res.filter((r: string) => r.trim().startsWith('V')).length;
      const d = res.filter((r: string) => r.trim().startsWith('N')).length;
      const l = res.filter((r: string) => r.trim().startsWith('D')).length;
      return `${teamName} — ${fix.length} derniers: ${w}V ${d}N ${l}D\n  🔥 Série: ${streak.count} ${streak.type === 'V' ? 'victoires' : streak.type === 'D' ? 'défaites' : 'nuls'}\n  Moy: ${(gf/fix.length).toFixed(1)} BM / ${(ga/fix.length).toFixed(1)} BE | CS: ${cs} | Muet: ${fts}\n${res.join("\n")}`;
    };
    if (lastHomeData?.response?.length && lastAwayData?.response?.length) {
      recentFormTxt = `${fmtForm(lastHomeData, match.home_team_id, match.home_team_name)}\n\n${fmtForm(lastAwayData, match.away_team_id, match.away_team_name)}`;
    } else {
      if (espnHomeResults) recentFormTxt += `${match.home_team_name} (ESPN):\n${espnHomeResults}`;
      if (espnAwayResults) recentFormTxt += `\n${match.away_team_name} (ESPN):\n${espnAwayResults}`;
    }
    if (homeEventsTxt) recentFormTxt += `\n\n${homeEventsTxt}`;
    if (awayEventsTxt) recentFormTxt += `\n\n${awayEventsTxt}`;
    if (!recentFormTxt) recentFormTxt = "Forme récente non disponible";

    // H2H
    let h2hTxt = "";
    if (h2hData?.response?.length) {
      let hw = 0, dr = 0, aw = 0;
      h2hTxt = h2hData.response.map((f: any) => {
        const hg = f.goals.home ?? 0, ag = f.goals.away ?? 0;
        if (f.teams.home.id === match.home_team_id) { if (hg > ag) hw++; else if (hg === ag) dr++; else aw++; }
        else { if (ag > hg) hw++; else if (hg === ag) dr++; else aw++; }
        return `  ${f.teams.home.name} ${hg}-${ag} ${f.teams.away.name} (${f.fixture.date?.split("T")[0]})`;
      }).join("\n");
      h2hTxt = `Bilan: ${hw}V ${dr}N ${aw}D pour ${match.home_team_name}\n${h2hTxt}`;
    } else if (tsdbH2H) { h2hTxt = tsdbH2H; }
    if (!h2hTxt) h2hTxt = "H2H non disponible";

    // Injuries
    const fmtInj = (d: any, n: string) => !d?.response?.length ? `${n}: Aucune blessure connue` :
      `${n} (${d.response.length}):\n` + d.response.slice(0, 15).map((i: any) => `  - ${i.player?.name || '?'}: ${i.player?.reason || '?'} (${i.player?.type || '?'})`).join("\n");
    const injuriesTxt = `${fmtInj(injuriesHomeData, match.home_team_name)}\n${fmtInj(injuriesAwayData, match.away_team_name)}`;

    // Odds
    const oddsTxt = (() => {
      const bk = oddsData?.response?.[0]?.bookmakers;
      if (!bk?.length) return "Cotes non disponibles";
      return bk.slice(0, 3).map((b: any) => {
        const mw = b.bets?.find((x: any) => x.name === "Match Winner");
        const bt = b.bets?.find((x: any) => x.name === "Both Teams Score");
        const ou = b.bets?.find((x: any) => x.name === "Goals Over/Under");
        const dc = b.bets?.find((x: any) => x.name === "Double Chance");
        let l = `${b.name}: `;
        if (mw) l += `1X2: ${mw.values.map((v: any) => `${v.value}=${v.odd}`).join("|")}`;
        if (bt) l += ` BTTS: ${bt.values.map((v: any) => `${v.value}=${v.odd}`).join("/")}`;
        if (ou) l += ` O/U: ${ou.values.map((v: any) => `${v.value}=${v.odd}`).join("/")}`;
        if (dc) l += ` DC: ${dc.values.map((v: any) => `${v.value}=${v.odd}`).join("/")}`;
        return l;
      }).join("\n");
    })();

    // Predictions
    const predTxt = (() => {
      const p = predictionsData?.response?.[0];
      if (!p) return "Non disponible";
      const pr = p.predictions, c = p.comparison;
      let t = `Conseil: ${pr?.advice || '?'} | Vainqueur: ${pr?.winner?.name || '?'} (${pr?.winner?.comment || ''}) | Score: ${pr?.goals?.home ?? '?'}-${pr?.goals?.away ?? '?'}`;
      if (c) t += `\nForme ${c.form?.home}%-${c.form?.away}% | Att ${c.att?.home}%-${c.att?.away}% | Déf ${c.def?.home}%-${c.def?.away}% | Total ${c.total?.home}%-${c.total?.away}%`;
      return t;
    })();

    // Team stats
    const fmtStats = (d: any, n: string) => {
      const r = d?.response; if (!r) return `${n}: Non dispo`;
      const g = r.goals, f = r.fixtures;
      let t = `${n}: ${f?.played?.total ?? '?'}J ${f?.wins?.total ?? '?'}V ${f?.draws?.total ?? '?'}N ${f?.loses?.total ?? '?'}D | BM:${g?.for?.total?.total ?? '?'} (${g?.for?.average?.total ?? '?'}/m) BE:${g?.against?.total?.total ?? '?'} (${g?.against?.average?.total ?? '?'}/m)`;
      if (r.lineups?.length) t += ` | Formation: ${r.lineups[0].formation}`;
      if (r.clean_sheet) t += ` | CS:${r.clean_sheet.total}`;
      if (r.biggest?.streak) t += ` | MaxV:${r.biggest.streak.wins} MaxD:${r.biggest.streak.loses}`;
      return t;
    };
    const statsTxt = `${fmtStats(homeStatsData, match.home_team_name)}\n${fmtStats(awayStatsData, match.away_team_name)}`;

    // Team info
    const teamInfoTxt = [homeTeamTSDB.info, awayTeamTSDB.info, espnHomeStats, espnAwayStats].filter(Boolean).join("\n\n") || "Non disponible";

    // Count sources
    let srcCount = 1; const srcs: string[] = ["match"];
    const addSrc = (ok: boolean, n: string) => { if (ok) { srcCount++; srcs.push(n); } };
    addSrc(!standingsTxt.includes("non disponible"), "standings");
    addSrc(!!recentFormTxt && !recentFormTxt.includes("non disponible"), "form");
    addSrc(!h2hTxt.includes("non disponible"), "h2h");
    addSrc(!!(injuriesHomeData?.response?.length || injuriesAwayData?.response?.length), "injuries");
    addSrc(!!oddsData?.response?.length, "odds");
    addSrc(!!predictionsData?.response?.length, "predictions");
    addSrc(!!(homeStatsData?.response || awayStatsData?.response), "team_stats");
    addSrc(!!(homeTeamTSDB.info || awayTeamTSDB.info), "team_info");
    addSrc(!!weatherTxt, "weather");
    addSrc(!!leagueStatsTxt, "league_avg");
    addSrc(!!(homeEventsTxt || awayEventsTxt), "calendar");
    addSrc(!!(espnHomeStats || espnAwayStats), "espn_stats");

    console.log(`\n📊 Sources: ${srcCount} [${srcs.join(", ")}]`);

    // ══════════ AI PROMPT ══════════
    const systemPrompt = `Tu es un analyste football d'élite. Données RÉELLES saison ${currentSeason}/${currentSeason + 1}.

RÈGLES:
1. N'invente JAMAIS de données
2. Probabilités en 0-100 (65 = 65%, PAS 0.65). home_win + draw + away_win = 100
3. Pondération: Forme 25%, Stats 20%, Blessures 20%, Classement 15%, H2H 10%, Météo/Dom 5%, Cotes 5%
4. Séries victoires/défaites = facteur MAJEUR
5. Paris: recommande UNIQUEMENT probabilité > 55%, justifie avec données
6. Prends en compte la météo si disponible (pluie → moins de buts, vent → jeu perturbé)
7. Prends en compte le calendrier (congestion de matchs = fatigue)
8. Français`;

    const userPrompt = `ANALYSE ULTRA-COMPLÈTE — ${match.home_team_name} vs ${match.away_team_name}
${match.league_name} (${match.league_country}) — ${match.league_round || '?'}
📅 ${match.kickoff} | 🏟 ${match.venue_name || '?'}, ${match.venue_city || ''}

══ CLASSEMENT SAISON ${currentSeason}/${currentSeason + 1} ══
${standingsTxt}

══ STATISTIQUES SAISON ══
${statsTxt}

══ FORME RÉCENTE & SÉRIES ══
${recentFormTxt}

══ CONFRONTATIONS DIRECTES ══
${h2hTxt}

══ BLESSURES & SUSPENSIONS ══
${injuriesTxt}

══ COTES BOOKMAKERS ══
${oddsTxt}

══ PRÉDICTIONS API-FOOTBALL ══
${predTxt}

══ MÉTÉO AU STADE ══
${weatherTxt || "Non disponible"}

══ MOYENNES DE LA LIGUE ══
${leagueStatsTxt || "Non disponible"}

══ INFOS ÉQUIPES (stade, coach, histoire) ══
${teamInfoTxt}

📡 ${srcCount} sources: [${srcs.join(", ")}]

⚠️ RAPPEL: Probabilités en 0-100. home+draw+away=100. Analyse TOUT et fournis les paris les plus sécurisés.`;

    console.log("🤖 Calling AI...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "submit_match_analysis",
            description: "Analyse complète. Probabilités 0-100.",
            parameters: {
              type: "object",
              properties: {
                prediction: {
                  type: "object",
                  properties: {
                    home_win_prob: { type: "number", description: "0-100" },
                    draw_prob: { type: "number", description: "0-100" },
                    away_win_prob: { type: "number", description: "0-100" },
                    predicted_score_home: { type: "number" },
                    predicted_score_away: { type: "number" },
                    expected_goals: { type: "number" },
                    btts_prob: { type: "number", description: "0-100" },
                    over_25_prob: { type: "number", description: "0-100" },
                    over_15_prob: { type: "number", description: "0-100" },
                    under_25_prob: { type: "number", description: "0-100" },
                    first_to_score_home: { type: "number", description: "0-100" },
                    first_to_score_away: { type: "number", description: "0-100" },
                    first_to_score_none: { type: "number", description: "0-100" },
                    confidence: { type: "number", description: "0-100" },
                  },
                  required: ["home_win_prob","draw_prob","away_win_prob","predicted_score_home","predicted_score_away","expected_goals","btts_prob","over_25_prob","over_15_prob","under_25_prob","first_to_score_home","first_to_score_away","first_to_score_none","confidence"],
                  additionalProperties: false,
                },
                report: {
                  type: "object",
                  properties: {
                    summary: { type: "string" },
                    key_factors: { type: "array", items: { type: "object", properties: { name:{type:"string"}, impact:{type:"string",enum:["high","medium","low"]}, direction:{type:"string",enum:["home","away","neutral"]}, description:{type:"string"} }, required:["name","impact","direction","description"], additionalProperties:false } },
                    suggested_bets: { type: "array", items: { type: "object", properties: { bet_type:{type:"string"}, selection:{type:"string"}, probability:{type:"number"}, confidence:{type:"string",enum:["very_high","high","medium"]}, reasoning:{type:"string"} }, required:["bet_type","selection","probability","confidence","reasoning"], additionalProperties:false } },
                    missing_variables: { type: "array", items: { type: "string" } },
                    data_quality_assessment: { type: "string" },
                  },
                  required: ["summary","key_factors","suggested_bets","missing_variables","data_quality_assessment"],
                  additionalProperties: false,
                },
              },
              required: ["prediction","report"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_match_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const s = aiResponse.status;
      const msg = s === 429 ? "Rate limit" : s === 402 ? "Payment required" : `AI error ${s}`;
      await supabase.from("analyses").update({ status: "error", error_message: msg }).eq("id", analysisRow.id);
      if (s === 429 || s === 402) return new Response(JSON.stringify({ error: msg }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(msg);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) { await supabase.from("analyses").update({ status: "error", error_message: "No response" }).eq("id", analysisRow.id); throw new Error("No AI response"); }

    let result;
    try { result = JSON.parse(toolCall.function.arguments); } catch {
      await supabase.from("analyses").update({ status: "error", error_message: "Parse error" }).eq("id", analysisRow.id);
      throw new Error("Parse error");
    }

    result.prediction = normalizePrediction(result.prediction);
    const quality = Math.min(100, Math.round((srcCount / 12) * 100));
    const uncertainty = Math.round(Math.max(0, 100 - (result.prediction?.confidence ?? 50)));

    console.log(`✅ ${result.prediction.home_win_prob}%/${result.prediction.draw_prob}%/${result.prediction.away_win_prob}% | ${result.report?.suggested_bets?.length || 0} paris | ${srcCount} sources`);

    const { error: updateError } = await supabase.from("analyses").update({
      status: "completed", prediction: result.prediction, report: result.report,
      raw_response: JSON.stringify(aiData), model_version: "gemini-2.5-flash",
      data_quality_score: quality, uncertainty_score: uncertainty, source_count: srcCount,
      completed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 6 * 3600000).toISOString(),
    }).eq("id", analysisRow.id);
    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    const { data: final } = await supabase.from("analyses").select("*").eq("id", analysisRow.id).single();
    return new Response(JSON.stringify({ analysis: final }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
