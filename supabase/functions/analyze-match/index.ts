import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: safe fetch with timeout
async function safeFetch(url: string, headers: Record<string, string>, timeoutMs = 8000): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { match_id, analysis_type } = await req.json();

    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) throw new Error("RAPIDAPI_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get match from database
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match_id)
      .single();

    if (matchError || !match) {
      throw new Error(`Match not found: ${matchError?.message || "No data"}`);
    }

    console.log(`Analyzing match: ${match.home_team_name} vs ${match.away_team_name}`);

    // 2. Create analysis record
    const { data: analysisRow, error: insertError } = await supabase
      .from("analyses")
      .insert({
        match_id: match.id,
        status: "generating",
        analysis_type: analysis_type || "full",
      })
      .select()
      .single();

    if (insertError) throw new Error(`Failed to create analysis: ${insertError.message}`);

    // 3. Calculate current football season (Aug-Jul cycle)
    const matchDate = new Date(match.kickoff);
    const year = matchDate.getFullYear();
    const month = matchDate.getMonth();
    const currentSeason = month >= 7 ? year : year - 1;

    const apiHeaders = {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "v3.football.api-sports.io",
    };

    const BASE = "https://v3.football.api-sports.io";

    // 4. Fetch ALL available data sources in parallel
    console.log(`Fetching data for season ${currentSeason}...`);

    const [
      statsData,        // Match statistics (if live/finished)
      h2hData,          // Head-to-head last 15
      standingsData,    // League standings
      oddsData,         // Bookmaker odds
      injuriesHomeData, // Home team injuries
      injuriesAwayData, // Away team injuries
      lastHomeData,     // Home team last 15 matches
      lastAwayData,     // Away team last 15 matches
      predictionsData,  // API-Football's own predictions
      homeStatsData,    // Home team season statistics
      awayStatsData,    // Away team season statistics
      homeHomeData,     // Home team results AT HOME only
      awayAwayData,     // Away team results AWAY only
      leagueTopScorers, // League top scorers
      coachesHomeData,  // Home team coach
      coachesAwayData,  // Away team coach
    ] = await Promise.all([
      safeFetch(`${BASE}/fixtures/statistics?fixture=${match.api_fixture_id}`, apiHeaders),
      safeFetch(`${BASE}/fixtures/headtohead?h2h=${match.home_team_id}-${match.away_team_id}&last=15`, apiHeaders),
      safeFetch(`${BASE}/standings?league=${match.league_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/odds?fixture=${match.api_fixture_id}`, apiHeaders),
      safeFetch(`${BASE}/injuries?team=${match.home_team_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/injuries?team=${match.away_team_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/fixtures?team=${match.home_team_id}&last=15&status=FT-AET-PEN`, apiHeaders),
      safeFetch(`${BASE}/fixtures?team=${match.away_team_id}&last=15&status=FT-AET-PEN`, apiHeaders),
      safeFetch(`${BASE}/predictions?fixture=${match.api_fixture_id}`, apiHeaders),
      safeFetch(`${BASE}/teams/statistics?team=${match.home_team_id}&league=${match.league_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/teams/statistics?team=${match.away_team_id}&league=${match.league_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/fixtures?team=${match.home_team_id}&season=${currentSeason}&venue=${match.home_team_id}&last=10`, apiHeaders),
      safeFetch(`${BASE}/fixtures?team=${match.away_team_id}&season=${currentSeason}&last=10`, apiHeaders),
      safeFetch(`${BASE}/players/topscorers?league=${match.league_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/coachs?team=${match.home_team_id}`, apiHeaders),
      safeFetch(`${BASE}/coachs?team=${match.away_team_id}`, apiHeaders),
    ]);

    // Count available data sources
    let sourceCount = 1;
    const sources: string[] = ["fixture_base"];
    const addSource = (data: any, name: string) => {
      if (data?.response?.length > 0 || (data?.response && typeof data.response === 'object' && !Array.isArray(data.response))) {
        sourceCount++;
        sources.push(name);
      }
    };
    addSource(statsData, "match_stats");
    addSource(h2hData, "h2h");
    addSource(standingsData, "standings");
    addSource(oddsData, "odds");
    addSource(injuriesHomeData, "injuries_home");
    addSource(injuriesAwayData, "injuries_away");
    addSource(lastHomeData, "recent_home");
    addSource(lastAwayData, "recent_away");
    addSource(predictionsData, "predictions");
    addSource(homeStatsData, "team_stats_home");
    addSource(awayStatsData, "team_stats_away");
    addSource(leagueTopScorers, "top_scorers");
    addSource(coachesHomeData, "coach_home");
    addSource(coachesAwayData, "coach_away");

    console.log(`Data sources available: ${sourceCount} [${sources.join(", ")}]`);

    // ===== FORMAT ALL DATA =====

    // --- H2H ---
    const h2hSummary = (() => {
      if (!h2hData?.response?.length) return "Aucune confrontation directe disponible";
      let homeWins = 0, draws = 0, awayWins = 0;
      const matches = h2hData.response.map((f: any) => {
        const hg = f.goals.home ?? 0;
        const ag = f.goals.away ?? 0;
        if (f.teams.home.id === match.home_team_id) {
          if (hg > ag) homeWins++; else if (hg === ag) draws++; else awayWins++;
        } else {
          if (ag > hg) homeWins++; else if (hg === ag) draws++; else awayWins++;
        }
        return `  ${f.teams.home.name} ${hg}-${ag} ${f.teams.away.name} (${f.fixture.date?.split("T")[0]})`;
      });
      return `Bilan H2H: ${homeWins}V ${draws}N ${awayWins}D pour ${match.home_team_name}\n${matches.join("\n")}`;
    })();

    // --- Standings with full detail ---
    const standingsSummary = (() => {
      try {
        const standings = standingsData?.response?.[0]?.league?.standings?.[0];
        if (!standings) return "Classement non disponible";
        const fmt = (team: any, name: string) => {
          if (!team) return `${name}: Non trouvé dans le classement`;
          return `${name}: ${team.rank}e / ${standings.length} équipes
  Points: ${team.points} | Matchs: ${team.all.played}
  Bilan global: ${team.all.win}V ${team.all.draw}N ${team.all.lose}D
  Buts marqués: ${team.all.goals.for} | Encaissés: ${team.all.goals.against} | Diff: ${team.goalsDiff}
  À domicile: ${team.home.win}V ${team.home.draw}N ${team.home.lose}D (${team.home.goals.for} BM / ${team.home.goals.against} BE)
  À l'extérieur: ${team.away.win}V ${team.away.draw}N ${team.away.lose}D (${team.away.goals.for} BM / ${team.away.goals.against} BE)
  Forme récente: ${team.form || 'N/A'}
  Description: ${team.description || 'Aucune'}`;
        };
        const homeTeam = standings.find((s: any) => s.team.id === match.home_team_id);
        const awayTeam = standings.find((s: any) => s.team.id === match.away_team_id);
        return `${fmt(homeTeam, match.home_team_name)}\n\n${fmt(awayTeam, match.away_team_name)}`;
      } catch {
        return "Classement non disponible";
      }
    })();

    // --- Odds with multiple bookmakers ---
    const oddsSummary = (() => {
      try {
        const bookmakers = oddsData?.response?.[0]?.bookmakers;
        if (!bookmakers?.length) return "Cotes non disponibles";
        const results: string[] = [];
        for (const bk of bookmakers.slice(0, 3)) {
          const matchWinner = bk.bets?.find((b: any) => b.name === "Match Winner");
          const btts = bk.bets?.find((b: any) => b.name === "Both Teams Score");
          const overUnder = bk.bets?.find((b: any) => b.name === "Goals Over/Under" || b.name === "Over/Under 2.5");
          let line = `${bk.name}: `;
          if (matchWinner) line += `1X2: ${matchWinner.values.map((v: any) => `${v.value}=${v.odd}`).join(" | ")}`;
          if (btts) line += ` | BTTS: ${btts.values.map((v: any) => `${v.value}=${v.odd}`).join(" / ")}`;
          if (overUnder) line += ` | O/U: ${overUnder.values.map((v: any) => `${v.value}=${v.odd}`).join(" / ")}`;
          results.push(line);
        }
        return results.join("\n");
      } catch {
        return "Cotes non disponibles";
      }
    })();

    // --- Injuries ---
    const formatInjuries = (data: any, teamName: string) => {
      try {
        if (!data?.response?.length) return `${teamName}: Aucune blessure/suspension connue`;
        const injuries = data.response.slice(0, 20).map((inj: any) => {
          const player = inj.player?.name || "Joueur inconnu";
          const type = inj.player?.type || "Inconnu";
          const reason = inj.player?.reason || "Raison inconnue";
          return `  - ${player}: ${reason} (${type})`;
        });
        return `${teamName} (${data.response.length} joueurs indisponibles):\n${injuries.join("\n")}`;
      } catch {
        return `${teamName}: Données indisponibles`;
      }
    };
    const injuriesSummary = `${formatInjuries(injuriesHomeData, match.home_team_name)}\n\n${formatInjuries(injuriesAwayData, match.away_team_name)}`;

    // --- Recent form with streaks ---
    const formatRecentForm = (data: any, teamId: number, teamName: string) => {
      try {
        if (!data?.response?.length) return `${teamName}: Aucun résultat récent disponible`;
        const fixtures = data.response.slice(0, 15);
        let currentStreak = { type: '', count: 0 };
        let unbeatenStreak = 0;
        let winlessStreak = 0;
        let cleanSheets = 0;
        let failedToScore = 0;
        let totalGoalsFor = 0;
        let totalGoalsAgainst = 0;

        const results = fixtures.map((f: any, idx: number) => {
          const isHome = f.teams.home.id === teamId;
          const goalsFor = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
          const goalsAgainst = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
          const opponent = isHome ? f.teams.away.name : f.teams.home.name;
          const venue = isHome ? 'Dom' : 'Ext';
          let result = 'N';
          if (goalsFor > goalsAgainst) result = 'V';
          else if (goalsFor < goalsAgainst) result = 'D';

          totalGoalsFor += goalsFor;
          totalGoalsAgainst += goalsAgainst;
          if (goalsAgainst === 0) cleanSheets++;
          if (goalsFor === 0) failedToScore++;

          // Track current streak (from most recent)
          if (idx === 0) { currentStreak = { type: result, count: 1 }; }
          else if (result === currentStreak.type) { currentStreak.count++; }

          return `  ${result} ${goalsFor}-${goalsAgainst} vs ${opponent} (${venue}, ${f.fixture.date?.split("T")[0]}, ${f.league?.name || ''})`;
        });

        const wins = fixtures.filter((_: any, i: number) => results[i].trimStart().startsWith('V')).length;
        const drawsCount = fixtures.filter((_: any, i: number) => results[i].trimStart().startsWith('N')).length;
        const losses = fixtures.filter((_: any, i: number) => results[i].trimStart().startsWith('D')).length;

        // Calculate unbeaten/winless from start
        for (const r of results) {
          if (!r.trimStart().startsWith('D')) unbeatenStreak++; else break;
        }
        for (const r of results) {
          if (!r.trimStart().startsWith('V')) winlessStreak++; else break;
        }

        const avgGoalsFor = (totalGoalsFor / fixtures.length).toFixed(1);
        const avgGoalsAgainst = (totalGoalsAgainst / fixtures.length).toFixed(1);

        const streakLabel = currentStreak.type === 'V' ? 'victoires' : currentStreak.type === 'D' ? 'défaites' : 'nuls';

        return `${teamName} — 15 derniers matchs: ${wins}V ${drawsCount}N ${losses}D
  Série en cours: ${currentStreak.count} ${streakLabel} consécutives
  ${unbeatenStreak > 1 ? `Invaincu depuis ${unbeatenStreak} matchs` : ''}
  ${winlessStreak > 1 ? `Sans victoire depuis ${winlessStreak} matchs` : ''}
  Moyenne buts marqués: ${avgGoalsFor}/match | Encaissés: ${avgGoalsAgainst}/match
  Clean sheets: ${cleanSheets}/${fixtures.length} | N'a pas marqué: ${failedToScore}/${fixtures.length}
  Détail:
${results.join("\n")}`;
      } catch {
        return `${teamName}: Résultats récents indisponibles`;
      }
    };
    const recentFormSummary = `${formatRecentForm(lastHomeData, match.home_team_id, match.home_team_name)}\n\n${formatRecentForm(lastAwayData, match.away_team_id, match.away_team_name)}`;

    // --- Team Season Statistics ---
    const formatTeamStats = (data: any, teamName: string) => {
      try {
        const r = data?.response;
        if (!r) return `${teamName}: Statistiques de saison non disponibles`;
        const goals = r.goals;
        const fixtures = r.fixtures;
        const lineups = r.lineups;
        const cards = r.cards;

        let txt = `${teamName} — Statistiques saison ${currentSeason}/${currentSeason + 1}:
  Matchs joués: ${fixtures?.played?.total ?? '?'} (Dom: ${fixtures?.played?.home ?? '?'}, Ext: ${fixtures?.played?.away ?? '?'})
  Victoires: ${fixtures?.wins?.total ?? '?'} | Nuls: ${fixtures?.draws?.total ?? '?'} | Défaites: ${fixtures?.loses?.total ?? '?'}
  Buts marqués: ${goals?.for?.total?.total ?? '?'} (Moy: ${goals?.for?.average?.total ?? '?'}/match)
  Buts encaissés: ${goals?.against?.total?.total ?? '?'} (Moy: ${goals?.against?.average?.total ?? '?'}/match)`;

        // Goals by time period
        if (goals?.for?.minute) {
          const periods = Object.entries(goals.for.minute).map(([k, v]: [string, any]) => `${k}: ${v.total ?? 0}`).join(", ");
          txt += `\n  Buts marqués par période: ${periods}`;
        }
        if (goals?.against?.minute) {
          const periods = Object.entries(goals.against.minute).map(([k, v]: [string, any]) => `${k}: ${v.total ?? 0}`).join(", ");
          txt += `\n  Buts encaissés par période: ${periods}`;
        }

        // Most used formation
        if (lineups?.length) {
          txt += `\n  Formation principale: ${lineups[0].formation} (${lineups[0].played} matchs)`;
          if (lineups.length > 1) txt += ` | Alternative: ${lineups[1].formation} (${lineups[1].played} matchs)`;
        }

        // Clean sheets & failed to score
        if (r.clean_sheet) {
          txt += `\n  Clean sheets: ${r.clean_sheet.total ?? '?'} (Dom: ${r.clean_sheet.home ?? '?'}, Ext: ${r.clean_sheet.away ?? '?'})`;
        }
        if (r.failed_to_score) {
          txt += `\n  N'a pas marqué: ${r.failed_to_score.total ?? '?'} matchs`;
        }

        // Biggest streaks
        if (r.biggest) {
          txt += `\n  Plus grande série de victoires: ${r.biggest.streak?.wins ?? '?'} | Défaites: ${r.biggest.streak?.loses ?? '?'} | Nuls: ${r.biggest.streak?.draws ?? '?'}`;
          txt += `\n  Plus large victoire: Dom ${r.biggest.wins?.home ?? '?'}, Ext ${r.biggest.wins?.away ?? '?'}`;
          txt += `\n  Plus large défaite: Dom ${r.biggest.loses?.home ?? '?'}, Ext ${r.biggest.loses?.away ?? '?'}`;
        }

        // Penalty stats
        if (r.penalty) {
          txt += `\n  Penaltys: ${r.penalty.scored?.total ?? 0} marqués / ${r.penalty.missed?.total ?? 0} ratés (${r.penalty.scored?.percentage ?? '?'}%)`;
        }

        // Cards
        if (cards) {
          const yellowTotal = cards.yellow ? Object.values(cards.yellow).reduce((acc: number, v: any) => acc + (v.total ?? 0), 0) : '?';
          const redTotal = cards.red ? Object.values(cards.red).reduce((acc: number, v: any) => acc + (v.total ?? 0), 0) : '?';
          txt += `\n  Cartons: ${yellowTotal} jaunes, ${redTotal} rouges`;
        }

        return txt;
      } catch {
        return `${teamName}: Statistiques de saison non disponibles`;
      }
    };
    const teamStatsSummary = `${formatTeamStats(homeStatsData, match.home_team_name)}\n\n${formatTeamStats(awayStatsData, match.away_team_name)}`;

    // --- API-Football Predictions ---
    const predictionsSummary = (() => {
      try {
        const pred = predictionsData?.response?.[0];
        if (!pred) return "Prédictions API-Football non disponibles";
        const p = pred.predictions;
        const comp = pred.comparison;
        let txt = `Prédiction API-Football:
  Conseil: ${p?.advice || 'N/A'}
  Vainqueur probable: ${p?.winner?.name || 'N/A'} (${p?.winner?.comment || ''})
  Score prédit: ${p?.goals?.home ?? '?'}-${p?.goals?.away ?? '?'}`;
        if (comp) {
          txt += `\n  Comparaison des équipes:
    Forme: ${comp.form?.home ?? '?'}% vs ${comp.form?.away ?? '?'}%
    Attaque: ${comp.att?.home ?? '?'}% vs ${comp.att?.away ?? '?'}%
    Défense: ${comp.def?.home ?? '?'}% vs ${comp.def?.away ?? '?'}%
    Poisson: ${comp.poisson_distribution?.home ?? '?'}% vs ${comp.poisson_distribution?.away ?? '?'}%
    H2H: ${comp.h2h?.home ?? '?'}% vs ${comp.h2h?.away ?? '?'}%
    Total: ${comp.total?.home ?? '?'}% vs ${comp.total?.away ?? '?'}%`;
        }
        return txt;
      } catch {
        return "Prédictions API-Football non disponibles";
      }
    })();

    // --- Top Scorers ---
    const topScorersSummary = (() => {
      try {
        if (!leagueTopScorers?.response?.length) return "Meilleurs buteurs non disponibles";
        const top = leagueTopScorers.response.slice(0, 10).map((p: any, i: number) => {
          const player = p.player;
          const stats = p.statistics?.[0];
          return `  ${i + 1}. ${player.name} (${stats?.team?.name}) - ${stats?.goals?.total ?? 0} buts, ${stats?.goals?.assists ?? 0} passes dé.`;
        });
        return `Top 10 buteurs ${match.league_name} ${currentSeason}/${currentSeason + 1}:\n${top.join("\n")}`;
      } catch {
        return "Meilleurs buteurs non disponibles";
      }
    })();

    // --- Coaches ---
    const formatCoach = (data: any, teamName: string) => {
      try {
        const coach = data?.response?.[0];
        if (!coach) return `${teamName}: Coach inconnu`;
        return `${teamName}: ${coach.name} (${coach.nationality || '?'}) - en poste depuis ${coach.career?.[0]?.start || '?'}`;
      } catch {
        return `${teamName}: Coach inconnu`;
      }
    };
    const coachesSummary = `${formatCoach(coachesHomeData, match.home_team_name)}\n${formatCoach(coachesAwayData, match.away_team_name)}`;

    // ===== BUILD THE PROMPT =====
    const systemPrompt = `Tu es un analyste football d'élite, spécialisé dans l'analyse prédictive avancée. Tu travailles pour un cabinet de conseil sportif professionnel. Tu reçois des données RÉELLES et À JOUR de la saison ${currentSeason}/${currentSeason + 1}.

RÈGLES ABSOLUES:
1. Utilise UNIQUEMENT les données fournies ci-dessous — ne suppose JAMAIS de résultats, classements ou stats
2. Les données proviennent d'API-Football en temps réel et correspondent à la saison ${currentSeason}/${currentSeason + 1}
3. Si une donnée manque, dis-le et ajuste ta confiance à la baisse
4. Pondère tes prédictions ainsi:
   - Forme récente (15 derniers matchs + séries): 25%
   - Statistiques de saison (buts, xG, clean sheets): 20%
   - Blessures/Suspensions de joueurs clés: 20%
   - Classement & dynamique dans le championnat: 15%
   - Confrontations directes récentes: 10%
   - Facteur domicile/extérieur: 5%
   - Cotes bookmakers (indicateur marché): 5%
5. Analyse les SÉRIES en cours: une équipe sur 5 victoires consécutives vs une sur 5 défaites est un facteur MAJEUR
6. Identifie les joueurs clés absents et leur impact concret sur le jeu
7. Sois HONNÊTE: si les données sont insuffisantes, indique un confidence score bas
8. Réponds en français`;

    const userPrompt = `ANALYSE COMPLÈTE DU MATCH — Données temps réel saison ${currentSeason}/${currentSeason + 1}

═══════════════════════════════════════
📋 INFORMATIONS DU MATCH
═══════════════════════════════════════
${match.home_team_name} vs ${match.away_team_name}
Compétition: ${match.league_name} (${match.league_country})
Journée: ${match.league_round || "Non spécifiée"}
Date & Heure: ${match.kickoff}
Stade: ${match.venue_name || "Non spécifié"}, ${match.venue_city || ""}

═══════════════════════════════════════
👨‍💼 ENTRAÎNEURS
═══════════════════════════════════════
${coachesSummary}

═══════════════════════════════════════
📊 CLASSEMENT DÉTAILLÉ (saison ${currentSeason}/${currentSeason + 1})
═══════════════════════════════════════
${standingsSummary}

═══════════════════════════════════════
📈 STATISTIQUES COMPLÈTES DE SAISON
═══════════════════════════════════════
${teamStatsSummary}

═══════════════════════════════════════
🔥 FORME RÉCENTE (15 derniers matchs + séries)
═══════════════════════════════════════
${recentFormSummary}

═══════════════════════════════════════
⚔️ CONFRONTATIONS DIRECTES (15 dernières)
═══════════════════════════════════════
${h2hSummary}

═══════════════════════════════════════
🏥 BLESSURES & SUSPENSIONS
═══════════════════════════════════════
${injuriesSummary}

═══════════════════════════════════════
💰 COTES DES BOOKMAKERS
═══════════════════════════════════════
${oddsSummary}

═══════════════════════════════════════
🤖 PRÉDICTIONS API-FOOTBALL (référence croisée)
═══════════════════════════════════════
${predictionsSummary}

═══════════════════════════════════════
⚽ MEILLEURS BUTEURS DU CHAMPIONNAT
═══════════════════════════════════════
${topScorersSummary}

═══════════════════════════════════════
📡 SOURCES DE DONNÉES: ${sourceCount} sources actives [${sources.join(", ")}]
═══════════════════════════════════════

INSTRUCTIONS: Analyse TOUTES les données ci-dessus en profondeur. Porte une attention particulière aux:
- Séries de victoires/défaites en cours
- Performances domicile vs extérieur
- Joueurs clés absents (blessures/suspensions)
- Tendance de buts (over/under, BTTS)
- Croisement avec les prédictions API-Football et les cotes
Fournis une analyse professionnelle et calibrée.`;

    // 5. Call AI
    console.log("Calling Lovable AI for analysis...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_match_analysis",
              description: "Soumet l'analyse complète d'un match de football avec prédictions et rapport.",
              parameters: {
                type: "object",
                properties: {
                  prediction: {
                    type: "object",
                    properties: {
                      home_win_prob: { type: "number", description: "Probabilité victoire domicile (0-100)" },
                      draw_prob: { type: "number", description: "Probabilité match nul (0-100)" },
                      away_win_prob: { type: "number", description: "Probabilité victoire extérieur (0-100)" },
                      predicted_score_home: { type: "integer", description: "Score prédit domicile" },
                      predicted_score_away: { type: "integer", description: "Score prédit extérieur" },
                      expected_goals: { type: "number", description: "Total buts attendus (xG estimé)" },
                      btts_prob: { type: "number", description: "Probabilité BTTS (0-100)" },
                      over_25_prob: { type: "number", description: "Probabilité Over 2.5 (0-100)" },
                      over_15_prob: { type: "number", description: "Probabilité Over 1.5 (0-100)" },
                      under_25_prob: { type: "number", description: "Probabilité Under 2.5 (0-100)" },
                      first_to_score_home: { type: "number", description: "Prob domicile marque en premier (0-100)" },
                      first_to_score_away: { type: "number", description: "Prob extérieur marque en premier (0-100)" },
                      first_to_score_none: { type: "number", description: "Prob 0-0 (0-100)" },
                      confidence: { type: "number", description: "Niveau de confiance global (0-100)" },
                    },
                    required: ["home_win_prob", "draw_prob", "away_win_prob", "predicted_score_home", "predicted_score_away", "expected_goals", "btts_prob", "over_25_prob", "over_15_prob", "under_25_prob", "first_to_score_home", "first_to_score_away", "first_to_score_none", "confidence"],
                    additionalProperties: false,
                  },
                  report: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "Résumé de l'analyse en 4-6 phrases, mentionnant les séries, le classement et les absences clés" },
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
                      missing_variables: {
                        type: "array",
                        items: { type: "string" },
                        description: "Variables manquantes qui auraient amélioré l'analyse",
                      },
                      data_quality_assessment: { type: "string", description: "Évaluation de la qualité et fraîcheur des données disponibles" },
                    },
                    required: ["summary", "key_factors", "missing_variables", "data_quality_assessment"],
                    additionalProperties: false,
                  },
                },
                required: ["prediction", "report"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_match_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        await supabase.from("analyses").update({ status: "error", error_message: "Rate limit exceeded" }).eq("id", analysisRow.id);
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        await supabase.from("analyses").update({ status: "error", error_message: "Payment required" }).eq("id", analysisRow.id);
        return new Response(JSON.stringify({ error: "Payment required, please add credits" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      await supabase.from("analyses").update({ status: "error", error_message: `AI error: ${aiResponse.status}` }).eq("id", analysisRow.id);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      await supabase.from("analyses").update({ status: "error", error_message: "AI did not return structured analysis" }).eq("id", analysisRow.id);
      throw new Error("AI did not return structured analysis");
    }

    let analysisResult;
    try {
      analysisResult = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", toolCall.function.arguments);
      await supabase.from("analyses").update({ status: "error", error_message: "Failed to parse AI response" }).eq("id", analysisRow.id);
      throw new Error("Failed to parse AI response");
    }

    const dataQualityScore = Math.min(100, Math.round((sourceCount / 14) * 100));
    const uncertaintyScore = Math.max(0, 100 - analysisResult.prediction.confidence);

    // 6. Update analysis in database
    const { error: updateError } = await supabase
      .from("analyses")
      .update({
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
      })
      .eq("id", analysisRow.id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Failed to update analysis: ${updateError.message}`);
    }

    const { data: finalAnalysis } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisRow.id)
      .single();

    console.log(`Analysis completed. Sources: ${sourceCount}/14, Quality: ${dataQualityScore}%`);

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
