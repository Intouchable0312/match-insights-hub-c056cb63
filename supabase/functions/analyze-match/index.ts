import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ====== SAFE FETCH WITH LOGGING ======
async function safeFetch(url: string, headers: Record<string, string>, label: string, timeoutMs = 10000): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const body = await res.text();
      console.error(`  ✗ ${label}: HTTP ${res.status} - ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const count = Array.isArray(data?.response) ? data.response.length : (data?.response ? 'obj' : 0);
    console.log(`  ✓ ${label}: ${count} results`);
    return data;
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
    return null;
  }
}

// ====== FREE ESPN API FOR STANDINGS & SCORES ======
const LEAGUE_ESPN_MAP: Record<number, string> = {
  // API-Football league_id -> ESPN slug
  61: 'fra.1',    // Ligue 1
  39: 'eng.1',    // Premier League
  140: 'esp.1',   // La Liga
  135: 'ita.1',   // Serie A
  78: 'ger.1',    // Bundesliga
  2: 'uefa.champions',  // Champions League
  3: 'uefa.europa',     // Europa League
  848: 'uefa.europa.conf', // Conference League
  94: 'por.1',    // Liga Portugal
  88: 'ned.1',    // Eredivisie
  144: 'bel.1',   // Jupiler Pro League
  203: 'tur.1',   // Super Lig
  179: 'sco.1',   // Scottish Premiership
  63: 'fra.2',    // Ligue 2
  40: 'eng.2',    // Championship
};

async function fetchESPNStandings(leagueId: number, season: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return "Classement non disponible (ligue non supportée en mode gratuit)";
  try {
    const url = `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${season}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) { await res.text(); return "Classement ESPN non disponible"; }
    const data = await res.json();
    
    const entries = data?.children?.[0]?.standings?.entries;
    if (!entries?.length) return "Classement ESPN vide";
    
    return entries.slice(0, 20).map((e: any) => {
      const team = e.team;
      const stats = e.stats || [];
      const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value ?? '?';
      return `${getStat('rank')}. ${team.displayName} - ${getStat('points')}pts | ${getStat('wins')}V ${getStat('draws')}N ${getStat('losses')}D | BM:${getStat('pointsFor')} BE:${getStat('pointsAgainst')} | Diff:${getStat('pointDifferential')}`;
    }).join("\n");
  } catch (err) {
    console.error(`  ✗ ESPN standings: ${err.message}`);
    return "Classement non disponible";
  }
}

async function fetchESPNTeamForm(teamName: string, leagueId: number, season: number): Promise<string> {
  const slug = LEAGUE_ESPN_MAP[leagueId];
  if (!slug) return `${teamName}: Forme non disponible (ligue non supportée)`;
  try {
    // Get recent scores from ESPN
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${season}0801-${season + 1}0630&limit=100`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) { await res.text(); return `${teamName}: Résultats ESPN non disponibles`; }
    const data = await res.json();
    
    const events = data?.events;
    if (!events?.length) return `${teamName}: Aucun résultat ESPN`;
    
    // Filter completed events for this team
    const teamEvents = events
      .filter((e: any) => e.status?.type?.completed && 
        e.competitions?.[0]?.competitors?.some((c: any) => 
          c.team?.displayName?.toLowerCase().includes(teamName.toLowerCase().split(' ')[0])
        ))
      .slice(-15);
    
    if (!teamEvents.length) return `${teamName}: Aucun résultat trouvé sur ESPN`;
    
    const results = teamEvents.map((e: any) => {
      const comp = e.competitions[0];
      const home = comp.competitors.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors.find((c: any) => c.homeAway === 'away');
      return `  ${home?.team?.abbreviation} ${home?.score}-${away?.score} ${away?.team?.abbreviation} (${e.date?.split('T')[0]})`;
    });
    
    return `${teamName} - Résultats récents (ESPN):\n${results.join("\n")}`;
  } catch (err) {
    console.error(`  ✗ ESPN form ${teamName}: ${err.message}`);
    return `${teamName}: Résultats non disponibles`;
  }
}

// ====== FREE WEB SCRAPING FOR ADDITIONAL DATA ======
async function scrapeTransfermarktValue(teamName: string): Promise<string> {
  // Use a simple search to get team market value info
  try {
    const searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
    const res = await fetch(searchUrl);
    if (!res.ok) { await res.text(); return ""; }
    const data = await res.json();
    const team = data?.teams?.[0];
    if (!team) return "";
    return `${teamName}: Fondé en ${team.intFormedYear || '?'}, Stade: ${team.strStadium || '?'} (${team.intStadiumCapacity || '?'} places), ${team.strDescriptionFR?.slice(0, 200) || team.strDescriptionEN?.slice(0, 200) || ''}`;
  } catch {
    return "";
  }
}

async function fetchFreeH2H(homeTeam: string, awayTeam: string): Promise<string> {
  try {
    // TheSportsDB free API for past events
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(homeTeam)}_vs_${encodeURIComponent(awayTeam)}`;
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return ""; }
    const data = await res.json();
    const events = data?.event;
    if (!events?.length) return "";
    
    return "H2H (TheSportsDB):\n" + events.slice(0, 10).map((e: any) => 
      `  ${e.strHomeTeam} ${e.intHomeScore ?? '?'}-${e.intAwayScore ?? '?'} ${e.strAwayTeam} (${e.dateEvent || '?'})`
    ).join("\n");
  } catch {
    return "";
  }
}

