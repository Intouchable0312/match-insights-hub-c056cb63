import { DbAnalysis } from '@/lib/api';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, AlertTriangle, Database, Clock, ArrowUp, ArrowDown, Minus, Shield, CheckCircle2, Zap } from 'lucide-react';

export function RealAnalysisReport({ analysis }: { analysis: DbAnalysis }) {
  const prediction = analysis.prediction;
  const report = analysis.report;

  if (!prediction || !report) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <p className="text-muted-foreground font-medium">Données d'analyse incomplètes.</p>
      </div>
    );
  }

  const probMax = Math.max(prediction.home_win_prob, prediction.draw_prob, prediction.away_win_prob);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Probabilities */}
      <div className="grid grid-cols-3 gap-3">
        <ProbCard label="Dom." value={prediction.home_win_prob} isMax={prediction.home_win_prob === probMax} />
        <ProbCard label="Nul" value={prediction.draw_prob} isMax={prediction.draw_prob === probMax} />
        <ProbCard label="Ext." value={prediction.away_win_prob} isMax={prediction.away_win_prob === probMax} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Score probable" value={`${prediction.predicted_score_home} - ${prediction.predicted_score_away}`} />
        <StatCard label="Buts attendus" value={prediction.expected_goals?.toFixed(1) || '?'} />
        <StatCard label="BTTS" value={`${prediction.btts_prob}%`} />
        <StatCard label="Over 2.5" value={`${prediction.over_25_prob}%`} />
      </div>

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
            <p className="text-[11px] text-muted-foreground mb-1">Domicile</p>
            <p className="font-display font-black text-xl text-primary">{prediction.first_to_score_home}%</p>
          </div>
          <div className="flex-1 bg-surface rounded-2xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Extérieur</p>
            <p className="font-display font-black text-xl">{prediction.first_to_score_away}%</p>
          </div>
          <div className="flex-1 bg-surface/50 rounded-2xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">0-0</p>
            <p className="font-display font-black text-xl text-muted-foreground">{prediction.first_to_score_none}%</p>
          </div>
        </div>
      </div>

      {/* Suggested Bets */}
      {report.suggested_bets?.length > 0 && (
        <div className="glass rounded-3xl p-5 border-success/20">
          <h3 className="font-display font-bold text-base mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-success" /> Paris suggérés
          </h3>
          <div className="space-y-3">
            {report.suggested_bets.map((bet: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-surface rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ConfidenceIcon confidence={bet.confidence} />
                    <span className="font-display font-bold text-sm truncate">{bet.selection}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-[10px] px-2 py-0.5 rounded-full border-none font-bold ${
                      bet.confidence === 'very_high' ? 'bg-success/15 text-success' :
                      bet.confidence === 'high' ? 'bg-primary/15 text-primary' :
                      'bg-warning/15 text-warning'
                    }`}>
                      {Math.round(bet.probability)}%
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover border-none text-muted-foreground font-medium">
                    {bet.bet_type}
                  </Badge>
                  <ConfidenceBadge confidence={bet.confidence} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{bet.reasoning}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 italic">
            ⚠️ Ces suggestions sont basées sur l'analyse statistique et ne garantissent aucun résultat. Pariez de manière responsable.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="glass rounded-3xl p-5">
        <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Rapport IA
        </h3>
        <p className="text-sm text-secondary-foreground leading-relaxed">{report.summary}</p>
      </div>

      {/* Data quality */}
      {report.data_quality_assessment && (
        <div className="glass rounded-3xl p-5">
          <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-info" /> Qualité des données
          </h3>
          <p className="text-sm text-secondary-foreground leading-relaxed">{report.data_quality_assessment}</p>
        </div>
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
  );
}

function ProbCard({ label, value, isMax }: { label: string; value: number; isMax: boolean }) {
  return (
    <div className={`glass rounded-3xl p-5 text-center transition-all ${isMax ? 'bg-primary/5 border-primary/20' : ''}`}>
      <p className="text-xs text-muted-foreground mb-1 font-semibold">{label}</p>
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

function ConfidenceIcon({ confidence }: { confidence: string }) {
  if (confidence === 'very_high') return <CheckCircle2 className="h-4 w-4 text-success shrink-0" />;
  if (confidence === 'high') return <Zap className="h-4 w-4 text-primary shrink-0" />;
  return <Target className="h-4 w-4 text-warning shrink-0" />;
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    very_high: { label: 'Très sûr', cls: 'bg-success/15 text-success' },
    high: { label: 'Sûr', cls: 'bg-primary/15 text-primary' },
    medium: { label: 'Modéré', cls: 'bg-warning/15 text-warning' },
  };
  const c = map[confidence] || map.medium;
  return <Badge className={`text-[10px] px-2 py-0.5 rounded-full border-none font-bold ${c.cls}`}>{c.label}</Badge>;
}
