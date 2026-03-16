import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ====== SAFE FETCH ======
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

// ====== SEARXNG WEB SEARCH (FREE, UNLIMITED) ======
const SEARXNG_INSTANCES = [
  "https://search.sapti.me",
  "https://searx.be",
  "https://search.bus-hit.me",
  "https://searx.tiekoetter.com",
  "https://search.ononoki.org",
];

interface SearchResult {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  engine?: string;
}

async function webSearch(query: string, label: string): Promise<SearchResult[]> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=fr&time_range=month&engines=google,bing,duckduckgo,brave`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json", "User-Agent": "ANAP-Analysis/1.0" },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      const results = (data.results || []).slice(0, 8).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || "",
        publishedDate: r.publishedDate || null,
        engine: (r.engines || []).join(","),
      }));
      if (results.length > 0) {
        console.log(`  ✓ Search [${label}]: ${results.length} results from ${instance}`);
        return results;
      }
    } catch (_) { /* try next instance */ }
  }
  // Fallback: use DuckDuckGo Lite API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const results: SearchResult[] = [];
      if (data.AbstractText) results.push({ title: data.Heading || query, url: data.AbstractURL || "", content: data.AbstractText });
      (data.RelatedTopics || []).slice(0, 5).forEach((t: any) => {
        if (t.Text) results.push({ title: t.Text.slice(0, 80), url: t.FirstURL || "", content: t.Text });
      });
      if (results.length > 0) {
        console.log(`  ✓ Search [${label}]: ${results.length} results from DuckDuckGo`);
        return results;
      }
    }
  } catch (_) {}
  console.error(`  ✗ Search [${label}]: no results`);
  return [];
}

function formatSearchResults(results: SearchResult[], topic: string): string {
  if (!results.length) return "";
  return `[${topic}]\n` + results.map(r => {
    const date = r.publishedDate ? ` | Date: ${r.publishedDate}` : "";
    return `- ${r.title}\n  ${r.content.slice(0, 300)}${date}\n  Source: ${r.url}`;
  }).join("\n");
}

// ====== TEMPORAL VALIDATION ======
interface ValidatedInfo {
  fact: string;
  source: string;
  sourceType: string;
  publishedAt: string;
  validForMatchDate: boolean;
  confidence: "high" | "medium" | "low";
  notes: string;
}

function assessFreshness(publishedDate: string | undefined, matchDate: Date): { valid: boolean; confidence: "high" | "medium" | "low"; notes: string } {
  if (!publishedDate) return { valid: true, confidence: "low", notes: "Date de publication inconnue" };
  try {
    const pubDate = new Date(publishedDate);
    const diffMs = matchDate.getTime() - pubDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return { valid: true, confidence: "medium", notes: "Publié après la date du match (peut être un preview)" };
    if (diffDays <= 2) return { valid: true, confidence: "high", notes: "Information très récente" };
    if (diffDays <= 7) return { valid: true, confidence: "medium", notes: "Information de la semaine" };
    if (diffDays <= 30) return { valid: true, confidence: "low", notes: "Information datant de plus d'une semaine, potentiellement obsolète" };
    return { valid: false, confidence: "low", notes: `Information datant de ${Math.round(diffDays)} jours, probablement obsolète` };
  } catch { return { valid: true, confidence: "low", notes: "Date de publication non parsable" }; }
}

// ====== LEAGUE MAPPINGS ======
const LEAGUE_ESPN_MAP: Record<number, string> = {
  61: 'fra.1', 39: 'eng.1', 140: 'esp.1', 135: 'ita.1', 78: 'ger.1',
  2: 'uefa.champions', 3: 'uefa.europa',
  94: 'por.1', 88: 'ned.1', 144: 'bel.1', 203: 'tur.1', 179: 'sco.1',
  40: 'eng.2', 63: 'fra.2', 253: 'usa.1', 71: 'bra.1',
};

const LEAGUE_THESPORTSDB_MAP: Record<number, string> = {
  61: '4334', 39: '4328', 140: '4335', 135: '4332', 78: '4331',
  2: '4480', 3: '4481', 94: '4344', 88: '4337', 144: '4338',
  203: '4346', 179: '4330', 253: '4347', 71: '4351', 40: '4336', 63: '4396',
};

// ====== STRUCTURED DATA SOURCES (ESPN, TheSportsDB, Weather) ======

async function fetchESPNStandings(leagueId: number, season: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season}`,
    "Standings"
  );
  const entries = data?.children?.[0]?.standings?.entries;
  if (!entries?.length) {
    const data2 = await simpleFetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season + 1}`,
      "Standings-alt"
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

async function fetchESPNTeamStats(teamName: string, leagueId: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`,
    `Teams-${teamName.slice(0,10)}`
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

