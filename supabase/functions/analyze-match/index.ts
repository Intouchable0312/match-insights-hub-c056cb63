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

async function fetchTextContent(url: string, label: string, timeoutMs = 10000): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) { console.error(`  ✗ ${label}: ${res.status}`); return ""; }
    const txt = await res.text();
    console.log(`  ✓ ${label}: ${txt.length} chars`);
    return txt;
  } catch (err) { console.error(`  ✗ ${label}: ${err.message}`); return ""; }
}

// ====== LEAGUE MAPPINGS ======
const LEAGUE_ESPN_MAP: Record<number, string> = {
  4334: 'fra.1', 4328: 'eng.1', 4335: 'esp.1', 4332: 'ita.1', 4331: 'ger.1',
  4480: 'uefa.champions', 4481: 'uefa.europa',
  4344: 'por.1', 4337: 'ned.1', 4338: 'bel.1', 4346: 'tur.1', 4330: 'sco.1',
  4336: 'eng.2', 4396: 'fra.2', 4347: 'usa.1', 4351: 'bra.1',
};

const LEAGUE_THESPORTSDB_MAP: Record<number, string> = {
  4334: '4334', 4328: '4328', 4335: '4335', 4332: '4332', 4331: '4331',
  4480: '4480', 4481: '4481', 4344: '4344', 4337: '4337', 4338: '4338',
  4346: '4346', 4330: '4330', 4347: '4347', 4351: '4351', 4336: '4336', 4396: '4396',
};

const LEAGUE_FDUK_MAP: Record<number, { div: string; path: string }> = {
  4334: { div: 'F1', path: 'F1' }, 4396: { div: 'F2', path: 'F2' },
  4328: { div: 'E0', path: 'E0' }, 4336: { div: 'E1', path: 'E1' },
  4335: { div: 'SP1', path: 'SP1' }, 4332: { div: 'I1', path: 'I1' },
  4331: { div: 'D1', path: 'D1' }, 4337: { div: 'N1', path: 'N1' },
  4344: { div: 'P1', path: 'P1' }, 4338: { div: 'B1', path: 'B1' },
  4346: { div: 'T1', path: 'T1' }, 4330: { div: 'SC0', path: 'SC0' },
};

// ====== FREE DATA SOURCES ======

// 1. ESPN Standings
async function fetchESPNStandings(leagueId: number, season: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season}`,
    "Standings"
  );
  let entries = data?.children?.[0]?.standings?.entries;
  if (!entries?.length) {
    const data2 = await simpleFetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season + 1}`,
      "Standings-alt"
    );
    entries = data2?.children?.[0]?.standings?.entries;
  }
  if (!entries?.length) return "";
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
    `Scores-${teamName.slice(0,10)}`
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

// 3. ESPN Team Stats
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

// 4. TheSportsDB - Team Info
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
  Manager: ${team.strManager || '?'}
  Couleurs: ${team.strTeamJersey || '?'}`;
  const desc = team.strDescriptionFR || team.strDescriptionEN || '';
  if (desc) txt += `\n  Bio: ${desc.slice(0, 300)}...`;
  return { info: txt, id: team.idTeam || "" };
}

// 5. TheSportsDB - Last 5 & Next 5
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

// 6. TheSportsDB - H2H
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

// 7. TheSportsDB - League Table
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

// 8. Weather (Open-Meteo, 100% free)
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

// 9. League Averages from ESPN
async function fetchLeagueStats(leagueId: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`,
    "LeagueScores"
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

// 10. football-data.co.uk CSV
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

