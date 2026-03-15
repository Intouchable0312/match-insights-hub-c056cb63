import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function safeFetch(url: string, headers: Record<string, string>, timeoutMs = 10000): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`API error ${res.status} for ${url.split('?')[0]}: ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    // Log response count for debugging
    const count = Array.isArray(data?.response) ? data.response.length : (data?.response ? 'object' : 0);
    console.log(`  ✓ ${url.split('/').pop()?.split('?')[0]}: ${count} results`);
    return data;
  } catch (err) {
    console.error(`  ✗ Fetch failed for ${url.split('?')[0]}:`, err.message);
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) throw new Error("RAPIDAPI_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: match, error: matchError } = await supabase
      .from("matches").select("*").eq("id", match_id).single();
    if (matchError || !match) throw new Error(`Match not found: ${matchError?.message || "No data"}`);

    console.log(`Analyzing match: ${match.home_team_name} vs ${match.away_team_name}`);

    const { data: analysisRow, error: insertError } = await supabase
      .from("analyses")
      .insert({ match_id: match.id, status: "generating", analysis_type: analysis_type || "full" })
      .select().single();
    if (insertError) throw new Error(`Failed to create analysis: ${insertError.message}`);

    // Season calculation
    const matchDate = new Date(match.kickoff);
    const year = matchDate.getFullYear();
    const month = matchDate.getMonth();
    const currentSeason = month >= 7 ? year : year - 1;

    const apiHeaders = { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "v3.football.api-sports.io" };
    const BASE = "https://v3.football.api-sports.io";

    console.log(`Fetching data for season ${currentSeason}...`);

    // Fetch ALL data in parallel - FIXED URLs
    const [
      statsData, h2hData, standingsData, oddsData,
      injuriesHomeData, injuriesAwayData,
      lastHomeData, lastAwayData,
      predictionsData,
      homeStatsData, awayStatsData,
      leagueTopScorers,
      coachesHomeData, coachesAwayData,
    ] = await Promise.all([
      safeFetch(`${BASE}/fixtures/statistics?fixture=${match.api_fixture_id}`, apiHeaders),
      safeFetch(`${BASE}/fixtures/headtohead?h2h=${match.home_team_id}-${match.away_team_id}&last=15`, apiHeaders),
      safeFetch(`${BASE}/standings?league=${match.league_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/odds?fixture=${match.api_fixture_id}`, apiHeaders),
      safeFetch(`${BASE}/injuries?league=${match.league_id}&season=${currentSeason}&team=${match.home_team_id}`, apiHeaders),
      safeFetch(`${BASE}/injuries?league=${match.league_id}&season=${currentSeason}&team=${match.away_team_id}`, apiHeaders),
      // Use season param instead of status filter for recent matches
      safeFetch(`${BASE}/fixtures?team=${match.home_team_id}&season=${currentSeason}&last=15`, apiHeaders),
      safeFetch(`${BASE}/fixtures?team=${match.away_team_id}&season=${currentSeason}&last=15`, apiHeaders),
      safeFetch(`${BASE}/predictions?fixture=${match.api_fixture_id}`, apiHeaders),
      safeFetch(`${BASE}/teams/statistics?team=${match.home_team_id}&league=${match.league_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/teams/statistics?team=${match.away_team_id}&league=${match.league_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/players/topscorers?league=${match.league_id}&season=${currentSeason}`, apiHeaders),
      safeFetch(`${BASE}/coachs?team=${match.home_team_id}`, apiHeaders),
      safeFetch(`${BASE}/coachs?team=${match.away_team_id}`, apiHeaders),
    ]);

    // Count sources
    let sourceCount = 1;
    const sources: string[] = ["fixture_base"];
    const addSource = (data: any, name: string) => {
      const hasData = data?.response && (
        (Array.isArray(data.response) && data.response.length > 0) ||
        (!Array.isArray(data.response) && typeof data.response === 'object')
      );
      if (hasData) { sourceCount++; sources.push(name); }
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

    // ===== FORMAT DATA =====

    const h2hSummary = (() => {
      if (!h2hData?.response?.length) return "Aucune confrontation directe disponible";
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
      return `Bilan H2H: ${homeWins}V ${draws}N ${awayWins}D pour ${match.home_team_name}\n${matches.join("\n")}`;
    })();

    const standingsSummary = (() => {
      try {
        const allStandings = standingsData?.response?.[0]?.league?.standings;
        if (!allStandings) return "Classement non disponible";
        // standings can be array of groups
        const standings = Array.isArray(allStandings[0]) ? allStandings.flat() : allStandings;
        const fmt = (team: any, name: string) => {
          if (!team) return `${name}: Non trouvé dans le classement`;
          return `${name}: ${team.rank}e / ${standings.length} équipes
  Points: ${team.points} | Matchs joués: ${team.all.played}
  Bilan: ${team.all.win}V ${team.all.draw}N ${team.all.lose}D
  Buts: ${team.all.goals.for} marqués, ${team.all.goals.against} encaissés (diff: ${team.goalsDiff})
  Domicile: ${team.home.win}V ${team.home.draw}N ${team.home.lose}D (${team.home.goals.for} BM / ${team.home.goals.against} BE)
  Extérieur: ${team.away.win}V ${team.away.draw}N ${team.away.lose}D (${team.away.goals.for} BM / ${team.away.goals.against} BE)
  Forme: ${team.form || 'N/A'}
  ${team.description ? `Situation: ${team.description}` : ''}`;
        };
        const homeTeam = standings.find((s: any) => s.team.id === match.home_team_id);
        const awayTeam = standings.find((s: any) => s.team.id === match.away_team_id);
        return `${fmt(homeTeam, match.home_team_name)}\n\n${fmt(awayTeam, match.away_team_name)}`;
      } catch { return "Classement non disponible"; }
    })();

    const oddsSummary = (() => {
      try {
        const bookmakers = oddsData?.response?.[0]?.bookmakers;
        if (!bookmakers?.length) return "Cotes non disponibles";
        const results: string[] = [];
        for (const bk of bookmakers.slice(0, 3)) {
          const matchWinner = bk.bets?.find((b: any) => b.name === "Match Winner");
          const btts = bk.bets?.find((b: any) => b.name === "Both Teams Score");
          const ou = bk.bets?.find((b: any) => b.name === "Goals Over/Under");
          let line = `${bk.name}: `;
          if (matchWinner) line += `1X2: ${matchWinner.values.map((v: any) => `${v.value}=${v.odd}`).join(" | ")}`;
          if (btts) line += ` | BTTS: ${btts.values.map((v: any) => `${v.value}=${v.odd}`).join(" / ")}`;
          if (ou) line += ` | O/U: ${ou.values.map((v: any) => `${v.value}=${v.odd}`).join(" / ")}`;
          results.push(line);
        }
        return results.join("\n");
      } catch { return "Cotes non disponibles"; }
    })();

    const formatInjuries = (data: any, teamName: string) => {
      try {
        if (!data?.response?.length) return `${teamName}: Aucune blessure/suspension connue`;
        return `${teamName} (${data.response.length} joueurs):\n` +
          data.response.slice(0, 20).map((inj: any) =>
            `  - ${inj.player?.name || "?"}: ${inj.player?.reason || "?"} (${inj.player?.type || "?"})`
          ).join("\n");
      } catch { return `${teamName}: Données indisponibles`; }
    };
    const injuriesSummary = `${formatInjuries(injuriesHomeData, match.home_team_name)}\n\n${formatInjuries(injuriesAwayData, match.away_team_name)}`;

    const formatRecentForm = (data: any, teamId: number, teamName: string) => {
      try {
        if (!data?.response?.length) return `${teamName}: Aucun résultat récent`;
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
          return `  ${r} ${gf}-${ga} vs ${opp} (${venue}, ${f.fixture.date?.split("T")[0]}, ${f.league?.name || ''})`;
        });

        const wins = results.filter((r: string) => r.trimStart().startsWith('V')).length;
        const drawsC = results.filter((r: string) => r.trimStart().startsWith('N')).length;
        const losses = results.filter((r: string) => r.trimStart().startsWith('D')).length;
        const streakLabel = currentStreak.type === 'V' ? 'victoires' : currentStreak.type === 'D' ? 'défaites' : 'nuls';

        return `${teamName} — ${fixtures.length} derniers matchs: ${wins}V ${drawsC}N ${losses}D
  Série en cours: ${currentStreak.count} ${streakLabel} consécutives
  Moyenne buts: ${(totalGF / fixtures.length).toFixed(1)} marqués / ${(totalGA / fixtures.length).toFixed(1)} encaissés par match
  Clean sheets: ${cleanSheets}/${fixtures.length} | Sans marquer: ${failedToScore}/${fixtures.length}
${results.join("\n")}`;
      } catch { return `${teamName}: Résultats récents indisponibles`; }
    };
    const recentFormSummary = `${formatRecentForm(lastHomeData, match.home_team_id, match.home_team_name)}\n\n${formatRecentForm(lastAwayData, match.away_team_id, match.away_team_name)}`;

    const formatTeamStats = (data: any, teamName: string) => {
      try {
        const r = data?.response;
        if (!r) return `${teamName}: Stats saison non disponibles`;
        const g = r.goals, f = r.fixtures, l = r.lineups;
        let txt = `${teamName} — Saison ${currentSeason}/${currentSeason + 1}:
  Matchs: ${f?.played?.total ?? '?'} (Dom: ${f?.played?.home ?? '?'}, Ext: ${f?.played?.away ?? '?'})
  V/N/D: ${f?.wins?.total ?? '?'}/${f?.draws?.total ?? '?'}/${f?.loses?.total ?? '?'}
  Buts marqués: ${g?.for?.total?.total ?? '?'} (Moy: ${g?.for?.average?.total ?? '?'}/m)
  Buts encaissés: ${g?.against?.total?.total ?? '?'} (Moy: ${g?.against?.average?.total ?? '?'}/m)`;
        if (g?.for?.minute) {
          txt += `\n  Buts par période: ${Object.entries(g.for.minute).map(([k, v]: [string, any]) => `${k}:${v.total ?? 0}`).join(", ")}`;
        }
        if (l?.length) {
          txt += `\n  Formation: ${l[0].formation} (${l[0].played}x)${l.length > 1 ? ` | Alt: ${l[1].formation} (${l[1].played}x)` : ''}`;
        }
        if (r.clean_sheet) txt += `\n  Clean sheets: ${r.clean_sheet.total ?? '?'}`;
        if (r.failed_to_score) txt += `\n  Sans marquer: ${r.failed_to_score.total ?? '?'} matchs`;
        if (r.biggest) {
          txt += `\n  Plus grande série: ${r.biggest.streak?.wins ?? '?'}V, ${r.biggest.streak?.draws ?? '?'}N, ${r.biggest.streak?.loses ?? '?'}D`;
        }
        if (r.penalty) {
          txt += `\n  Penaltys: ${r.penalty.scored?.total ?? 0} marqués / ${r.penalty.missed?.total ?? 0} ratés`;
        }
        if (r.cards) {
          const y = r.cards.yellow ? Object.values(r.cards.yellow).reduce((a: number, v: any) => a + (v.total ?? 0), 0) : '?';
          const red = r.cards.red ? Object.values(r.cards.red).reduce((a: number, v: any) => a + (v.total ?? 0), 0) : '?';
          txt += `\n  Cartons: ${y} jaunes, ${red} rouges`;
        }
        return txt;
      } catch { return `${teamName}: Stats saison non disponibles`; }
    };
    const teamStatsSummary = `${formatTeamStats(homeStatsData, match.home_team_name)}\n\n${formatTeamStats(awayStatsData, match.away_team_name)}`;

    const predictionsSummary = (() => {
      try {
        const pred = predictionsData?.response?.[0];
        if (!pred) return "Prédictions API non disponibles";
        const p = pred.predictions, c = pred.comparison;
        let txt = `Conseil: ${p?.advice || 'N/A'}\nVainqueur: ${p?.winner?.name || '?'} (${p?.winner?.comment || ''})\nScore: ${p?.goals?.home ?? '?'}-${p?.goals?.away ?? '?'}`;
        if (c) {
          txt += `\nComparaison: Forme ${c.form?.home}%-${c.form?.away}% | Att ${c.att?.home}%-${c.att?.away}% | Déf ${c.def?.home}%-${c.def?.away}% | Total ${c.total?.home}%-${c.total?.away}%`;
        }
        return txt;
      } catch { return "Prédictions API non disponibles"; }
    })();

    const topScorersSummary = (() => {
      try {
        if (!leagueTopScorers?.response?.length) return "Top buteurs non disponibles";
        return leagueTopScorers.response.slice(0, 10).map((p: any, i: number) => {
          const s = p.statistics?.[0];
          return `  ${i + 1}. ${p.player.name} (${s?.team?.name}) - ${s?.goals?.total ?? 0}B, ${s?.goals?.assists ?? 0}PD`;
        }).join("\n");
      } catch { return "Top buteurs non disponibles"; }
    })();

    const formatCoach = (data: any, teamName: string) => {
      try {
        if (!data?.response?.length) return `${teamName}: Coach inconnu`;
        const c = data.response[0];
        return `${teamName}: ${c.name} (${c.nationality || '?'})`;
      } catch { return `${teamName}: Coach inconnu`; }
    };
    const coachesSummary = `${formatCoach(coachesHomeData, match.home_team_name)}\n${formatCoach(coachesAwayData, match.away_team_name)}`;

    // ===== PROMPT =====
    const systemPrompt = `Tu es un analyste football d'élite. Données RÉELLES saison ${currentSeason}/${currentSeason + 1}.

RÈGLES:
1. Utilise UNIQUEMENT les données fournies — JAMAIS d'invention
2. Pondération: Forme récente 25%, Stats saison 20%, Blessures 20%, Classement 15%, H2H 10%, Dom/Ext 5%, Cotes 5%
3. Analyse les SÉRIES (victoires/défaites consécutives) comme facteur majeur
4. Sois HONNÊTE sur les limites — confiance basse si données manquantes
5. Pour les paris suggérés: ne recommande QUE des paris avec probabilité > 60% et justifie chaque suggestion
6. Réponds en français`;

    const userPrompt = `ANALYSE MATCH — Saison ${currentSeason}/${currentSeason + 1}

📋 MATCH: ${match.home_team_name} vs ${match.away_team_name}
Compétition: ${match.league_name} (${match.league_country}) — ${match.league_round || "?"}
Date: ${match.kickoff} | Stade: ${match.venue_name || "?"}, ${match.venue_city || ""}

👨‍💼 COACHES: ${coachesSummary}

📊 CLASSEMENT:
${standingsSummary}

📈 STATS SAISON:
${teamStatsSummary}

🔥 FORME RÉCENTE:
${recentFormSummary}

⚔️ H2H:
${h2hSummary}

🏥 BLESSURES:
${injuriesSummary}

💰 COTES: ${oddsSummary}

🤖 PRÉDICTIONS API: ${predictionsSummary}

⚽ TOP BUTEURS: ${topScorersSummary}

📡 SOURCES: ${sourceCount}/14 [${sources.join(", ")}]

Analyse TOUTES ces données et fournis ton analyse + paris sécurisés.`;

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
            description: "Analyse complète avec prédictions et paris suggérés",
            parameters: {
              type: "object",
              properties: {
                prediction: {
                  type: "object",
                  properties: {
                    home_win_prob: { type: "number" },
                    draw_prob: { type: "number" },
                    away_win_prob: { type: "number" },
                    predicted_score_home: { type: "integer" },
                    predicted_score_away: { type: "integer" },
                    expected_goals: { type: "number" },
                    btts_prob: { type: "number" },
                    over_25_prob: { type: "number" },
                    over_15_prob: { type: "number" },
                    under_25_prob: { type: "number" },
                    first_to_score_home: { type: "number" },
                    first_to_score_away: { type: "number" },
                    first_to_score_none: { type: "number" },
                    confidence: { type: "number" },
                  },
                  required: ["home_win_prob", "draw_prob", "away_win_prob", "predicted_score_home", "predicted_score_away", "expected_goals", "btts_prob", "over_25_prob", "over_15_prob", "under_25_prob", "first_to_score_home", "first_to_score_away", "first_to_score_none", "confidence"],
                  additionalProperties: false,
                },
                report: {
                  type: "object",
                  properties: {
                    summary: { type: "string", description: "Résumé en 4-6 phrases" },
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
                      description: "Paris sécurisés recommandés avec justification",
                      items: {
                        type: "object",
                        properties: {
                          bet_type: { type: "string", description: "Type de pari (ex: 1X2, Over/Under, BTTS, Double chance, etc.)" },
                          selection: { type: "string", description: "Sélection précise (ex: 'Plus de 1.5 buts', 'Double chance 1X')" },
                          probability: { type: "number", description: "Probabilité estimée (0-100)" },
                          confidence: { type: "string", enum: ["very_high", "high", "medium"], description: "Niveau de confiance" },
                          reasoning: { type: "string", description: "Justification courte basée sur les données" },
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
      if (status === 429 || status === 402) {
        const msg = status === 429 ? "Rate limit exceeded" : "Payment required";
        await supabase.from("analyses").update({ status: "error", error_message: msg }).eq("id", analysisRow.id);
        return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      await supabase.from("analyses").update({ status: "error", error_message: `AI error: ${status}` }).eq("id", analysisRow.id);
      throw new Error(`AI error: ${status}`);
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

    // Sanitize prediction values - ensure integers where needed
    if (analysisResult.prediction) {
      analysisResult.prediction.predicted_score_home = Math.round(analysisResult.prediction.predicted_score_home ?? 0);
      analysisResult.prediction.predicted_score_away = Math.round(analysisResult.prediction.predicted_score_away ?? 0);
    }

    const dataQualityScore = Math.min(100, Math.round((sourceCount / 14) * 100));
    const uncertaintyScore = Math.round(Math.max(0, 100 - (analysisResult.prediction?.confidence ?? 50)));

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
    console.log(`Analysis done. Sources: ${sourceCount}/14, Quality: ${dataQualityScore}%`);

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