async function fetchESPNSchedule(teamId: number, teamName: string, leagueId: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const teamsData = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`,
    `SchedTeams-${teamName.slice(0,8)}`
  );
  const teams = teamsData?.sports?.[0]?.leagues?.[0]?.teams || [];
  const keyword = teamName.toLowerCase().split(' ')[0];
  const teamEntry = teams.find((t: any) =>
    t.team?.displayName?.toLowerCase().includes(keyword) ||
    t.team?.shortDisplayName?.toLowerCase().includes(keyword)
  );
  if (!teamEntry?.team?.id) return "";
  const espnTeamId = teamEntry.team.id;
  const schedData = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${espnTeamId}/schedule`,
    `Sched-${teamName.slice(0,8)}`
  );
  if (!schedData?.events?.length) return "";
  const completed = schedData.events.filter((e: any) => e.competitions?.[0]?.status?.type?.completed).slice(-10);
  if (!completed.length) return "";
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
  const lines = completed.map((e: any) => {
    const comp = e.competitions[0];
    const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
    const hs = parseInt(home?.score || '0'), as_ = parseInt(away?.score || '0');
    const isHome = home?.team?.displayName?.toLowerCase().includes(keyword);
    const teamGoals = isHome ? hs : as_;
    const oppGoals = isHome ? as_ : hs;
    goalsFor += teamGoals;
    goalsAgainst += oppGoals;
    if (oppGoals === 0) cleanSheets++;
    if (teamGoals > oppGoals) wins++; else if (teamGoals === oppGoals) draws++; else losses++;
    return `  ${home?.team?.abbreviation || '?'} ${hs}-${as_} ${away?.team?.abbreviation || '?'} (${e.date?.split('T')[0]})`;
  });
  const n = completed.length;
  return `${teamName} — ${n} derniers matchs (${wins}V ${draws}N ${losses}D) | BM:${goalsFor} (${(goalsFor/n).toFixed(1)}/m) BE:${goalsAgainst} (${(goalsAgainst/n).toFixed(1)}/m) | Clean sheets: ${cleanSheets}\n${lines.join("\n")}`;
}