async function fetchFootballDataUK(leagueId: number, season: number, homeTeam: string, awayTeam: string): Promise<string> {
  const league = LEAGUE_FDUK_MAP[leagueId];
  if (!league) return "";
  const s1 = String(season).slice(2);
  const s2 = String(season + 1).slice(2);
  const csvUrl = `https://www.football-data.co.uk/mmz4281/${s1}${s2}/${league.path}.csv`;
  const raw = await fetchTextContent(csvUrl, `FDUK-${league.div}`);
  if (!raw) return "";

  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 2) return "";
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const vals = parseCSVLine(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });

  const homeWords = homeTeam.toLowerCase().split(/\s+/);
  const awayWords = awayTeam.toLowerCase().split(/\s+/);
  const matchesTeam = (csvName: string, words: string[]) => {
    const n = csvName.toLowerCase();
    return words.some(w => w.length >= 3 && n.includes(w));
  };

  const homeMatches = rows.filter(r => matchesTeam(r.HomeTeam || '', homeWords) || matchesTeam(r.AwayTeam || '', homeWords));
  const awayMatches = rows.filter(r => matchesTeam(r.HomeTeam || '', awayWords) || matchesTeam(r.AwayTeam || '', awayWords));
  const h2hCSV = rows.filter(r =>
    (matchesTeam(r.HomeTeam || '', homeWords) && matchesTeam(r.AwayTeam || '', awayWords)) ||
    (matchesTeam(r.HomeTeam || '', awayWords) && matchesTeam(r.AwayTeam || '', homeWords))
  );

  const computeStats = (matches: any[], teamWords: string[], teamName: string) => {
    if (!matches.length) return "";
    let w = 0, d = 0, l = 0, gf = 0, ga = 0, shots = 0, sot = 0, corners = 0, fouls = 0, yellows = 0, reds = 0;
    matches.forEach(r => {
      const isHome = matchesTeam(r.HomeTeam || '', teamWords);
      const hg = parseInt(r.FTHG) || 0, ag = parseInt(r.FTAG) || 0;
      if (isHome) {
        gf += hg; ga += ag;
        shots += parseInt(r.HS) || 0; sot += parseInt(r.HST) || 0;
        corners += parseInt(r.HC) || 0; fouls += parseInt(r.HF) || 0;
        yellows += parseInt(r.HY) || 0; reds += parseInt(r.HR) || 0;
        if (hg > ag) w++; else if (hg === ag) d++; else l++;
      } else {
        gf += ag; ga += hg;
        shots += parseInt(r.AS) || 0; sot += parseInt(r.AST) || 0;
        corners += parseInt(r.AC) || 0; fouls += parseInt(r.AF) || 0;
        yellows += parseInt(r.AY) || 0; reds += parseInt(r.AR) || 0;
        if (ag > hg) w++; else if (hg === ag) d++; else l++;
      }
    });
    const n = matches.length;
    return `${teamName} — ${n} matchs joués cette saison:
  Bilan: ${w}V ${d}N ${l}D | BM: ${gf} (${(gf/n).toFixed(1)}/m) BE: ${ga} (${(ga/n).toFixed(1)}/m)
  Tirs: ${(shots/n).toFixed(1)}/m | Tirs cadrés: ${(sot/n).toFixed(1)}/m (${shots > 0 ? Math.round(sot/shots*100) : 0}% cadrage)
  Corners: ${(corners/n).toFixed(1)}/m | Fautes: ${(fouls/n).toFixed(1)}/m
  Cartons jaunes: ${yellows} (${(yellows/n).toFixed(1)}/m) | Rouges: ${reds}`;
  };

  let txt = "";
  const homeStats = computeStats(homeMatches, homeWords, homeTeam);
  const awayStats = computeStats(awayMatches, awayWords, awayTeam);
  if (homeStats) txt += homeStats;
  if (awayStats) txt += (txt ? "\n\n" : "") + awayStats;

  if (h2hCSV.length > 0) {
    txt += "\n\nConfrontations cette saison:\n";
    txt += h2hCSV.map(r => {
      const line = `  ${r.HomeTeam} ${r.FTHG}-${r.FTAG} ${r.AwayTeam} (${r.Date})`;
      const details = [];
      if (r.HS && r.AS) details.push(`Tirs: ${r.HS}-${r.AS}`);
      if (r.HST && r.AST) details.push(`Cadrés: ${r.HST}-${r.AST}`);
      if (r.HC && r.AC) details.push(`Corners: ${r.HC}-${r.AC}`);
      if (r.HY && r.AY) details.push(`Jaunes: ${r.HY}-${r.AY}`);
      return details.length ? `${line}\n    ${details.join(' | ')}` : line;
    }).join("\n");
  }

  const lastHomeMatch = homeMatches[homeMatches.length - 1];
  const lastAwayMatch = awayMatches[awayMatches.length - 1];
  if (lastHomeMatch?.B365H) {
    txt += `\n\nDernières cotes ${homeTeam}: 1=${lastHomeMatch.B365H} X=${lastHomeMatch.B365D} 2=${lastHomeMatch.B365A}`;
  }
  if (lastAwayMatch?.B365H) {
    txt += `\nDernières cotes ${awayTeam}: 1=${lastAwayMatch.B365H} X=${lastAwayMatch.B365D} 2=${lastAwayMatch.B365A}`;
  }

  if (rows.length >= 20) {
    let tg = 0, btts = 0, o25 = 0, o15 = 0, ts = 0, tc = 0;
    rows.forEach(r => {
      const hg = parseInt(r.FTHG) || 0, ag = parseInt(r.FTAG) || 0;
      tg += hg + ag;
      if (hg > 0 && ag > 0) btts++;
      if (hg + ag > 2) o25++;
      if (hg + ag > 1) o15++;
      ts += (parseInt(r.HS) || 0) + (parseInt(r.AS) || 0);
      tc += (parseInt(r.HC) || 0) + (parseInt(r.AC) || 0);
    });
    const n = rows.length;
    txt += `\n\nMoyennes ligue (${n} matchs saison):
  Buts/match: ${(tg/n).toFixed(2)} | BTTS: ${Math.round(btts/n*100)}% | O2.5: ${Math.round(o25/n*100)}% | O1.5: ${Math.round(o15/n*100)}%
  Tirs/match: ${(ts/n).toFixed(1)} | Corners/match: ${(tc/n).toFixed(1)}`;
  }

  return txt;
}

