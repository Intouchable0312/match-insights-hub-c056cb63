import { DbAnalysis } from '@/lib/api';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Target, AlertTriangle, Database, Clock,
  ArrowUp, ArrowDown, Minus, Users, Swords, Flag,
  ShieldAlert, FileText, ChevronDown, Lightbulb, Shield,
  Zap
} from 'lucide-react';

interface RealAnalysisReportProps {
  analysis: DbAnalysis;
  homeTeamName?: string;
  awayTeamName?: string;
}

export function RealAnalysisReport({ analysis, homeTeamName, awayTeamName }: RealAnalysisReportProps) {
  const prediction = analysis.prediction;
  const report = analysis.report;
  const [showFull, setShowFull] = useState(false);

  if (!prediction || !report) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <p className="text-muted-foreground font-medium">Données d'analyse incomplètes.</p>
      </div>
    );
  }

  const homeName = homeTeamName || 'Équipe domicile';
  const awayName = awayTeamName || 'Équipe extérieur';

  // Extract suggested bets from report
  const suggestedBets: { type: string; explanation: string; confidence: string }[] =
    report.suggested_bets || report.paris_suggeres || [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* ─── 1. PARIS SUGGÉRÉS ─── */}
      {suggestedBets.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display font-black text-lg flex items-center gap-2 px-1">
            <Lightbulb className="h-5 w-5 text-warning" /> Paris suggérés
          </h2>
          <div className="grid gap-3">
            {suggestedBets.map((bet, i) => (
              <BetCard key={i} index={i + 1} bet={bet} />
            ))}
          </div>
        </section>
      )}

      {/* ─── 2. ANALYSE RAPIDE (VISIBLE) ─── */}
      <section className="space-y-3">
        <h2 className="font-display font-black text-lg flex items-center gap-2 px-1">
          <TrendingUp className="h-5 w-5 text-primary" /> Analyse du match
        </h2>

        {/* Probabilities */}
        <div className="grid grid-cols-3 gap-3">
          <ProbCard label={homeName} value={prediction.home_win_prob} isMax={prediction.home_win_prob >= prediction.draw_prob && prediction.home_win_prob >= prediction.away_win_prob} />
          <ProbCard label="Nul" value={prediction.draw_prob} isMax={prediction.draw_prob > prediction.home_win_prob && prediction.draw_prob > prediction.away_win_prob} />
          <ProbCard label={awayName} value={prediction.away_win_prob} isMax={prediction.away_win_prob > prediction.home_win_prob && prediction.away_win_prob > prediction.draw_prob} />
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Score probable" value={`${prediction.predicted_score_home} - ${prediction.predicted_score_away}`} />
          <StatCard label="Buts attendus" value={prediction.expected_goals?.toFixed(1) || '?'} />
          <StatCard label="BTTS" value={`${prediction.btts_prob}%`} />
          <StatCard label="Over 2.5" value={`${prediction.over_25_prob}%`} />
        </div>

        {/* Team A analysis */}
        {report.team_a_analysis && (
          <ReportSection
            icon={<Flag className="h-4 w-4 text-primary" />}
            title={`Analyse ${homeName}`}
            content={report.team_a_analysis}
          />
        )}

        {/* Team B analysis */}
        {report.team_b_analysis && (
          <ReportSection
            icon={<Flag className="h-4 w-4 text-info" />}
            title={`Analyse ${awayName}`}
            content={report.team_b_analysis}
          />
        )}

        {/* Injuries Impact */}
        {report.injuries_impact && (
          <ReportSection
            icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
            title="Impact des blessures"
            content={report.injuries_impact}
          />
        )}

        {/* Tactical Analysis */}
        {report.tactical_analysis && (
          <ReportSection
            icon={<Swords className="h-4 w-4 text-warning" />}
            title="Analyse tactique"
            content={report.tactical_analysis}
          />
        )}
      </section>

      {/* ─── 3. BOUTON VOIR L'ANALYSE COMPLÈTE ─── */}
      <Button
        variant="outline"
        className="w-full h-12 rounded-2xl gap-2 font-display font-bold text-base"
        onClick={() => setShowFull(!showFull)}
      >
        <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${showFull ? 'rotate-180' : ''}`} />
        {showFull ? "Masquer l'analyse complète" : "Voir l'analyse complète"}
      </Button>

      {/* ─── 4. ANALYSE COMPLÈTE (CACHÉE PAR DÉFAUT) ─── */}
      <AnimatePresence>
        {showFull && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Additional stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Over 1.5" value={`${prediction.over_15_prob}%`} />
              <StatCard label="Under 2.5" value={`${prediction.under_25_prob}%`} />
              <StatCard label="Confiance" value={`${prediction.confidence}%`} accent />
            </div>

            {/* First to score */}
            <div className="glass rounded-3xl p-5">
              <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">Premier but</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-primary/10 rounded-2xl p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">{homeName}</p>
                  <p className="font-display font-black text-xl text-primary">{prediction.first_to_score_home}%</p>
                </div>
                <div className="flex-1 bg-surface rounded-2xl p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">{awayName}</p>
                  <p className="font-display font-black text-xl">{prediction.first_to_score_away}%</p>
                </div>
                <div className="flex-1 bg-surface/50 rounded-2xl p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">0-0</p>
                  <p className="font-display font-black text-xl text-muted-foreground">{prediction.first_to_score_none}%</p>
                </div>
              </div>
            </div>

            {/* Summary */}
            {report.summary && (
              <ReportSection
                icon={<TrendingUp className="h-4 w-4 text-primary" />}
                title="Rapport d'analyse"
                content={report.summary}
              />
            )}

            {/* Probable Lineups */}
            {report.probable_lineups && (
              <ReportSection icon={<Users className="h-4 w-4 text-success" />} title="Compositions probables" content={report.probable_lineups} />
            )}

            {/* Context & Stakes */}
            {report.context_stakes && (
              <ReportSection icon={<Target className="h-4 w-4 text-primary" />} title="Enjeu & contexte" content={report.context_stakes} />
            )}

            {/* Key Factors */}
            {report.key_factors?.length > 0 && (
              <div className="glass rounded-3xl p-5">
                <h3 className="font-display font-bold text-base mb-4">Facteurs clés</h3>
                <div className="space-y-3">
                  {report.key_factors.map((f: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-xl bg-surface flex items-center justify-center shrink-0 mt-0.5">
                        {f.direction === 'home' ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> :
                         f.direction === 'away' ? <ArrowDown className="h-3.5 w-3.5 text-info" /> :
                         <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-display font-bold text-sm">{f.name}</span>
                          <Badge className={`text-[10px] px-2 py-0 rounded-full border-none font-semibold ${
                            f.impact === 'high' ? 'bg-primary/15 text-primary' :
                            f.impact === 'medium' ? 'bg-warning/15 text-warning' :
                            'bg-surface text-muted-foreground'
                          }`}>
                            {f.impact}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data quality */}
            {report.data_quality_assessment && (
              <ReportSection icon={<Database className="h-4 w-4 text-info" />} title="Qualité des données" content={report.data_quality_assessment} />
            )}

            {/* Confidence Notes */}
            {report.confidence_notes && (
              <ReportSection icon={<FileText className="h-4 w-4 text-muted-foreground" />} title="Notes de confiance" content={report.confidence_notes} />
            )}

            {/* Missing variables */}
            {report.missing_variables?.length > 0 && (
              <div className="glass rounded-3xl p-5 border-warning/20">
                <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" /> Variables manquantes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {report.missing_variables.map((v: string, i: number) => (
                    <Badge key={i} className="text-xs bg-warning/10 text-warning border-none rounded-full px-3 py-1">{v}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground px-1">
              {analysis.model_version && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {analysis.model_version}</span>}
              {analysis.data_quality_score != null && <span>Qualité : {analysis.data_quality_score}/100</span>}
              {analysis.source_count != null && <span>{analysis.source_count} sources</span>}
              {analysis.completed_at && <span>{new Date(analysis.completed_at).toLocaleString('fr-FR')}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Sub-components ─── */

function BetCard({ index, bet }: { index: number; bet: { type: string; explanation: string; confidence: string } }) {
  const confidenceConfig = {
    high: { label: 'Élevée', bg: 'bg-success/15', text: 'text-success', icon: <Shield className="h-3.5 w-3.5" /> },
    élevée: { label: 'Élevée', bg: 'bg-success/15', text: 'text-success', icon: <Shield className="h-3.5 w-3.5" /> },
    medium: { label: 'Moyenne', bg: 'bg-warning/15', text: 'text-warning', icon: <Zap className="h-3.5 w-3.5" /> },
    moyenne: { label: 'Moyenne', bg: 'bg-warning/15', text: 'text-warning', icon: <Zap className="h-3.5 w-3.5" /> },
    low: { label: 'Faible', bg: 'bg-destructive/15', text: 'text-destructive', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    faible: { label: 'Faible', bg: 'bg-destructive/15', text: 'text-destructive', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  };

  const conf = confidenceConfig[(bet.confidence || '').toLowerCase() as keyof typeof confidenceConfig]
    || confidenceConfig.medium;

  return (
    <div className="glass rounded-2xl p-4 flex items-start gap-4">
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <span className="font-display font-black text-primary text-lg">{index}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-sm">{bet.type}</p>
        <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{bet.explanation}</p>
      </div>
      <Badge className={`${conf.bg} ${conf.text} border-none rounded-full px-2.5 py-1 text-[10px] font-bold flex items-center gap-1 shrink-0`}>
        {conf.icon} {conf.label}
      </Badge>
    </div>
  );
}

function ReportSection({ icon, title, content }: { icon: React.ReactNode; title: string; content: string }) {
  return (
    <div className="glass rounded-3xl p-5">
      <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
        {icon} {title}
      </h3>
      <p className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}

function ProbCard({ label, value, isMax }: { label: string; value: number; isMax: boolean }) {
  return (
    <div className={`glass rounded-3xl p-5 text-center transition-all ${isMax ? 'bg-primary/5 border-primary/20' : ''}`}>
      <p className="text-[11px] text-muted-foreground mb-1 font-semibold truncate">{label}</p>
      <p className={`font-display font-black text-3xl ${isMax ? 'text-primary' : 'text-foreground'}`}>{Math.round(value)}%</p>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-4 text-center ${accent ? 'bg-primary/5 border-primary/20' : ''}`}>
      <p className="text-[11px] text-muted-foreground font-semibold mb-1">{label}</p>
      <p className={`font-display font-black text-xl ${accent ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}
