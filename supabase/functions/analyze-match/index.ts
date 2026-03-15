import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // 3. Fetch additional data from API-Football
    let statsData = null;
    let h2hData = null;
    let standingsData = null;
    let oddsData = null;

    try {
      // Fetch fixture statistics if match has started/finished
      const [statsRes, h2hRes, standingsRes, oddsRes] = await Promise.allSettled([
        fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${match.api_fixture_id}`, {
          headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
        }),
        fetch(`https://v3.football.api-sports.io/fixtures/headtohead?h2h=${match.home_team_id}-${match.away_team_id}&last=10`, {
          headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
        }),
        fetch(`https://v3.football.api-sports.io/standings?league=${match.league_id}&season=2024`, {
          headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
        }),
        fetch(`https://v3.football.api-sports.io/odds?fixture=${match.api_fixture_id}`, {
          headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
        }),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        statsData = await statsRes.value.json();
      }
      if (h2hRes.status === "fulfilled" && h2hRes.value.ok) {
        h2hData = await h2hRes.value.json();
      }
      if (standingsRes.status === "fulfilled" && standingsRes.value.ok) {
        standingsData = await standingsRes.value.json();
      }
      if (oddsRes.status === "fulfilled" && oddsRes.value.ok) {
        oddsData = await oddsRes.value.json();
      }
    } catch (apiErr) {
      console.error("Error fetching additional data:", apiErr);
    }

    // Count available data sources
    let sourceCount = 1; // base fixture data
    if (statsData?.response?.length > 0) sourceCount++;
    if (h2hData?.response?.length > 0) sourceCount++;
    if (standingsData?.response?.length > 0) sourceCount++;
    if (oddsData?.response?.length > 0) sourceCount++;

    // 4. Build comprehensive prompt for AI analysis
    const h2hSummary = h2hData?.response?.length > 0
      ? h2hData.response.slice(0, 10).map((f: any) =>
          `${f.teams.home.name} ${f.goals.home} - ${f.goals.away} ${f.teams.away.name} (${f.fixture.date?.split("T")[0]})`
        ).join("\n")
      : "Aucune confrontation directe disponible";

    const standingsSummary = (() => {
      try {
        const standings = standingsData?.response?.[0]?.league?.standings?.[0];
        if (!standings) return "Classement non disponible";
        const homeTeam = standings.find((s: any) => s.team.id === match.home_team_id);
        const awayTeam = standings.find((s: any) => s.team.id === match.away_team_id);
        let result = "";
        if (homeTeam) {
          result += `${match.home_team_name}: ${homeTeam.rank}e - ${homeTeam.points}pts - ${homeTeam.all.win}V ${homeTeam.all.draw}N ${homeTeam.all.lose}D - BM:${homeTeam.all.goals.for} BE:${homeTeam.all.goals.against} - Forme: ${homeTeam.form}\n`;
        }
        if (awayTeam) {
          result += `${match.away_team_name}: ${awayTeam.rank}e - ${awayTeam.points}pts - ${awayTeam.all.win}V ${awayTeam.all.draw}N ${awayTeam.all.lose}D - BM:${awayTeam.all.goals.for} BE:${awayTeam.all.goals.against} - Forme: ${awayTeam.form}`;
        }
        return result || "Classement non disponible";
      } catch {
        return "Classement non disponible";
      }
    })();

    const oddsSummary = (() => {
      try {
        const bookmaker = oddsData?.response?.[0]?.bookmakers?.[0];
        if (!bookmaker) return "Cotes non disponibles";
        const matchWinner = bookmaker.bets?.find((b: any) => b.name === "Match Winner");
        if (!matchWinner) return "Cotes non disponibles";
        return matchWinner.values.map((v: any) => `${v.value}: ${v.odd}`).join(" | ");
      } catch {
        return "Cotes non disponibles";
      }
    })();

    const systemPrompt = `Tu es un expert en analyse de football et en statistiques sportives avancées. Tu analyses des matchs de football en utilisant toutes les données disponibles pour fournir des prédictions probabilistes précises et honnêtes.

RÈGLES STRICTES:
- Tu dois fournir des probabilités réalistes et calibrées
- Tu ne dois JAMAIS inventer de données - utilise uniquement les données fournies
- Si des données manquent, indique-le clairement et ajuste ton niveau de confiance
- Sois honnête sur les limites de ton analyse
- Fournis une analyse structurée et détaillée en français`;

    const userPrompt = `Analyse ce match de football et fournis une prédiction détaillée.

MATCH:
- ${match.home_team_name} vs ${match.away_team_name}
- Compétition: ${match.league_name} (${match.league_country})
- Date: ${match.kickoff}
- Lieu: ${match.venue_name || "Non spécifié"}, ${match.venue_city || ""}
- Journée: ${match.league_round || "Non spécifiée"}

CLASSEMENT ACTUEL:
${standingsSummary}

CONFRONTATIONS DIRECTES (10 dernières):
${h2hSummary}

COTES DES BOOKMAKERS:
${oddsSummary}

SOURCES DE DONNÉES DISPONIBLES: ${sourceCount}

Basé sur TOUTES les données ci-dessus, fournis ton analyse.`;

    // 5. Call Lovable AI with tool calling for structured output
    console.log("Calling Lovable AI for analysis...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
                      expected_goals: { type: "number", description: "Total buts attendus" },
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
                      summary: { type: "string", description: "Résumé de l'analyse en 3-5 phrases" },
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
                      data_quality_assessment: { type: "string", description: "Évaluation de la qualité des données disponibles" },
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

    // Parse tool call response
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

    // Calculate data quality score
    const dataQualityScore = Math.min(100, sourceCount * 20);
    const uncertaintyScore = Math.max(0, 100 - analysisResult.prediction.confidence);

    // 6. Update analysis in database
    const { error: updateError } = await supabase
      .from("analyses")
      .update({
        status: "completed",
        prediction: analysisResult.prediction,
        report: analysisResult.report,
        raw_response: JSON.stringify(aiData),
        model_version: "gemini-3-flash-preview",
        data_quality_score: dataQualityScore,
        uncertainty_score: uncertaintyScore,
        source_count: sourceCount,
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6h expiry
      })
      .eq("id", analysisRow.id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Failed to update analysis: ${updateError.message}`);
    }

    // 7. Return the complete analysis
    const { data: finalAnalysis } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisRow.id)
      .single();

    console.log("Analysis completed successfully");

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