// 11. TheSportsDB - Event Lineups (free)
async function fetchTheSportsDBLineup(teamId: string, teamName: string): Promise<string> {
  if (!teamId) return "";
  // Get latest event to find lineup
  const lastData = await simpleFetch(
    `https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${teamId}`,
    `Lineup-${teamName.slice(0,8)}`
  );
  if (!lastData?.results?.length) return "";
  const latestEvent = lastData.results[0];
  const eventId = latestEvent.idEvent;
  if (!eventId) return "";

  const lineupData = await simpleFetch(
    `https://www.thesportsdb.com/api/v1/json/3/lookuplineup.php?id=${eventId}`,
    `Lineup-ev-${teamName.slice(0,6)}`
  );
  if (!lineupData?.lineup?.length) return "";

  const teamPlayers = lineupData.lineup.filter((p: any) =>
    p.strTeam?.toLowerCase().includes(teamName.toLowerCase().split(' ')[0])
  );
  if (!teamPlayers.length) return "";

  const starters = teamPlayers.filter((p: any) => p.strSubstitute !== 'Yes');
  const subs = teamPlayers.filter((p: any) => p.strSubstitute === 'Yes');

  let txt = `Dernière composition connue de ${teamName} (${latestEvent.dateEvent} vs ${latestEvent.strHomeTeam === teamName ? latestEvent.strAwayTeam : latestEvent.strHomeTeam}):\n`;
  txt += `  Formation: ${latestEvent.strHomeFormation || latestEvent.strAwayFormation || '?'}\n`;
  txt += `  Titulaires: ${starters.map((p: any) => `${p.strPlayer} (${p.strPosition})`).join(', ')}\n`;
  if (subs.length) txt += `  Remplaçants: ${subs.map((p: any) => p.strPlayer).join(', ')}`;
  return txt;
}

// 12. TheSportsDB - Team Players (to assess squad depth)
async function fetchTheSportsDBPlayers(teamId: string, teamName: string): Promise<string> {
  if (!teamId) return "";
  const data = await simpleFetch(
    `https://www.thesportsdb.com/api/v1/json/3/lookup_all_players.php?id=${teamId}`,
    `Players-${teamName.slice(0,8)}`
  );
  if (!data?.player?.length) return "";

  const players = data.player.slice(0, 30);
  const byPosition: Record<string, string[]> = {};
  players.forEach((p: any) => {
    const pos = p.strPosition || 'Inconnu';
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(`${p.strPlayer} (${p.strNationality || '?'}, ${p.dateBorn?.split('-')[0] || '?'})`);
  });

  let txt = `Effectif ${teamName}:\n`;
  for (const [pos, pls] of Object.entries(byPosition)) {
    txt += `  ${pos}: ${pls.join(', ')}\n`;
  }
  return txt;
}

// ====== FLASHSCORE (via Livesport Services) ======

const FLASHSCORE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.flashscore.fr/',
  'Origin': 'https://www.flashscore.fr',
};

// 15. FlashScore - Search team to get ID
async function searchFlashScoreTeam(teamName: string): Promise<{ id: string; name: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://s.livesport.services/api/v2/search/?q=${encodeURIComponent(teamName)}&lang-id=17&project-id=602&project-type-id=1&sport-id=1`,
      { headers: FLASHSCORE_HEADERS, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) { console.error(`  ✗ FS-Search-${teamName.slice(0,10)}: ${res.status}`); return null; }
    const data = await res.json();
    console.log(`  ✓ FS-Search-${teamName.slice(0,10)}: OK`);

    // Find best match in results
    const results = data?.results || data || [];
    const teamKw = teamName.toLowerCase().split(/\s+/);
    
    for (const item of results) {
      if (item.type === 'participants' && item.participants?.length) {
        for (const p of item.participants) {
          const pName = (p.name || '').toLowerCase();
          if (teamKw.some((w: string) => w.length >= 3 && pName.includes(w))) {
            return { id: p.id || p.url?.split('/')?.pop() || '', name: p.name };
          }
        }
      }
      // Alternative structure
      if (item.id && item.name) {
        const iName = item.name.toLowerCase();
        if (teamKw.some((w: string) => w.length >= 3 && iName.includes(w))) {
          return { id: item.id, name: item.name };
        }
      }
    }
    return null;
  } catch (err) {
    console.error(`  ✗ FS-Search-${teamName.slice(0,10)}: ${(err as Error).message}`);
    return null;
  }
}

