import { Match, DataQuality, AnalysisStatus } from '@/types/match';
import { COUNTRY_FLAGS } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight, Eye, Zap, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const qualityColors: Record<DataQuality, string> = {
  excellent: 'bg-success/20 text-success border-success/30',
  good: 'bg-info/20 text-info border-info/30',
  fair: 'bg-warning/20 text-warning border-warning/30',
  poor: 'bg-destructive/20 text-destructive border-destructive/30',
  insufficient: 'bg-muted text-muted-foreground border-muted',
};

const qualityLabels: Record<DataQuality, string> = {
  excellent: 'Excellent', good: 'Bon', fair: 'Correct', poor: 'Faible', insufficient: 'Insuffisant',
};

const statusIcons: Partial<Record<AnalysisStatus, React.ReactNode>> = {
  completed: <CheckCircle2 className="h-3 w-3" />,
  generating: <Loader2 className="h-3 w-3 animate-spin" />,
  error: <AlertTriangle className="h-3 w-3" />,
};

const statusLabels: Record<AnalysisStatus, string> = {
  not_requested: 'Non analysé',
  quick_available: 'Aperçu dispo',
  generating: 'En cours…',
  completed: 'Analyse prête',
  expired: 'Expiré',
  partial: 'Partiel',
  error: 'Erreur',
};

export function MatchCard({ match, index }: { match: Match; index: number }) {
  const navigate = useNavigate();
  const time = new Date(match.kickoff).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const flag = COUNTRY_FLAGS[match.league.countryCode] || '⚽';
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="glass rounded-lg p-4 glass-hover cursor-pointer group"
      onClick={() => navigate(`/match/${match.id}`)}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Time / Status */}
        <div className="flex flex-col items-center min-w-[52px]">
          {isLive ? (
            <span className="text-live font-display font-bold text-sm badge-live">LIVE</span>
          ) : isFinished ? (
            <span className="text-muted-foreground text-xs font-medium">Terminé</span>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="text-sm font-medium">{time}</span>
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm truncate text-foreground">
                {match.homeTeam.name}
              </p>
              <p className="font-display font-semibold text-sm truncate text-foreground mt-1">
                {match.awayTeam.name}
              </p>
            </div>
            {(isFinished || isLive) && (
              <div className="flex flex-col items-end">
                <span className="font-display font-bold text-lg">{match.homeScore}</span>
                <span className="font-display font-bold text-lg">{match.awayScore}</span>
              </div>
            )}
          </div>

          {/* Quick probabilities */}
          {match.quickAnalysis && !isFinished && (
            <div className="flex gap-1 mt-2">
              <ProbBar label="1" value={match.quickAnalysis.homeWinProb} variant="home" />
              <ProbBar label="N" value={match.quickAnalysis.drawProb} variant="draw" />
              <ProbBar label="2" value={match.quickAnalysis.awayWinProb} variant="away" />
            </div>
          )}
        </div>

        {/* Badges + Action */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${qualityColors[match.dataQuality]}`}>
            {qualityLabels[match.dataQuality]}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
            {statusIcons[match.analysisStatus]} {statusLabels[match.analysisStatus]}
          </Badge>
          <Button 
            size="sm" 
            className="h-7 text-xs gap-1 mt-1 opacity-80 group-hover:opacity-100 transition-opacity"
            variant={match.analysisStatus === 'completed' ? 'outline' : 'default'}
          >
            {match.analysisStatus === 'completed' ? (
              <><Eye className="h-3 w-3" /> Voir</>
            ) : (
              <><Zap className="h-3 w-3" /> Analyser</>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ProbBar({ label, value, variant }: { label: string; value: number; variant: 'home' | 'draw' | 'away' }) {
  const colors = {
    home: 'bg-primary/30 text-primary',
    draw: 'bg-muted text-muted-foreground',
    away: 'bg-info/30 text-info',
  };
  return (
    <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[variant]}`}>
      <span className="opacity-60">{label}</span>
      <span className="font-bold">{value}%</span>
    </div>
  );
}
