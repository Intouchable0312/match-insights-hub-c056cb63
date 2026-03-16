import { DbAnalysis } from '@/lib/api';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, AlertTriangle, Database, Clock, ArrowUp, ArrowDown, Minus, Users, Swords, Flag, ShieldAlert, FileText } from 'lucide-react';

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

      {/* Summary */}
      <div className="glass rounded-3xl p-5">
        <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Rapport d'analyse
        </h3>
        <p className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-line">{report.summary}</p>
      </div>

      {/* Team A Analysis */}
      {report.team_a_analysis && (
        <ReportSection icon={<Flag className="h-4 w-4 text-primary" />} title="Analyse équipe domicile" content={report.team_a_analysis} />
      )}

      {/* Team B Analysis */}
      {report.team_b_analysis && (
        <ReportSection icon={<Flag className="h-4 w-4 text-info" />} title="Analyse équipe extérieur" content={report.team_b_analysis} />
      )}

      {/* Injuries Impact */}
      {report.injuries_impact && (
        <ReportSection icon={<ShieldAlert className="h-4 w-4 text-destructive" />} title="Impact des blessures" content={report.injuries_impact} />
      )}

      {/* Tactical Analysis */}
      {report.tactical_analysis && (
        <ReportSection icon={<Swords className="h-4 w-4 text-warning" />} title="Analyse tactique" content={report.tactical_analysis} />
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
        <div className="glass rounded-3xl p-5">
          <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-info" /> Qualité des données
          </h3>
          <p className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-line">{report.data_quality_assessment}</p>
        </div>
      )}

      {/* Confidence Notes */}
      {report.confidence_notes && (
        <div className="glass rounded-3xl p-5">
          <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> Notes de confiance
          </h3>
          <p className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-line">{report.confidence_notes}</p>
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