// 16. FlashScore - Team last results (form)
async function fetchFlashScoreTeamForm(teamId: string, teamName: string): Promise<string> {
  if (!teamId) return "";
  try {
    // Try fetching team results page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://d.flashscore.com/x/feed/tr_2_${teamId}_0_3_`,
      {
        headers: {
          ...FLASHSCORE_HEADERS,
          'x-fsign': 'SW9D1eZo',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    
    if (!res.ok) {
      console.error(`  ✗ FS-Form-${teamName.slice(0,10)}: ${res.status}`);
      return "";
    }
    
    const text = await res.text();
    console.log(`  ✓ FS-Form-${teamName.slice(0,10)}: ${text.length} chars`);
    
    if (!text || text.length < 20) return "";
    
    // Parse FlashScore feed format (pipe-delimited)
    const matches: string[] = [];
    const lines = text.split('¬');
    let currentMatch: Record<string, string> = {};
    
    for (const line of lines) {
      const parts = line.split('÷');
      if (parts.length >= 2) {
        const key = parts[0].replace(/[~|]/, '');
        const value = parts[1];
        
        if (key.includes('AA') && key.includes('¬')) {
          if (Object.keys(currentMatch).length > 0) {
            const matchStr = formatFlashScoreMatch(currentMatch, teamName);
            if (matchStr) matches.push(matchStr);
          }
          currentMatch = {};
        }
        currentMatch[key] = value;
      }
    }
    
    // Handle last match
    if (Object.keys(currentMatch).length > 0) {
      const matchStr = formatFlashScoreMatch(currentMatch, teamName);
      if (matchStr) matches.push(matchStr);
    }
    
    if (matches.length === 0 && text.length > 50) {
      // Fallback: just return raw text summary
      return `FlashScore données brutes ${teamName}: ${text.slice(0, 500)}`;
    }
    
    return matches.length > 0
      ? `FlashScore - Forme ${teamName} (${matches.length} derniers matchs):\n${matches.slice(0, 6).join('\n')}`
      : "";
  } catch (err) {
    console.error(`  ✗ FS-Form-${teamName.slice(0,10)}: ${(err as Error).message}`);
    return "";
  }
}

function formatFlashScoreMatch(m: Record<string, string>, teamName: string): string {
  // Extract common FlashScore feed keys
  const home = m['CX'] || m['AE'] || '?';
  const away = m['CY'] || m['AF'] || '?';
  const scoreH = m['AG'] || '?';
  const scoreA = m['AH'] || '?';
  const league = m['ZA'] || m['CK'] || '';
  const date = m['AD'] || '';
  
  if (home === '?' && away === '?') return '';
  
  const isHome = home.toLowerCase().includes(teamName.toLowerCase().split(' ')[0]);
  const result = scoreH !== '?' && scoreA !== '?'
    ? (isHome
      ? (parseInt(scoreH) > parseInt(scoreA) ? 'V' : parseInt(scoreH) < parseInt(scoreA) ? 'D' : 'N')
      : (parseInt(scoreA) > parseInt(scoreH) ? 'V' : parseInt(scoreA) < parseInt(scoreH) ? 'D' : 'N'))
    : '?';
  
  return `  [${result}] ${home} ${scoreH}-${scoreA} ${away} ${league ? `(${league})` : ''} ${date}`;
}

// 17. FlashScore - Match page scraping for absences/injuries
async function fetchFlashScoreMatchPreview(homeTeam: string, awayTeam: string): Promise<string> {
  try {
    // Search for the specific match
    const query = `${homeTeam} ${awayTeam}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://s.livesport.services/api/v2/search/?q=${encodeURIComponent(query)}&lang-id=17&project-id=602&project-type-id=1&sport-id=1`,
      { headers: FLASHSCORE_HEADERS, signal: controller.signal }
    );
    clearTimeout(timeout);
    
    if (!res.ok) { console.error(`  ✗ FS-Preview: ${res.status}`); return ""; }
    const data = await res.json();
    console.log(`  ✓ FS-Preview: OK`);
    
    // Try to find a match event in results
    const results = data?.results || data || [];
    let matchId = '';
    
    for (const item of results) {
      if (item.type === 'events' && item.events?.length) {
        for (const evt of item.events) {
          const evtStr = JSON.stringify(evt).toLowerCase();
          const homeKw = homeTeam.toLowerCase().split(' ')[0];
          const awayKw = awayTeam.toLowerCase().split(' ')[0];
          if (evtStr.includes(homeKw) && evtStr.includes(awayKw)) {
            matchId = evt.id || evt.url?.split('/')?.pop() || '';
            break;
          }
        }
      }
    }
    
    if (!matchId) return "";
    
    // Fetch match summary
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 8000);
    const matchRes = await fetch(
      `https://d.flashscore.com/x/feed/d_su_${matchId}_fr_1`,
      {
        headers: { ...FLASHSCORE_HEADERS, 'x-fsign': 'SW9D1eZo' },
        signal: controller2.signal,
      }
    );
    clearTimeout(timeout2);
    
    if (!matchRes.ok) { console.error(`  ✗ FS-Match: ${matchRes.status}`); return ""; }
    const matchText = await matchRes.text();
    console.log(`  ✓ FS-Match: ${matchText.length} chars`);
    
    if (matchText.length > 50) {
      return `FlashScore - Aperçu match:\n${matchText.slice(0, 1000)}`;
    }
    return "";
  } catch (err) {
    console.error(`  ✗ FS-Preview: ${(err as Error).message}`);
    return "";
  }
}

