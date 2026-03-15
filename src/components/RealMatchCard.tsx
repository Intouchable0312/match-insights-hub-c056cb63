import { DbMatch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Eye, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function getStatusInfo(statusShort: string) {
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  const finishedStatuses = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
  if (liveStatuses.includes(statusShort)) return { label: 'LIVE', isLive: true, isFinished: false };
  if (finishedStatuses.includes(statusShort)) return { label: 'Terminé', isLive: false, isFinished: true };
  return { label: statusShort, isLive: false, isFinished: false };
}

function getAnalysisStatusFromMatch(match: DbMatch) {
  const analyses = match.analyses || [];
  if (analyses.length === 0) return { status: 'none', label: 'Non analysé' };
  const latest = analyses[0];
  if (latest.status === 'completed') return { status: 'completed', label: 'Analyse prête' };
  if (latest.status === 'generating') return { status: 'generating', label: 'En cours…' };
  if (latest.status === 'error') return { status: 'error', label: 'Erreur' };
  return { status: 'pending', label: 'En attente' };
}

export function RealMatchCard({ match, index }: { match: DbMatch; index: number }) {
  const navigate = useNavigate();
  const time = new Date(match.kickoff).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const { isLive, isFinished, label: statusLabel } = getStatusInfo(match.status_short);
  const analysisInfo = getAnalysisStatusFromMatch(match);

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
              <div className="flex items-center gap-2">
                {match.home_team_logo && (
                  <img src={match.home_team_logo} alt="" className="h-5 w-5 object-contain" />
                )}
                <p className="font-display font-semibold text-sm truncate text-foreground">
                  {match.home_team_name}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {match.away_team_logo && (
                  <img src={match.away_team_logo} alt="" className="h-5 w-5 object-contain" />
                )}
                <p className="font-display font-semibold text-sm truncate text-foreground">
                  {match.away_team_name}
                </p>
              </div>
            </div>
            {(isFinished || isLive) && match.home_score != null && (
              <div className="flex flex-col items-end">
                <span className="font-display font-bold text-lg">{match.home_score}</span>
                <span className="font-display font-bold text-lg">{match.away_score}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status + Action */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
            analysisInfo.status === 'completed' ? 'border-success/30 text-success' :
            analysisInfo.status === 'generating' ? 'border-primary/30 text-primary' :
            'border-border text-muted-foreground'
          }`}>
            {analysisInfo.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {analysisInfo.status === 'generating' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {analysisInfo.label}
          </Badge>
          <Button 
            size="sm" 
            className="h-7 text-xs gap-1 mt-1 opacity-80 group-hover:opacity-100 transition-opacity"
            variant={analysisInfo.status === 'completed' ? 'outline' : 'default'}
          >
            {analysisInfo.status === 'completed' ? (
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
