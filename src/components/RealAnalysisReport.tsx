import { DbAnalysis } from '@/lib/api';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, AlertTriangle, CheckCircle2, Database, Clock, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export function RealAnalysisReport({ analysis }: { analysis: DbAnalysis }) {
  const prediction = analysis.prediction;
  const report = analysis.report;

  if (!prediction || !report) {
    return (
      <div className="glass rounded-lg p-6 text-center">
        <p className="text-muted-foreground">Données d'analyse incomplètes.</p>
      </div>
    );
  }

  const probMax = Math.max(prediction.home_win_prob, prediction.draw_prob, prediction.away_win_prob);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Prediction Cards */}
      <div className="grid grid-cols-3 gap-3">
        <ProbCard label="Victoire Dom." value={prediction.home_win_prob} isMax={prediction.home_win_prob === probMax} />
        <ProbCard label="Match Nul" value={prediction.draw_prob} isMax={prediction.draw_prob === probMax} />
        <ProbCard label="Victoire Ext." value={prediction.away_win_prob} isMax={prediction.away_win_prob === probMax} />
      </div>

      {/* Score & Goals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Target className="h-4 w-4" />} label="Score probable" value={`${prediction.predicted_score_home} - ${prediction.predicted_score_away}`} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Buts attendus" value={prediction.expected_goals?.toFixed(1) || '?'} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="BTTS" value={`${prediction.btts_prob}%`} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Over 2.5" value={`${prediction.over_25_prob}%`} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Over 1.5" value={`${prediction.over_15_prob}%`} />
        <StatCard icon={<Minus className="h-4 w-4" />} label="Under 2.5" value={`${prediction.under_25_prob}%`} />
        <StatCard icon={<Target className="h-4 w-4" />} label="Confiance" value={`${prediction.confidence}%`} accent />
      </div>

      {/* First to score */}
      <div className="glass rounded-lg p-4">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Équipe susceptible de marquer en premier</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-primary/10 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Domicile</p>
            <p className="font-display font-bold text-primary">{prediction.first_to_score_home}%</p>
          </div>
          <div className="flex-1 bg-muted rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Extérieur</p>
            <p className="font-display font-bold">{prediction.first_to_score_away}%</p>
          </div>
          <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">0-0</p>
            <p className="font-display font-bold text-muted-foreground">{prediction.first_to_score_none}%</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="glass rounded-lg p-4">
        <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Rapport IA
        </h3>
        <p className="text-sm text-secondary-foreground leading-relaxed">{report.summary}</p>
      </div>

      {/* Data quality assessment */}
      {report.data_quality_assessment && (
        <div className="glass rounded-lg p-4">
          <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
            <Database className="h-4 w-4 text-info" /> Qualité des données
          </h3>
          <p className="text-sm text-secondary-foreground leading-relaxed">{report.data_quality_assessment}</p>
        </div>
      )}

      {/* Key Factors */}
      {report.key_factors?.length > 0 && (
        <div className="glass rounded-lg p-4">
          <h3 className="font-display font-semibold text-sm mb-3">Facteurs clés</h3>
          <div className="space-y-2">
            {report.key_factors.map((f: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5">
                  {f.direction === 'home' ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> :
                   f.direction === 'away' ? <ArrowDown className="h-3.5 w-3.5 text-info" /> :
                   <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.name}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                      f.impact === 'high' ? 'border-primary/50 text-primary' :
                      f.impact === 'medium' ? 'border-warning/50 text-warning' :
                      'border-border text-muted-foreground'
                    }`}>
                      {f.impact}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing variables */}
      {report.missing_variables?.length > 0 && (
        <div className="glass rounded-lg p-4 border-warning/20">
          <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" /> Variables manquantes
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {report.missing_variables.map((v: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs border-warning/30 text-warning">{v}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {analysis.model_version && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Modèle {analysis.model_version}</span>}
        {analysis.data_quality_score != null && <span>Qualité données : {analysis.data_quality_score}/100</span>}
        {analysis.uncertainty_score != null && <span>Incertitude : {analysis.uncertainty_score}/100</span>}
        {analysis.source_count != null && <span>{analysis.source_count} sources</span>}
        {analysis.completed_at && <span>Généré le {new Date(analysis.completed_at).toLocaleString('fr-FR')}</span>}
      </div>
    </motion.div>
  );
}

function ProbCard({ label, value, isMax }: { label: string; value: number; isMax: boolean }) {
  return (
    <div className={`glass rounded-lg p-4 text-center ${isMax ? 'glow-sm border-primary/30' : ''}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-display font-bold text-2xl ${isMax ? 'text-primary' : 'text-foreground'}`}>{Math.round(value)}%</p>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`glass rounded-lg p-3 text-center ${accent ? 'glow-sm border-primary/30' : ''}`}>
      <div className={`flex items-center justify-center mb-1 ${accent ? 'text-primary' : 'text-muted-foreground'}`}>{icon}</div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-display font-bold text-lg ${accent ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}