// 18. FlashScore - Scrape team page HTML for absences
async function fetchFlashScoreAbsences(teamName: string): Promise<string> {
  try {
    // Try to fetch the team page from FlashScore FR
    const slug = teamName.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://www.flashscore.fr/equipe/${slug}/`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    
    if (!res.ok) { console.error(`  ✗ FS-Abs-${teamName.slice(0,10)}: ${res.status}`); return ""; }
    const html = await res.text();
    console.log(`  ✓ FS-Abs-${teamName.slice(0,10)}: ${html.length} chars`);
    
    // Extract structured data from HTML (JSON-LD, meta tags)
    let info = "";
    
    // Look for JSON-LD data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.name) info += `Équipe: ${jsonLd.name}\n`;
        if (jsonLd.description) info += `Info: ${jsonLd.description.slice(0, 300)}\n`;
      } catch { /* ignore */ }
    }
    
    // Look for meta description
    const metaDesc = html.match(/<meta name="description" content="([^"]+)"/);
    if (metaDesc) {
      info += `FlashScore: ${metaDesc[1]}\n`;
    }
    
    // Extract any injury/absence related content
    const absencePatterns = [
      /bless[ée]/gi, /absent/gi, /suspendu/gi, /indisponible/gi,
      /injured/gi, /suspended/gi, /doubtful/gi, /unavailable/gi,
    ];
    
    // Search in text content
    const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const pattern of absencePatterns) {
      const matches = textContent.match(new RegExp(`.{0,80}${pattern.source}.{0,80}`, 'gi'));
      if (matches) {
        info += matches.slice(0, 3).map(m => `  - ${m.trim()}`).join('\n') + '\n';
      }
    }
    
    return info ? `FlashScore absences ${teamName}:\n${info}` : "";
  } catch (err) {
    console.error(`  ✗ FS-Abs-${teamName.slice(0,10)}: ${(err as Error).message}`);
    return "";
  }
}

