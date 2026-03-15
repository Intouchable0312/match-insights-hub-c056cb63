import { FullAnalysis } from '@/types/match';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, AlertTriangle, CheckCircle2, Database, Clock, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export function AnalysisReport({ analysis }: { analysis: FullAnalysis }) {
  const { prediction, report } = analysis;

  const probMax = Math.max(prediction.homeWinProb, prediction.drawProb, prediction.awayWinProb);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Prediction Cards */}
      <div className="grid grid-cols-3 gap-3">
        <ProbCard label="Victoire Dom." value={prediction.homeWinProb} isMax={prediction.homeWinProb === probMax} />
        <ProbCard label="Match Nul" value={prediction.drawProb} isMax={prediction.drawProb === probMax} />
        <ProbCard label="Victoire Ext." value={prediction.awayWinProb} isMax={prediction.awayWinProb === probMax} />
      </div>

      {/* Score & Goals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Target className="h-4 w-4" />} label="Score probable" value={`${prediction.predictedScore.home} - ${prediction.predictedScore.away}`} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Buts attendus" value={prediction.expectedGoals.toFixed(1)} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="BTTS" value={`${prediction.bttsProb}%`} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Over 2.5" value={`${prediction.over25Prob}%`} />
      </div>

      {/* More predictions */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Over 1.5" value={`${prediction.over15Prob}%`} />
        <StatCard icon={<Minus className="h-4 w-4" />} label="Under 2.5" value={`${prediction.under25Prob}%`} />
        <StatCard icon={<Target className="h-4 w-4" />} label="Confiance" value={`${prediction.confidence}%`} accent />
      </div>

      {/* First to score */}
      <div className="glass rounded-lg p-4">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Équipe susceptible de marquer en premier</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-primary/10 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Domicile</p>
            <p className="font-display font-bold text-primary">{prediction.firstToScoreProb.home}%</p>
          </div>
          <div className="flex-1 bg-muted rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Extérieur</p>
            <p className="font-display font-bold">{prediction.firstToScoreProb.away}%</p>
          </div>
          <div className="flex-1 bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">0-0</p>
            <p className="font-display font-bold text-muted-foreground">{prediction.firstToScoreProb.noGoal}%</p>
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

      {/* Key Factors */}
      <div className="glass rounded-lg p-4">
        <h3 className="font-display font-semibold text-sm mb-3">Facteurs clés</h3>
        <div className="space-y-2">
          {report.keyFactors.map((f, i) => (
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

      {/* Sources */}
      <div className="glass rounded-lg p-4">
        <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-info" /> Sources ({report.sources.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {report.sources.map((s, i) => (
            <div key={i} className="bg-surface rounded-lg p-2 text-center">
              <p className="text-xs font-medium truncate">{s.name}</p>
              <p className="text-[10px] text-muted-foreground">{s.type}</p>
              <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${s.reliability}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Missing variables */}
      {report.missingVariables.length > 0 && (
        <div className="glass rounded-lg p-4 border-warning/20">
          <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" /> Variables manquantes
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {report.missingVariables.map((v, i) => (
              <Badge key={i} variant="outline" className="text-xs border-warning/30 text-warning">{v}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Modèle {analysis.modelVersion}</span>
        <span>Qualité données : {analysis.dataQualityScore}/100</span>
        <span>Incertitude : {analysis.uncertaintyScore}/100</span>
        <span>{analysis.sourceCount} sources</span>
      </div>
    </motion.div>
  );
}

function ProbCard({ label, value, isMax }: { label: string; value: number; isMax: boolean }) {
  return (
    <div className={`glass rounded-lg p-4 text-center ${isMax ? 'glow-sm border-primary/30' : ''}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-display font-bold text-2xl ${isMax ? 'text-primary' : 'text-foreground'}`}>{value}%</p>
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
