import { DbMatch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
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
  const { isLive, isFinished } = getStatusInfo(match.status_short);
  const analysisInfo = getAnalysisStatusFromMatch(match);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="glass rounded-2xl p-4 glass-hover cursor-pointer group"
      onClick={() => navigate(`/match/${match.id}`)}
    >
      <div className="flex items-center gap-4">
        {/* Time / Status */}
        <div className="flex flex-col items-center min-w-[50px]">
          {isLive ? (
            <span className="text-live font-display font-extrabold text-sm badge-live">LIVE</span>
          ) : isFinished ? (
            <span className="text-muted-foreground text-xs font-semibold">Terminé</span>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-sm font-bold font-display">{time}</span>
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2.5">
                {match.home_team_logo && (
                  <img src={match.home_team_logo} alt="" className="h-6 w-6 object-contain" />
                )}
                <p className="font-display font-bold text-sm truncate">{match.home_team_name}</p>
              </div>
              <div className="flex items-center gap-2.5">
                {match.away_team_logo && (
                  <img src={match.away_team_logo} alt="" className="h-6 w-6 object-contain" />
                )}
                <p className="font-display font-bold text-sm truncate">{match.away_team_name}</p>
              </div>
            </div>
            {(isFinished || isLive) && match.home_score != null && (
              <div className="flex flex-col items-center gap-1.5">
                <span className="font-display font-black text-xl leading-none">{match.home_score}</span>
                <span className="font-display font-black text-xl leading-none">{match.away_score}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {analysisInfo.status === 'completed' && (
            <Badge className="bg-success/15 text-success border-none rounded-full text-[10px] px-2 py-0.5 font-semibold">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Prête
            </Badge>
          )}
          {analysisInfo.status === 'generating' && (
            <Badge className="bg-primary/15 text-primary border-none rounded-full text-[10px] px-2 py-0.5 font-semibold">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              En cours
            </Badge>
          )}
          <div className={`h-8 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
            analysisInfo.status === 'completed' 
              ? 'bg-surface text-foreground group-hover:bg-surface-hover' 
              : 'bg-primary text-primary-foreground'
          }`}>
            {analysisInfo.status === 'completed' ? (
              <><Eye className="h-3.5 w-3.5" /> Voir</>
            ) : (
              <><Zap className="h-3.5 w-3.5" /> Analyser</>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