// ====== NORMALIZE AI VALUES ======
function normalizePrediction(prediction: any): any {
  const probFields = [
    'home_win_prob', 'draw_prob', 'away_win_prob',
    'btts_prob', 'over_25_prob', 'over_15_prob', 'under_25_prob',
    'first_to_score_home', 'first_to_score_away', 'first_to_score_none',
    'confidence'
  ];
  
  // Check if values seem to be in 0-1 range (majority are <= 1)
  const smallCount = probFields.filter(f => Math.abs(prediction[f] ?? 0) <= 1.01).length;
  const needsScale = smallCount >= probFields.length * 0.7;
  
  if (needsScale) {
    console.log("  ⚠️ Normalizing probabilities from 0-1 to 0-100 range");
    probFields.forEach(f => {
      if (prediction[f] != null) {
        prediction[f] = Math.round(prediction[f] * 10000) / 100; // e.g. 0.55 -> 55
      }
    });
  }
  
  // Ensure scores are integers
  prediction.predicted_score_home = Math.round(prediction.predicted_score_home ?? 0);
  prediction.predicted_score_away = Math.round(prediction.predicted_score_away ?? 0);
  
  // Ensure probabilities are in valid range
  probFields.forEach(f => {
    if (prediction[f] != null) {
      prediction[f] = Math.max(0, Math.min(100, Math.round(prediction[f] * 100) / 100));
    }
  });
  
  // Ensure 1X2 probabilities sum to ~100
  const sum1x2 = (prediction.home_win_prob || 0) + (prediction.draw_prob || 0) + (prediction.away_win_prob || 0);
  if (sum1x2 > 0 && (sum1x2 < 90 || sum1x2 > 110)) {
    const factor = 100 / sum1x2;
    prediction.home_win_prob = Math.round(prediction.home_win_prob * factor * 100) / 100;
    prediction.draw_prob = Math.round(prediction.draw_prob * factor * 100) / 100;
    prediction.away_win_prob = Math.round(prediction.away_win_prob * factor * 100) / 100;
  }
  
  return prediction;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { match_id, analysis_type } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: match, error: matchError } = await supabase
      .from("matches").select("*").eq("id", match_id).single();
    if (matchError || !match) throw new Error(`Match not found: ${matchError?.message}`);

    console.log(`\n══════════════════════════════════════`);
    console.log(`Analyzing: ${match.home_team_name} vs ${match.away_team_name}`);
    console.log(`League: ${match.league_name} (ID: ${match.league_id})`);
    console.log(`══════════════════════════════════════`);

    const { data: analysisRow, error: insertError } = await supabase
      .from("analyses")
      .insert({ match_id: match.id, status: "generating", analysis_type: analysis_type || "full" })
      .select().single();
    if (insertError) throw new Error(`Failed to create analysis: ${insertError.message}`);

    const matchDate = new Date(match.kickoff);
    const year = matchDate.getFullYear();
    const month = matchDate.getMonth();
    const currentSeason = month >= 7 ? year : year - 1;

    // ====== PHASE 1: API-Football (paid, may fail) ======
    let h2hData = null, standingsData = null, oddsData = null;
    let injuriesHomeData = null, injuriesAwayData = null;
    let lastHomeData = null, lastAwayData = null;
    let predictionsData = null, homeStatsData = null, awayStatsData = null;

    if (RAPIDAPI_KEY) {
      console.log(`\n📡 Phase 1: API-Football (season ${currentSeason})...`);
      const apiHeaders = { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "v3.football.api-sports.io" };
      const BASE = "https://v3.football.api-sports.io";

      const results = await Promise.all([
        safeFetch(`${BASE}/fixtures/headtohead?h2h=${match.home_team_id}-${match.away_team_id}&last=10`, apiHeaders, "H2H"),
        safeFetch(`${BASE}/standings?league=${match.league_id}&season=${currentSeason}`, apiHeaders, "Standings"),
        safeFetch(`${BASE}/odds?fixture=${match.api_fixture_id}`, apiHeaders, "Odds"),
        safeFetch(`${BASE}/injuries?league=${match.league_id}&season=${currentSeason}&team=${match.home_team_id}`, apiHeaders, "Injuries-Home"),
        safeFetch(`${BASE}/injuries?league=${match.league_id}&season=${currentSeason}&team=${match.away_team_id}`, apiHeaders, "Injuries-Away"),
        safeFetch(`${BASE}/fixtures?team=${match.home_team_id}&season=${currentSeason}&last=10`, apiHeaders, "Last-Home"),
        safeFetch(`${BASE}/fixtures?team=${match.away_team_id}&season=${currentSeason}&last=10`, apiHeaders, "Last-Away"),
        safeFetch(`${BASE}/predictions?fixture=${match.api_fixture_id}`, apiHeaders, "Predictions"),
        safeFetch(`${BASE}/teams/statistics?team=${match.home_team_id}&league=${match.league_id}&season=${currentSeason}`, apiHeaders, "Stats-Home"),
        safeFetch(`${BASE}/teams/statistics?team=${match.away_team_id}&league=${match.league_id}&season=${currentSeason}`, apiHeaders, "Stats-Away"),
      ]);

      [h2hData, standingsData, oddsData, injuriesHomeData, injuriesAwayData,
       lastHomeData, lastAwayData, predictionsData, homeStatsData, awayStatsData] = results;
    } else {
      console.log("⚠️ No RAPIDAPI_KEY, skipping API-Football");
    }

    // ====== PHASE 2: FREE FALLBACKS ======
    console.log(`\n🆓 Phase 2: Free data sources...`);

    // Standings fallback
    let standingsTxt = "";
    const hasAPIStandings = standingsData?.response?.[0]?.league?.standings;
    if (hasAPIStandings) {
      const allStandings = standingsData.response[0].league.standings;
      const flat = Array.isArray(allStandings[0]) ? allStandings.flat() : allStandings;
      const fmt = (team: any, name: string) => {
        if (!team) return `${name}: Non classé`;
        return `${name}: ${team.rank}e/${flat.length} - ${team.points}pts | ${team.all.played}J ${team.all.win}V ${team.all.draw}N ${team.all.lose}D | BM:${team.all.goals.for} BE:${team.all.goals.against} Diff:${team.goalsDiff}
  Dom: ${team.home.win}V ${team.home.draw}N ${team.home.lose}D (${team.home.goals.for}BM/${team.home.goals.against}BE)
  Ext: ${team.away.win}V ${team.away.draw}N ${team.away.lose}D (${team.away.goals.for}BM/${team.away.goals.against}BE)
  Forme: ${team.form || 'N/A'}`;
      };
      const homeTeam = flat.find((s: any) => s.team.id === match.home_team_id);
      const awayTeam = flat.find((s: any) => s.team.id === match.away_team_id);
      standingsTxt = `${fmt(homeTeam, match.home_team_name)}\n\n${fmt(awayTeam, match.away_team_name)}`;
      console.log("  ✓ Standings from API-Football");
    } else {
      console.log("  → Falling back to ESPN for standings...");
      standingsTxt = await fetchESPNStandings(match.league_id, currentSeason);
      if (standingsTxt.includes("non disponible") || standingsTxt.includes("vide")) {
        // Try with season+1 for ESPN (they may use calendar year)
        const alt = await fetchESPNStandings(match.league_id, currentSeason + 1);
        if (!alt.includes("non disponible")) standingsTxt = alt;
      }
    }

    // Recent form fallback
    let recentFormTxt = "";
    const hasRecentHome = lastHomeData?.response?.length > 0;
    const hasRecentAway = lastAwayData?.response?.length > 0;

    const formatRecentForm = (data: any, teamId: number, teamName: string) => {
      const fixtures = data.response.slice(0, 15);
      let currentStreak = { type: '', count: 0 };
      let cleanSheets = 0, failedToScore = 0, totalGF = 0, totalGA = 0;
      const results = fixtures.map((f: any, idx: number) => {
        const isHome = f.teams.home.id === teamId;
        const gf = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
        const ga = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
        const opp = isHome ? f.teams.away.name : f.teams.home.name;
        const venue = isHome ? 'Dom' : 'Ext';
        const r = gf > ga ? 'V' : gf < ga ? 'D' : 'N';
        totalGF += gf; totalGA += ga;
        if (ga === 0) cleanSheets++;
        if (gf === 0) failedToScore++;
        if (idx === 0) currentStreak = { type: r, count: 1 };
        else if (r === currentStreak.type && currentStreak.count === idx) currentStreak.count++;
        return `  ${r} ${gf}-${ga} vs ${opp} (${venue}, ${f.fixture.date?.split("T")[0]})`;
      });
      const wins = results.filter((r: string) => r.trimStart().startsWith('V')).length;
      const drawsC = results.filter((r: string) => r.trimStart().startsWith('N')).length;
      const losses = results.filter((r: string) => r.trimStart().startsWith('D')).length;
      const streakLabel = currentStreak.type === 'V' ? 'victoires' : currentStreak.type === 'D' ? 'défaites' : 'nuls';
      return `${teamName} — ${fixtures.length} derniers matchs: ${wins}V ${drawsC}N ${losses}D
  🔥 Série en cours: ${currentStreak.count} ${streakLabel} consécutives
  Moy buts: ${(totalGF / fixtures.length).toFixed(1)} marqués / ${(totalGA / fixtures.length).toFixed(1)} encaissés
  Clean sheets: ${cleanSheets}/${fixtures.length} | Sans marquer: ${failedToScore}/${fixtures.length}
${results.join("\n")}`;
    };

    if (hasRecentHome && hasRecentAway) {
      recentFormTxt = `${formatRecentForm(lastHomeData, match.home_team_id, match.home_team_name)}\n\n${formatRecentForm(lastAwayData, match.away_team_id, match.away_team_name)}`;
      console.log("  ✓ Recent form from API-Football");
    } else {
      console.log("  → Falling back to ESPN for recent form...");
      const [homeForm, awayForm] = await Promise.all([
        fetchESPNTeamForm(match.home_team_name, match.league_id, currentSeason),
        fetchESPNTeamForm(match.away_team_name, match.league_id, currentSeason),
      ]);
      recentFormTxt = `${homeForm}\n\n${awayForm}`;
    }

    // H2H fallback
    let h2hTxt = "";
    if (h2hData?.response?.length) {
      let homeWins = 0, draws = 0, awayWins = 0;
      const matches = h2hData.response.map((f: any) => {
        const hg = f.goals.home ?? 0, ag = f.goals.away ?? 0;
        if (f.teams.home.id === match.home_team_id) {
          if (hg > ag) homeWins++; else if (hg === ag) draws++; else awayWins++;
        } else {
          if (ag > hg) homeWins++; else if (hg === ag) draws++; else awayWins++;
        }
        return `  ${f.teams.home.name} ${hg}-${ag} ${f.teams.away.name} (${f.fixture.date?.split("T")[0]})`;
      });
      h2hTxt = `Bilan: ${homeWins}V ${draws}N ${awayWins}D pour ${match.home_team_name}\n${matches.join("\n")}`;
      console.log("  ✓ H2H from API-Football");
    } else {
      console.log("  → Falling back to TheSportsDB for H2H...");
      h2hTxt = await fetchFreeH2H(match.home_team_name, match.away_team_name);
      if (!h2hTxt) h2hTxt = "Confrontations directes non disponibles";
    }

    // Team info from TheSportsDB (always free)
    const [homeTeamInfo, awayTeamInfo] = await Promise.all([
      scrapeTransfermarktValue(match.home_team_name),
      scrapeTransfermarktValue(match.away_team_name),
    ]);
    const teamInfoTxt = [homeTeamInfo, awayTeamInfo].filter(Boolean).join("\n") || "Infos équipes non disponibles";

    // Injuries
    const formatInjuries = (data: any, teamName: string) => {
      if (!data?.response?.length) return `${teamName}: Aucune blessure/suspension connue`;
      return `${teamName} (${data.response.length}):\n` +
        data.response.slice(0, 15).map((inj: any) =>
          `  - ${inj.player?.name || "?"}: ${inj.player?.reason || "?"} (${inj.player?.type || "?"})`
        ).join("\n");
    };
    const injuriesTxt = `${formatInjuries(injuriesHomeData, match.home_team_name)}\n${formatInjuries(injuriesAwayData, match.away_team_name)}`;

    // Odds
    const oddsTxt = (() => {
      const bookmakers = oddsData?.response?.[0]?.bookmakers;
      if (!bookmakers?.length) return "Cotes non disponibles";
      return bookmakers.slice(0, 3).map((bk: any) => {
        const mw = bk.bets?.find((b: any) => b.name === "Match Winner");
        const btts = bk.bets?.find((b: any) => b.name === "Both Teams Score");
        const ou = bk.bets?.find((b: any) => b.name === "Goals Over/Under");
        let line = `${bk.name}: `;
        if (mw) line += `1X2: ${mw.values.map((v: any) => `${v.value}=${v.odd}`).join(" | ")}`;
        if (btts) line += ` | BTTS: ${btts.values.map((v: any) => `${v.value}=${v.odd}`).join("/")}`;
        if (ou) line += ` | O/U: ${ou.values.map((v: any) => `${v.value}=${v.odd}`).join("/")}`;
        return line;
      }).join("\n");
    })();

    // Predictions
    const predTxt = (() => {
      const pred = predictionsData?.response?.[0];
      if (!pred) return "Prédictions API non disponibles";
      const p = pred.predictions, c = pred.comparison;
      let txt = `Conseil: ${p?.advice || '?'} | Vainqueur: ${p?.winner?.name || '?'} | Score: ${p?.goals?.home ?? '?'}-${p?.goals?.away ?? '?'}`;
      if (c) txt += `\nForme ${c.form?.home}%-${c.form?.away}% | Att ${c.att?.home}%-${c.att?.away}% | Déf ${c.def?.home}%-${c.def?.away}%`;
      return txt;
    })();

    // Team season stats
    const formatTeamStats = (data: any, teamName: string) => {
      const r = data?.response;
      if (!r) return `${teamName}: Stats non disponibles`;
      const g = r.goals, f = r.fixtures, l = r.lineups;
      let txt = `${teamName}:
  ${f?.played?.total ?? '?'}J - ${f?.wins?.total ?? '?'}V ${f?.draws?.total ?? '?'}N ${f?.loses?.total ?? '?'}D
  Buts: ${g?.for?.total?.total ?? '?'} marqués (${g?.for?.average?.total ?? '?'}/m), ${g?.against?.total?.total ?? '?'} encaissés (${g?.against?.average?.total ?? '?'}/m)`;
      if (l?.length) txt += `\n  Formation: ${l[0].formation} (${l[0].played}x)`;
      if (r.clean_sheet) txt += `\n  Clean sheets: ${r.clean_sheet.total ?? '?'}`;
      if (r.biggest?.streak) txt += `\n  Séries max: ${r.biggest.streak.wins ?? '?'}V, ${r.biggest.streak.loses ?? '?'}D`;
      if (r.penalty) txt += `\n  Pénaltys: ${r.penalty.scored?.total ?? 0}/${(r.penalty.scored?.total ?? 0) + (r.penalty.missed?.total ?? 0)}`;
      return txt;
    };
    const statsTxt = (homeStatsData?.response || awayStatsData?.response)
      ? `${formatTeamStats(homeStatsData, match.home_team_name)}\n\n${formatTeamStats(awayStatsData, match.away_team_name)}`
      : "Statistiques de saison non disponibles";

    // Count sources
    let sourceCount = 1;
    const sources: string[] = ["fixture"];
    if (!standingsTxt.includes("non disponible")) { sourceCount++; sources.push("standings"); }
    if (recentFormTxt && !recentFormTxt.includes("non disponible")) { sourceCount++; sources.push("form"); }
    if (!h2hTxt.includes("non disponible")) { sourceCount++; sources.push("h2h"); }
    if (injuriesHomeData?.response?.length || injuriesAwayData?.response?.length) { sourceCount++; sources.push("injuries"); }
    if (oddsData?.response?.length) { sourceCount++; sources.push("odds"); }
    if (predictionsData?.response?.length) { sourceCount++; sources.push("predictions"); }
    if (homeStatsData?.response || awayStatsData?.response) { sourceCount++; sources.push("team_stats"); }
    if (homeTeamInfo || awayTeamInfo) { sourceCount++; sources.push("team_info"); }

    console.log(`\n📊 Total sources: ${sourceCount} [${sources.join(", ")}]`);

    // ====== BUILD PROMPT ======
    const systemPrompt = `Tu es un analyste football professionnel. Données RÉELLES saison ${currentSeason}/${currentSeason + 1}.

RÈGLES ABSOLUES:
1. N'invente JAMAIS de données. Utilise UNIQUEMENT ce qui est fourni.
2. Toutes les probabilités doivent être entre 0 et 100 (ex: 65 = 65%, PAS 0.65)
3. home_win_prob + draw_prob + away_win_prob DOIVENT totaliser exactement 100
4. Pondération: Forme récente 25%, Stats saison 20%, Blessures 20%, Classement 15%, H2H 10%, Dom/Ext 5%, Cotes 5%
5. Analyse les SÉRIES de victoires/défaites comme facteur MAJEUR
6. Pour les paris: recommande UNIQUEMENT les paris avec probabilité > 55%, justifie chacun
7. Confiance basse si données insuffisantes
8. Réponds en français`;

    const userPrompt = `ANALYSE COMPLÈTE — ${match.home_team_name} vs ${match.away_team_name}
${match.league_name} (${match.league_country}) — ${match.league_round || '?'}
📅 ${match.kickoff} | 🏟 ${match.venue_name || '?'}, ${match.venue_city || ''}

══ CLASSEMENT ══
${standingsTxt}

══ STATS SAISON ══
${statsTxt}

══ FORME RÉCENTE ══
${recentFormTxt}

══ CONFRONTATIONS DIRECTES ══
${h2hTxt}

══ BLESSURES & SUSPENSIONS ══
${injuriesTxt}

══ COTES BOOKMAKERS ══
${oddsTxt}

══ PRÉDICTIONS API ══
${predTxt}

══ INFOS ÉQUIPES ══
${teamInfoTxt}

📡 Sources: ${sourceCount} [${sources.join(", ")}]

IMPORTANT: Les probabilités DOIVENT être sur une échelle 0-100 (ex: 65 signifie 65%). Le total 1X2 doit faire 100.
Analyse tout et fournis paris sécurisés.`;

    console.log("Calling AI...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_match_analysis",
            description: "Analyse complète. TOUTES les probabilités sont sur échelle 0-100.",
            parameters: {
              type: "object",
              properties: {
                prediction: {
                  type: "object",
                  properties: {
                    home_win_prob: { type: "number", description: "Probabilité victoire domicile (0-100, ex: 45 = 45%)" },
                    draw_prob: { type: "number", description: "Probabilité nul (0-100)" },
                    away_win_prob: { type: "number", description: "Probabilité victoire extérieur (0-100)" },
                    predicted_score_home: { type: "number", description: "Score prédit domicile (entier)" },
                    predicted_score_away: { type: "number", description: "Score prédit extérieur (entier)" },
                    expected_goals: { type: "number", description: "Total buts attendus" },
                    btts_prob: { type: "number", description: "Probabilité BTTS (0-100)" },
                    over_25_prob: { type: "number", description: "Probabilité Over 2.5 (0-100)" },
                    over_15_prob: { type: "number", description: "Probabilité Over 1.5 (0-100)" },
                    under_25_prob: { type: "number", description: "Probabilité Under 2.5 (0-100)" },
                    first_to_score_home: { type: "number", description: "Prob domicile marque en premier (0-100)" },
                    first_to_score_away: { type: "number", description: "Prob extérieur marque en premier (0-100)" },
                    first_to_score_none: { type: "number", description: "Prob 0-0 (0-100)" },
                    confidence: { type: "number", description: "Confiance globale (0-100)" },
                  },
                  required: ["home_win_prob", "draw_prob", "away_win_prob", "predicted_score_home", "predicted_score_away", "expected_goals", "btts_prob", "over_25_prob", "over_15_prob", "under_25_prob", "first_to_score_home", "first_to_score_away", "first_to_score_none", "confidence"],
                  additionalProperties: false,
                },
                report: {
                  type: "object",
                  properties: {
                    summary: { type: "string" },
                    key_factors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          impact: { type: "string", enum: ["high", "medium", "low"] },
                          direction: { type: "string", enum: ["home", "away", "neutral"] },
                          description: { type: "string" },
                        },
                        required: ["name", "impact", "direction", "description"],
                        additionalProperties: false,
                      },
                    },
                    suggested_bets: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          bet_type: { type: "string" },
                          selection: { type: "string" },
                          probability: { type: "number", description: "0-100" },
                          confidence: { type: "string", enum: ["very_high", "high", "medium"] },
                          reasoning: { type: "string" },
                        },
                        required: ["bet_type", "selection", "probability", "confidence", "reasoning"],
                        additionalProperties: false,
                      },
                    },
                    missing_variables: { type: "array", items: { type: "string" } },
                    data_quality_assessment: { type: "string" },
                  },
                  required: ["summary", "key_factors", "suggested_bets", "missing_variables", "data_quality_assessment"],
                  additionalProperties: false,
                },
              },
              required: ["prediction", "report"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_match_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const msg = status === 429 ? "Rate limit" : status === 402 ? "Payment required" : `AI error ${status}`;
      await supabase.from("analyses").update({ status: "error", error_message: msg }).eq("id", analysisRow.id);
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error(msg);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      await supabase.from("analyses").update({ status: "error", error_message: "No structured response" }).eq("id", analysisRow.id);
      throw new Error("No structured response from AI");
    }

    let analysisResult;
    try {
      analysisResult = JSON.parse(toolCall.function.arguments);
    } catch {
      await supabase.from("analyses").update({ status: "error", error_message: "Parse error" }).eq("id", analysisRow.id);
      throw new Error("Failed to parse AI response");
    }

    // ====== NORMALIZE VALUES ======
    analysisResult.prediction = normalizePrediction(analysisResult.prediction);

    const dataQualityScore = Math.min(100, Math.round((sourceCount / 9) * 100));
    const uncertaintyScore = Math.round(Math.max(0, 100 - (analysisResult.prediction?.confidence ?? 50)));

    console.log(`Prediction: ${analysisResult.prediction.home_win_prob}% / ${analysisResult.prediction.draw_prob}% / ${analysisResult.prediction.away_win_prob}%`);
    console.log(`Bets suggested: ${analysisResult.report?.suggested_bets?.length || 0}`);

    const { error: updateError } = await supabase.from("analyses").update({
      status: "completed",
      prediction: analysisResult.prediction,
      report: analysisResult.report,
      raw_response: JSON.stringify(aiData),
      model_version: "gemini-2.5-flash",
      data_quality_score: dataQualityScore,
      uncertainty_score: uncertaintyScore,
      source_count: sourceCount,
      completed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    }).eq("id", analysisRow.id);

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    const { data: finalAnalysis } = await supabase.from("analyses").select("*").eq("id", analysisRow.id).single();
    console.log(`✅ Analysis done. Sources: ${sourceCount}, Quality: ${dataQualityScore}%\n`);

    return new Response(JSON.stringify({ analysis: finalAnalysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-match error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