// 13. Web search for injuries/news (using free search APIs)
async function fetchInjuriesAndNews(homeTeam: string, awayTeam: string, leagueName: string): Promise<string> {
  let results = "";

  // Try DuckDuckGo instant answers (free, no API key)
  const queries = [
    `${homeTeam} blessures absences composition`,
    `${awayTeam} blessures absences composition`,
    `${homeTeam} vs ${awayTeam} pronostic compo`,
  ];

  for (const query of queries) {
    try {
      const data = await simpleFetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`,
        `DDG-${query.slice(0, 15)}`
      );
      if (data?.AbstractText) {
        results += `\n${data.AbstractText}`;
      }
      if (data?.RelatedTopics?.length) {
        const relevant = data.RelatedTopics.slice(0, 3);
        relevant.forEach((t: any) => {
          if (t.Text) results += `\n  - ${t.Text.slice(0, 200)}`;
        });
      }
    } catch { /* ignore */ }
  }

  return results ? `Informations web récentes:\n${results}` : "";
}

// 14. ESPN Match-specific details (rosters, odds from ESPN)
async function fetchESPNMatchDetails(homeTeam: string, awayTeam: string, leagueId: number, matchDate: string): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "";
  const dateFormatted = matchDate.split('T')[0].replace(/-/g, '');
  const data = await simpleFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateFormatted}`,
    "ESPN-MatchDetail"
  );
  if (!data?.events?.length) return "";

  const homeKw = homeTeam.toLowerCase().split(' ')[0];
  const awayKw = awayTeam.toLowerCase().split(' ')[0];

  const event = data.events.find((e: any) => {
    const comps = e.competitions?.[0]?.competitors || [];
    return comps.some((c: any) => c.team?.displayName?.toLowerCase().includes(homeKw)) &&
           comps.some((c: any) => c.team?.displayName?.toLowerCase().includes(awayKw));
  });

  if (!event) return "";

  let txt = "";
  const comp = event.competitions[0];

  // Check for odds
  if (comp.odds?.length) {
    const odd = comp.odds[0];
    txt += `Cotes ESPN: ${odd.details || ''} | O/U: ${odd.overUnder || '?'}\n`;
    if (odd.homeTeamOdds) txt += `  ${homeTeam}: ${odd.homeTeamOdds.summary || '?'}\n`;
    if (odd.awayTeamOdds) txt += `  ${awayTeam}: ${odd.awayTeamOdds.summary || '?'}\n`;
  }

  // Check for team form/records in competition
  comp.competitors?.forEach((c: any) => {
    if (c.records?.length) {
      const name = c.team?.displayName || '?';
      txt += `${name} records: ${c.records.map((r: any) => `${r.name}: ${r.summary}`).join(', ')}\n`;
    }
  });

  // Headlines
  if (comp.headlines?.length) {
    txt += `Actualités: ${comp.headlines.map((h: any) => h.shortLinkText).join(', ')}\n`;
  }

  return txt;
}

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

    // ══════════ ALL FREE DATA (parallel wave 1) ══════════
    console.log(`\n🆓 Fetching free data sources (wave 1)...`);

    const [
      espnStandings,
      homeTeamTSDB, awayTeamTSDB,
      tsdbH2H, tsdbTable,
      weatherTxt, leagueStatsTxt,
      espnHomeStats, espnAwayStats,
      espnHomeResults, espnAwayResults,
      fdukStats,
      espnMatchDetails,
      injuriesNews,
      homeTeamFS, awayTeamFS,
      fsMatchPreview,
      fsAbsencesHome, fsAbsencesAway,
    ] = await Promise.all([
      fetchESPNStandings(match.league_id, currentSeason),
      fetchTheSportsDBTeam(match.home_team_name),
      fetchTheSportsDBTeam(match.away_team_name),
      fetchTheSportsDBH2H(match.home_team_name, match.away_team_name),
      fetchTheSportsDBTable(match.league_id, seasonStr),
      fetchMatchWeather(match.venue_city || match.league_country, match.kickoff),
      fetchLeagueStats(match.league_id),
      fetchESPNTeamStats(match.home_team_name, match.league_id),
      fetchESPNTeamStats(match.away_team_name, match.league_id),
      fetchESPNTeamResults(match.home_team_name, match.league_id),
      fetchESPNTeamResults(match.away_team_name, match.league_id),
      fetchFootballDataUK(match.league_id, currentSeason, match.home_team_name, match.away_team_name),
      fetchESPNMatchDetails(match.home_team_name, match.away_team_name, match.league_id, match.kickoff),
      fetchInjuriesAndNews(match.home_team_name, match.away_team_name, match.league_name),
      searchFlashScoreTeam(match.home_team_name),
      searchFlashScoreTeam(match.away_team_name),
      fetchFlashScoreMatchPreview(match.home_team_name, match.away_team_name),
      fetchFlashScoreAbsences(match.home_team_name),
      fetchFlashScoreAbsences(match.away_team_name),
    ]);

    // Wave 2: depends on team IDs (TheSportsDB + FlashScore)
    console.log(`\n🆓 Fetching free data sources (wave 2)...`);
    const [homeEventsTxt, awayEventsTxt, homeLineup, awayLineup, homePlayers, awayPlayers, fsHomeForm, fsAwayForm] = await Promise.all([
      fetchTheSportsDBEvents(homeTeamTSDB.id, match.home_team_name),
      fetchTheSportsDBEvents(awayTeamTSDB.id, match.away_team_name),
      fetchTheSportsDBLineup(homeTeamTSDB.id, match.home_team_name),
      fetchTheSportsDBLineup(awayTeamTSDB.id, match.away_team_name),
      fetchTheSportsDBPlayers(homeTeamTSDB.id, match.home_team_name),
      fetchTheSportsDBPlayers(awayTeamTSDB.id, match.away_team_name),
      fetchFlashScoreTeamForm(homeTeamFS?.id || '', match.home_team_name),
      fetchFlashScoreTeamForm(awayTeamFS?.id || '', match.away_team_name),
    ]);

    // ══════════ FORMAT DATA ══════════
    console.log(`\n📝 Formatting data...`);

    let standingsTxt = espnStandings || "";
    if (tsdbTable) standingsTxt += standingsTxt ? `\n\n${tsdbTable}` : tsdbTable;
    if (!standingsTxt) standingsTxt = "Classement non disponible";

    let recentFormTxt = "";
    if (espnHomeResults) recentFormTxt += `${match.home_team_name}:\n${espnHomeResults}`;
    if (espnAwayResults) recentFormTxt += `\n${match.away_team_name}:\n${espnAwayResults}`;
    if (homeEventsTxt) recentFormTxt += `\n\n${homeEventsTxt}`;
    if (awayEventsTxt) recentFormTxt += `\n\n${awayEventsTxt}`;
    if (!recentFormTxt) recentFormTxt = "Forme récente non disponible";

    // FlashScore form data
    let flashScoreFormTxt = "";
    if (fsHomeForm) flashScoreFormTxt += fsHomeForm;
    if (fsAwayForm) flashScoreFormTxt += (flashScoreFormTxt ? "\n\n" : "") + fsAwayForm;

    // FlashScore absences
    let flashScoreAbsTxt = "";
    if (fsAbsencesHome) flashScoreAbsTxt += fsAbsencesHome;
    if (fsAbsencesAway) flashScoreAbsTxt += (flashScoreAbsTxt ? "\n\n" : "") + fsAbsencesAway;

    // FlashScore match preview
    const flashScorePreviewTxt = fsMatchPreview || "";

    const h2hTxt = tsdbH2H || "H2H non disponible";
    const teamInfoTxt = [homeTeamTSDB.info, awayTeamTSDB.info, espnHomeStats, espnAwayStats].filter(Boolean).join("\n\n") || "Non disponible";

    let lineupsTxt = "";
    if (homeLineup) lineupsTxt += homeLineup;
    if (awayLineup) lineupsTxt += (lineupsTxt ? "\n\n" : "") + awayLineup;
    if (!lineupsTxt) lineupsTxt = "Compositions non disponibles";

    let playersTxt = "";
    if (homePlayers) playersTxt += homePlayers;
    if (awayPlayers) playersTxt += (playersTxt ? "\n\n" : "") + awayPlayers;

    // Count sources
    let srcCount = 1;
    const check = (ok: boolean) => { if (ok) srcCount++; };
    check(!standingsTxt.includes("non disponible"));
    check(!!recentFormTxt && !recentFormTxt.includes("non disponible"));
    check(!h2hTxt.includes("non disponible"));
    check(!!(homeTeamTSDB.info || awayTeamTSDB.info));
    check(!!weatherTxt);
    check(!!leagueStatsTxt);
    check(!!(homeEventsTxt || awayEventsTxt));
    check(!!(espnHomeStats || espnAwayStats));
    check(!!fdukStats);
    check(!!(homeLineup || awayLineup));
    check(!!playersTxt);
    check(!!espnMatchDetails);
    check(!!injuriesNews);

    console.log(`\n📊 ${srcCount} data sources collected`);

    // ══════════ AI PROMPT ══════════
    const HOME = match.home_team_name;
    const AWAY = match.away_team_name;

    const systemPrompt = `Tu es un analyste football d'élite. Données RÉELLES saison ${currentSeason}/${currentSeason + 1}.

RÈGLES STRICTES:
1. N'invente JAMAIS de données
2. Probabilités en 0-100 (65 = 65%, PAS 0.65). home_win + draw + away_win = 100
3. Pondération: Forme 20%, Stats détaillées (tirs, corners, cotes) 20%, Classement 15%, H2H 15%, Effectif/Compo 15%, Météo/Dom 10%, Calendrier 5%
4. Séries victoires/défaites = facteur MAJEUR
5. IMPORTANT: Dans TOUS les textes, utilise toujours "${HOME}" au lieu de "domicile"/"l'équipe à domicile" et "${AWAY}" au lieu de "extérieur"/"l'équipe visiteur". Nomme TOUJOURS les équipes par leur NOM.
6. Prends en compte la météo si disponible
7. Prends en compte le calendrier (congestion de matchs = fatigue)
8. Utilise les STATS DÉTAILLÉES (tirs cadrés, corners, fautes, cartons)
9. Utilise les COTES BOOKMAKERS pour valider/invalider tes prédictions
10. Réponds en français
11. IMPORTANT pour "data_quality_assessment": Évalue la qualité des données SANS JAMAIS mentionner de nom d'API/site/source.
12. IMPORTANT "suggested_bets": Tu DOIS TOUJOURS fournir au minimum 3 paris suggérés et au maximum 6. Ce sont les paris les plus sécurisés basés sur l'analyse. Pour chaque pari, donne le type (1X2, BTTS, O/U 2.5, Score exact, Mi-temps, etc.), la sélection exacte, la probabilité, le niveau de confiance et un raisonnement détaillé utilisant les NOMS des équipes.
13. Pour les sections team_a_analysis et team_b_analysis, utilise les NOMS des équipes "${HOME}" et "${AWAY}".
14. Analyse les COMPOSITIONS et EFFECTIFS disponibles pour identifier les forces/faiblesses.
15. Prends en compte les ABSENCES et BLESSURES si l'information est disponible.`;

    const userPrompt = `ANALYSE ULTRA-COMPLÈTE — ${HOME} vs ${AWAY}
${match.league_name} (${match.league_country}) — ${match.league_round || '?'}
📅 ${match.kickoff} | 🏟 ${match.venue_name || '?'}, ${match.venue_city || ''}

══ CLASSEMENT SAISON ${currentSeason}/${currentSeason + 1} ══
${standingsTxt}

══ FORME RÉCENTE & SÉRIES ══
${recentFormTxt}

══ CONFRONTATIONS DIRECTES ══
${h2hTxt}

══ STATS DÉTAILLÉES SAISON (tirs, corners, cartons, cotes) ══
${fdukStats || "Non disponible"}

══ COMPOSITIONS & DERNIÈRES COMPOS CONNUES ══
${lineupsTxt}

══ EFFECTIFS COMPLETS ══
${playersTxt || "Non disponible"}

══ INFOS ESPN SPÉCIFIQUES AU MATCH ══
${espnMatchDetails || "Non disponible"}

══ BLESSURES, ABSENCES & ACTUALITÉS ══
${injuriesNews || "Non disponible - l'IA doit se baser sur les données d'effectif disponibles"}

══ MÉTÉO AU STADE ══
${weatherTxt || "Non disponible"}

══ MOYENNES DE LA LIGUE ══
${leagueStatsTxt || "Non disponible"}

══ INFOS ÉQUIPES (stade, coach, histoire) ══
${teamInfoTxt}

⚠️ RAPPELS:
- Probabilités en 0-100. home+draw+away=100
- Utilise TOUJOURS "${HOME}" et "${AWAY}" dans tes textes, JAMAIS "domicile"/"extérieur"
- Tu DOIS fournir entre 3 et 6 suggested_bets avec des raisonnements détaillés
- Analyse TOUTES les données disponibles (stats, compos, effectifs, météo, calendrier)
- data_quality_assessment: NE MENTIONNE AUCUN NOM DE SOURCE`;

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
                    summary: { type: "string", description: "Résumé utilisant les NOMS des équipes" },
                    team_a_analysis: { type: "string", description: `Analyse détaillée de ${HOME}` },
                    team_b_analysis: { type: "string", description: `Analyse détaillée de ${AWAY}` },
                    tactical_analysis: { type: "string", description: "Analyse tactique du match" },
                    injuries_impact: { type: "string", description: "Impact des absences/blessures" },
                    context_stakes: { type: "string", description: "Enjeux et contexte" },
                    key_factors: { type: "array", items: { type: "object", properties: { name:{type:"string"}, impact:{type:"string",enum:["high","medium","low"]}, direction:{type:"string",enum:["home","away","neutral"]}, description:{type:"string"} }, required:["name","impact","direction","description"], additionalProperties:false } },
                    suggested_bets: { type: "array", description: "OBLIGATOIRE: 3 à 6 paris suggérés", items: { type: "object", properties: { bet_type:{type:"string",description:"Type: 1X2, BTTS, O/U 2.5, Score exact, Mi-temps, etc."}, selection:{type:"string",description:"Sélection avec noms d'équipes"}, probability:{type:"number",description:"0-100"}, confidence:{type:"string",enum:["very_high","high","medium"]}, reasoning:{type:"string",description:"Raisonnement détaillé avec noms d'équipes"} }, required:["bet_type","selection","probability","confidence","reasoning"], additionalProperties:false } },
                    missing_variables: { type: "array", items: { type: "string" } },
                    data_quality_assessment: { type: "string" },
                  },
                  required: ["summary","team_a_analysis","team_b_analysis","tactical_analysis","injuries_impact","context_stakes","key_factors","suggested_bets","missing_variables","data_quality_assessment"],
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
    const quality = Math.min(100, Math.round((srcCount / 14) * 100));
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