async function fetchESPNInjuries(teamId: number, teamName: string, leagueId: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const teamsData = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`,
    `InjTeams-${teamName.slice(0,8)}`
  );
  const teams = teamsData?.sports?.[0]?.leagues?.[0]?.teams || [];
  const keyword = teamName.toLowerCase().split(' ')[0];
  const teamEntry = teams.find((t: any) =>
    t.team?.displayName?.toLowerCase().includes(keyword) ||
    t.team?.shortDisplayName?.toLowerCase().includes(keyword) ||
    t.team?.name?.toLowerCase().includes(keyword)
  );
  if (!teamEntry?.team?.id) return "";
  const espnTeamId = teamEntry.team.id;
  const rosterData = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${espnTeamId}/roster`,
    `Roster-${teamName.slice(0,8)}`
  );
  if (!rosterData?.athletes?.length && !rosterData?.entries?.length) {
    const injData = await simpleFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${espnTeamId}?enable=roster,injuries`,
      `Inj-${teamName.slice(0,8)}`
    );
    const injuries = injData?.team?.injuries || [];
    if (!injuries.length) return "";
    return `${teamName} - Blessures/Absences:\n` + injuries.map((inj: any) => {
      const player = inj.athlete?.displayName || "Inconnu";
      const status = inj.status || "?";
      const details = inj.details?.detail || inj.type || "";
      return `  ❌ ${player} — ${status}${details ? ` (${details})` : ''}`;
    }).join("\n");
  }
  const allPlayers = (rosterData?.athletes || rosterData?.entries || []).flatMap((group: any) =>
    group.items || group.athletes || (Array.isArray(group) ? group : [group])
  );
  const injured = allPlayers.filter((p: any) => {
    const status = (p.status?.type || p.injuries?.[0]?.status || '').toLowerCase();
    return ['out','doubtful','questionable','injured','suspended','day-to-day'].includes(status);
  });
  if (!injured.length) return "";
  return `${teamName} - Blessures/Absences:\n` + injured.map((p: any) => {
    const name = p.displayName || p.athlete?.displayName || p.fullName || "?";
    const pos = p.position?.abbreviation || p.position?.name || "";
    const status = p.status?.type || p.injuries?.[0]?.status || "?";
    const detail = p.injuries?.[0]?.details?.detail || p.injuries?.[0]?.type || "";
    return `  ❌ ${name} (${pos}) — ${status}${detail ? `: ${detail}` : ''}`;
  }).join("\n");
}

async function fetchTheSportsDBTeam(teamName: string): Promise<{ info: string; id: string }> {
  const data = await simpleFetch(
    `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`,
    `Team-${teamName.slice(0,10)}`
  );
  const team = data?.teams?.[0];
  if (!team) return { info: "", id: "" };
  let txt = `${teamName}:
  Fondé: ${team.intFormedYear || '?'} | Stade: ${team.strStadium || '?'} (${team.intStadiumCapacity || '?'} places)
  Pays: ${team.strCountry || '?'} | Ligue: ${team.strLeague || '?'}
  Manager: ${team.strManager || '?'}`;
  const desc = team.strDescriptionFR || team.strDescriptionEN || '';
  if (desc) txt += `\n  Bio: ${desc.slice(0, 300)}...`;
  return { info: txt, id: team.idTeam || "" };
}

async function fetchTheSportsDBEvents(teamId: string, teamName: string): Promise<string> {
  if (!teamId) return "";
  const [lastData, nextData] = await Promise.all([
    simpleFetch(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${teamId}`, `Last-${teamName.slice(0,8)}`),
    simpleFetch(`https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${teamId}`, `Next-${teamName.slice(0,8)}`),
  ]);
  let txt = "";
  if (lastData?.results?.length) {
    txt += `${teamName} - 5 derniers matchs:\n`;
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

async function fetchTheSportsDBH2H(homeTeam: string, awayTeam: string): Promise<string> {
  const [d1, d2] = await Promise.all([
    simpleFetch(`https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(homeTeam)}_vs_${encodeURIComponent(awayTeam)}`, "H2H"),
    simpleFetch(`https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(awayTeam)}_vs_${encodeURIComponent(homeTeam)}`, "H2H-rev"),
  ]);
  const events = [...(d1?.event || []), ...(d2?.event || [])];
  if (!events.length) return "";
  const seen = new Set();
  const unique = events.filter((e: any) => { if (seen.has(e.idEvent)) return false; seen.add(e.idEvent); return true; });
  unique.sort((a: any, b: any) => (b.dateEvent || '').localeCompare(a.dateEvent || ''));
  return "Confrontations directes:\n" + unique.slice(0, 10).map((e: any) =>
    `  ${e.strHomeTeam} ${e.intHomeScore ?? '?'}-${e.intAwayScore ?? '?'} ${e.strAwayTeam} (${e.dateEvent}, ${e.strLeague})`
  ).join("\n");
}

async function fetchTheSportsDBTable(leagueId: number, season: string): Promise<string> {
  const tsdbId = LEAGUE_THESPORTSDB_MAP[leagueId];
  if (!tsdbId) return "";
  const data = await simpleFetch(
    `https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${tsdbId}&s=${season}`,
    "Table"
  );
  if (!data?.table?.length) return "";
  return "Classement:\n" + data.table.slice(0, 20).map((t: any) =>
    `${t.intRank}. ${t.strTeam} - ${t.intPoints}pts | ${t.intPlayed}J ${t.intWin}V ${t.intDraw}N ${t.intLoss}D | BM:${t.intGoalsFor} BE:${t.intGoalsAgainst} Diff:${t.intGoalDifference}`
  ).join("\n");
}

async function fetchMatchWeather(city: string, kickoff: string): Promise<string> {
  if (!city) return "";
  const geoData = await simpleFetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`,
    "Geo-" + city.slice(0, 10)
  );
  const loc = geoData?.results?.[0];
  if (!loc) return "";
  const matchDate = kickoff.split('T')[0];
  const weatherData = await simpleFetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code&timezone=auto&start_date=${matchDate}&end_date=${matchDate}`,
    "Weather"
  );
  if (!weatherData?.hourly) return "";
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

// ====== WEB SEARCH QUERIES GENERATION ======
function generateSearchQueries(homeTeam: string, awayTeam: string, competition: string, matchDate: string): { query: string; topic: string }[] {
  const dateShort = matchDate.split('T')[0];
  const year = dateShort.split('-')[0];
  return [
    // Injuries & absences
    { query: `${homeTeam} blessures absences ${dateShort}`, topic: "Blessures " + homeTeam },
    { query: `${awayTeam} blessures absences ${dateShort}`, topic: "Blessures " + awayTeam },
    { query: `${homeTeam} injuries team news ${dateShort}`, topic: "Injuries " + homeTeam },
    { query: `${awayTeam} injuries team news ${dateShort}`, topic: "Injuries " + awayTeam },
    // Probable lineups
    { query: `${homeTeam} vs ${awayTeam} composition probable ${dateShort}`, topic: "Compo probable" },
    { query: `${homeTeam} vs ${awayTeam} expected lineup ${dateShort}`, topic: "Expected lineup" },
    // Recent form & results
    { query: `${homeTeam} résultats récents forme ${year}`, topic: "Forme " + homeTeam },
    { query: `${awayTeam} résultats récents forme ${year}`, topic: "Forme " + awayTeam },
    // Press conferences & declarations
    { query: `${homeTeam} conférence de presse avant match ${dateShort}`, topic: "Conf presse " + homeTeam },
    { query: `${awayTeam} conférence de presse avant match ${dateShort}`, topic: "Conf presse " + awayTeam },
    // Suspensions
    { query: `${homeTeam} suspensions joueurs ${competition} ${year}`, topic: "Suspensions " + homeTeam },
    { query: `${awayTeam} suspensions joueurs ${competition} ${year}`, topic: "Suspensions " + awayTeam },
    // Match preview & context
    { query: `${homeTeam} vs ${awayTeam} preview analyse ${dateShort}`, topic: "Preview match" },
    { query: `${homeTeam} vs ${awayTeam} ${competition} enjeu contexte`, topic: "Enjeu & contexte" },
    // Tactical & style
    { query: `${homeTeam} style jeu tactique ${competition} ${year}`, topic: "Tactique " + homeTeam },
    { query: `${awayTeam} style jeu tactique ${competition} ${year}`, topic: "Tactique " + awayTeam },
    // Key players
    { query: `${homeTeam} joueurs clés en forme ${year}`, topic: "Joueurs clés " + homeTeam },
    { query: `${awayTeam} joueurs clés en forme ${year}`, topic: "Joueurs clés " + awayTeam },
    // Coach changes & news
    { query: `${homeTeam} entraîneur news ${year}`, topic: "Coach " + homeTeam },
    { query: `${awayTeam} entraîneur news ${year}`, topic: "Coach " + awayTeam },
  ];
}

// ====== NORMALIZE PREDICTION ======
function normalizePrediction(prediction: any): any {
  const probFields = [
    'home_win_prob', 'draw_prob', 'away_win_prob',
    'btts_prob', 'over_25_prob', 'over_15_prob', 'under_25_prob',
    'first_to_score_home', 'first_to_score_away', 'first_to_score_none',
    'confidence'
  ];
  const smallCount = probFields.filter(f => Math.abs(prediction[f] ?? 0) <= 1.01).length;
  if (smallCount >= probFields.length * 0.7) {
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", match_id).single();
    if (matchError || !match) throw new Error(`Match not found: ${matchError?.message}`);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔍 ANALYSE: ${match.home_team_name} vs ${match.away_team_name}`);
    console.log(`📋 ${match.league_name} (${match.league_country}) - ${match.league_round || '?'}`);
    console.log(`📅 ${match.kickoff}`);
    console.log(`${'═'.repeat(60)}`);

    const { data: analysisRow, error: insertError } = await supabase
      .from("analyses").insert({ match_id: match.id, status: "generating", analysis_type: analysis_type || "full" }).select().single();
    if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

    const matchDate = new Date(match.kickoff);
    const currentSeason = matchDate.getMonth() >= 7 ? matchDate.getFullYear() : matchDate.getFullYear() - 1;
    const seasonStr = `${currentSeason}-${currentSeason + 1}`;

    // ══════════ PHASE 1: STRUCTURED DATA (APIs gratuites) ══════════
    console.log(`\n📊 Phase 1: Données structurées (ESPN, TheSportsDB, Weather)...`);

    const [
      espnStandings,
      homeTeamTSDB, awayTeamTSDB,
      tsdbH2H, tsdbTable,
      weatherTxt,
      espnHomeStats, espnAwayStats,
      homeInjuries, awayInjuries,
      homeSchedule, awaySchedule,
    ] = await Promise.all([
      fetchESPNStandings(match.league_id, currentSeason),
      fetchTheSportsDBTeam(match.home_team_name),
      fetchTheSportsDBTeam(match.away_team_name),
      fetchTheSportsDBH2H(match.home_team_name, match.away_team_name),
      fetchTheSportsDBTable(match.league_id, seasonStr),
      fetchMatchWeather(match.venue_city || match.league_country, match.kickoff),
      fetchESPNTeamStats(match.home_team_name, match.league_id),
      fetchESPNTeamStats(match.away_team_name, match.league_id),
      fetchESPNInjuries(match.home_team_id, match.home_team_name, match.league_id),
      fetchESPNInjuries(match.away_team_id, match.away_team_name, match.league_id),
      fetchESPNSchedule(match.home_team_id, match.home_team_name, match.league_id),
      fetchESPNSchedule(match.away_team_id, match.away_team_name, match.league_id),
    ]);

    const [homeEventsTxt, awayEventsTxt] = await Promise.all([
      fetchTheSportsDBEvents(homeTeamTSDB.id, match.home_team_name),
      fetchTheSportsDBEvents(awayTeamTSDB.id, match.away_team_name),
    ]);

    // ══════════ PHASE 2: WEB SEARCH (SearXNG, gratuit, illimité) ══════════
    console.log(`\n🔎 Phase 2: Recherche web exhaustive (SearXNG)...`);

    const searchQueries = generateSearchQueries(
      match.home_team_name, match.away_team_name,
      match.league_name, match.kickoff
    );

    // Execute searches in batches of 5 to avoid overwhelming
    const allSearchResults: { topic: string; results: SearchResult[] }[] = [];
    for (let i = 0; i < searchQueries.length; i += 5) {
      const batch = searchQueries.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(q => webSearch(q.query, q.topic).then(results => ({ topic: q.topic, results })))
      );
      allSearchResults.push(...batchResults);
      // Small delay between batches
      if (i + 5 < searchQueries.length) await new Promise(r => setTimeout(r, 500));
    }

    // ══════════ PHASE 3: TEMPORAL VALIDATION ══════════
    console.log(`\n🕐 Phase 3: Validation temporelle...`);

    const sourceAudit: ValidatedInfo[] = [];
    let webSearchContent = "";

    for (const sr of allSearchResults) {
      if (!sr.results.length) continue;
      const topicContent: string[] = [];
      for (const r of sr.results) {
        const freshness = assessFreshness(r.publishedDate, matchDate);
        // Only include valid or flagged info
        const freshnessTag = freshness.confidence === "high" ? "🟢" : freshness.confidence === "medium" ? "🟡" : "🔴";
        topicContent.push(`${freshnessTag} ${r.title}\n  ${r.content.slice(0, 400)}\n  [Confiance: ${freshness.confidence}] [${freshness.notes}]`);

        sourceAudit.push({
          fact: r.title,
          source: r.url,
          sourceType: classifySource(r.url),
          publishedAt: r.publishedDate || "inconnue",
          validForMatchDate: freshness.valid,
          confidence: freshness.confidence,
          notes: freshness.notes,
        });
      }
      webSearchContent += `\n══ ${sr.topic.toUpperCase()} ══\n${topicContent.join("\n")}\n`;
    }

    const webSearchCount = allSearchResults.filter(sr => sr.results.length > 0).length;
    console.log(`  📝 ${webSearchCount}/${searchQueries.length} recherches avec résultats`);
    console.log(`  📋 ${sourceAudit.length} sources collectées et validées`);

    // ══════════ PHASE 4: NORMALISATION ══════════
    console.log(`\n📦 Phase 4: Normalisation des données...`);

    // Build structured standings
    let standingsTxt = espnStandings || "";
    if (tsdbTable) standingsTxt += standingsTxt ? `\n\n${tsdbTable}` : tsdbTable;
    if (!standingsTxt) standingsTxt = "Classement non disponible";

    // Build form data
    let recentFormTxt = "";
    if (homeSchedule) recentFormTxt += homeSchedule;
    if (awaySchedule) recentFormTxt += (recentFormTxt ? "\n\n" : "") + awaySchedule;
    if (homeEventsTxt) recentFormTxt += `\n\n${homeEventsTxt}`;
    if (awayEventsTxt) recentFormTxt += `\n\n${awayEventsTxt}`;
    if (!recentFormTxt) recentFormTxt = "Forme récente non disponible";

    // Build injuries
    let injuriesTxt = "";
    if (homeInjuries) injuriesTxt += homeInjuries;
    if (awayInjuries) injuriesTxt += (injuriesTxt ? "\n\n" : "") + awayInjuries;
    if (!injuriesTxt) injuriesTxt = "Aucune information sur les blessures disponible via ESPN";

    // H2H
    const h2hTxt = tsdbH2H || "H2H non disponible";

    // Team info
    const teamInfoTxt = [homeTeamTSDB.info, awayTeamTSDB.info, espnHomeStats, espnAwayStats].filter(Boolean).join("\n\n") || "Non disponible";

    // Source count
    let srcCount = 1;
    const check = (ok: boolean) => { if (ok) srcCount++; };
    check(!standingsTxt.includes("non disponible"));
    check(!!recentFormTxt && !recentFormTxt.includes("non disponible"));
    check(!h2hTxt.includes("non disponible"));
    check(!!(homeTeamTSDB.info || awayTeamTSDB.info));
    check(!!weatherTxt);
    check(!!(homeEventsTxt || awayEventsTxt));
    check(!!(espnHomeStats || espnAwayStats));
    check(!injuriesTxt.includes("Aucune"));
    check(!!(homeSchedule || awaySchedule));
    srcCount += webSearchCount;

    // Source audit summary
    const highConfCount = sourceAudit.filter(s => s.confidence === "high").length;
    const medConfCount = sourceAudit.filter(s => s.confidence === "medium").length;
    const lowConfCount = sourceAudit.filter(s => s.confidence === "low").length;
    const auditSummary = `Sources collectées: ${sourceAudit.length} | Confiance haute: ${highConfCount} | Moyenne: ${medConfCount} | Basse: ${lowConfCount}`;

    console.log(`\n📊 ${srcCount} sources totales (${webSearchCount} recherches web)`);

    // ══════════ PHASE 5: ENVOI À L'IA ══════════
    console.log("🤖 Phase 5: Analyse IA...");

    const systemPrompt = `Tu es un analyste football d'élite. Tu reçois un DOSSIER COMPLET avec des données structurées ET des résultats de recherche web validés temporellement.

DATE DU MATCH ANALYSÉ: ${match.kickoff}

RÈGLES STRICTES:
1. N'invente JAMAIS de données. Si une info manque, dis-le clairement.
2. Probabilités en 0-100 (65 = 65%). home_win + draw + away_win = 100
3. INTERDICTION ABSOLUE: Ne JAMAIS utiliser, mentionner ou baser ton analyse sur des cotes de bookmakers, odds, marchés de paris, handicaps, ou tips de parieurs.
4. Base ton analyse UNIQUEMENT sur les données sportives factuelles: forme, stats, blessures, contexte, tactique, historique.
5. Pondération: Forme récente 25%, Effectif/Blessures 20%, Stats offensives/défensives 20%, Classement/Enjeu 15%, Contexte avancé 10%, H2H 10%
6. VALIDATION TEMPORELLE: Chaque info a un indicateur de fraîcheur (🟢 haute, 🟡 moyenne, 🔴 basse). Privilégie les infos 🟢 et 🟡. Signale les infos 🔴 comme potentiellement obsolètes.
7. Sépare CLAIREMENT les faits confirmés des hypothèses probables.
8. Mentionne les zones d'incertitude et les données manquantes.
9. IMPORTANT: dans "data_quality_assessment", ne mentionne JAMAIS de nom de source/API/site. Parle uniquement de "données disponibles", "informations collectées", "sources consultées".
10. Réponds en français.
11. Sois EXHAUSTIF: analyse en profondeur chaque aspect (forme, effectif, tactique, contexte, enjeu, dynamique, calendrier).
12. Pour les compositions probables: si tu as des infos de recherche web, utilise-les. Sinon, dis clairement que l'info n'est pas disponible.
13. Signale tout changement d'entraîneur récent, toute info tactique pertinente.`;

    const userPrompt = `DOSSIER D'ANALYSE EXHAUSTIF — ${match.home_team_name} vs ${match.away_team_name}
${match.league_name} (${match.league_country}) — ${match.league_round || '?'}
📅 ${match.kickoff} | 🏟 ${match.venue_name || '?'}, ${match.venue_city || ''}

════════════════════════════════════
SECTION 1: DONNÉES STRUCTURÉES (APIs)
════════════════════════════════════

══ CLASSEMENT SAISON ${currentSeason}/${currentSeason + 1} ══
${standingsTxt}

══ FORME RÉCENTE & SÉRIES ══
${recentFormTxt}

══ BLESSURES & ABSENCES (ESPN) ══
${injuriesTxt}

══ CONFRONTATIONS DIRECTES ══
${h2hTxt}

══ MÉTÉO AU STADE ══
${weatherTxt || "Non disponible"}

══ INFOS ÉQUIPES ══
${teamInfoTxt}

════════════════════════════════════
SECTION 2: RECHERCHE WEB (validée temporellement)
════════════════════════════════════
${webSearchContent || "Aucun résultat de recherche web disponible"}

════════════════════════════════════
SECTION 3: AUDIT DES SOURCES
════════════════════════════════════
${auditSummary}
Indicateurs: 🟢 = info récente et fiable | 🟡 = info de la semaine | 🔴 = info potentiellement obsolète

════════════════════════════════════
DONNÉES EXCLUES (par politique)
════════════════════════════════════
- Cotes de bookmakers
- Marchés de paris
- Handicaps / lignes
- Tips de parieurs externes
- Pronostics externes

⚠️ RAPPEL: Probabilités en 0-100. home+draw+away=100.
⚠️ Analyse EXHAUSTIVE requise: forme, effectif, tactique, contexte, enjeu, dynamique, calendrier, compositions probables.
⚠️ data_quality_assessment: NE MENTIONNE AUCUN NOM DE SOURCE/API/SITE.
⚠️ AUCUNE DONNÉE DE BOOKMAKER NE DOIT APPARAÎTRE DANS L'ANALYSE.`;

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
            description: "Analyse complète basée sur données sportives factuelles. Probabilités 0-100. Aucune donnée bookmaker.",
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
                    summary: { type: "string", description: "Résumé exhaustif de l'analyse (contexte, enjeu, dynamique, pronostic)" },
                    key_factors: { type: "array", items: { type: "object", properties: { name:{type:"string"}, impact:{type:"string",enum:["high","medium","low"]}, direction:{type:"string",enum:["home","away","neutral"]}, description:{type:"string"} }, required:["name","impact","direction","description"], additionalProperties:false } },
                    team_a_analysis: { type: "string", description: "Analyse détaillée équipe domicile: forme, effectif, tactique, joueurs clés, dynamique" },
                    team_b_analysis: { type: "string", description: "Analyse détaillée équipe extérieur: forme, effectif, tactique, joueurs clés, dynamique" },
                    injuries_impact: { type: "string", description: "Impact des blessures et absences sur le match" },
                    tactical_analysis: { type: "string", description: "Analyse tactique: styles de jeu, points forts/faibles, clés du match" },
                    probable_lineups: { type: "string", description: "Compositions probables si info disponible, sinon le mentionner" },
                    context_stakes: { type: "string", description: "Enjeu du match, contexte calendaire, fatigue, motivation" },
                    missing_variables: { type: "array", items: { type: "string" } },
                    data_quality_assessment: { type: "string", description: "Évaluation qualité des données SANS mentionner de source/API/site" },
                    confidence_notes: { type: "string", description: "Notes sur le niveau de confiance de l'analyse et les zones d'incertitude" },
                  },
                  required: ["summary","key_factors","team_a_analysis","team_b_analysis","injuries_impact","tactical_analysis","probable_lineups","context_stakes","missing_variables","data_quality_assessment","confidence_notes"],
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
    const quality = Math.min(100, Math.round((srcCount / 15) * 100));
    const uncertainty = Math.round(Math.max(0, 100 - (result.prediction?.confidence ?? 50)));

    console.log(`\n✅ RÉSULTAT: ${result.prediction.home_win_prob}% / ${result.prediction.draw_prob}% / ${result.prediction.away_win_prob}%`);
    console.log(`   Confiance: ${result.prediction.confidence}% | Sources: ${srcCount} | Qualité: ${quality}%`);

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

// ====== HELPERS ======
function classifySource(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("ligue1") || u.includes("premierleague") || u.includes("laliga") || u.includes("bundesliga") || u.includes("seriea") || u.includes("uefa")) return "officiel_competition";
  if (u.includes(".fff.fr") || u.includes("thefa.com") || u.includes("rfef.es") || u.includes("figc.it") || u.includes("dfb.de")) return "officiel_federation";
  if (u.includes("lequipe.fr") || u.includes("marca.com") || u.includes("as.com") || u.includes("gazzetta") || u.includes("bbc.com/sport") || u.includes("skysports") || u.includes("rmc")) return "media_sportif_reconnu";
  if (u.includes("transfermarkt") || u.includes("whoscored") || u.includes("fbref") || u.includes("understat") || u.includes("sofascore") || u.includes("flashscore")) return "base_statistiques";
  if (u.includes("foot-sur7") || u.includes("footmercato") || u.includes("90min") || u.includes("goal.com") || u.includes("sport.fr")) return "media_sportif";
  if (u.includes("lemonde") || u.includes("lefigaro") || u.includes("franceinfo") || u.includes("guardian") || u.includes("telegraph")) return "presse_generaliste";
  return "autre";
}
