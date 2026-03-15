import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_MATCHES, MOCK_FULL_ANALYSIS, COUNTRY_FLAGS } from '@/data/mockData';
import { useState, useEffect, useCallback } from 'react';
import { FullAnalysis } from '@/types/match';
import { AnalysisLoader } from '@/components/AnalysisLoader';
import { AnalysisReport } from '@/components/AnalysisReport';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, RefreshCw, Eye, Clock, MapPin, Database, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const ANALYSIS_STEPS = [
  'Récupération des données match',
  'Agrégation des sources gratuites',
  'Calcul des features',
  'Estimation probabiliste',
  'Génération du rapport',
];

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const match = MOCK_MATCHES.find(m => m.id === id);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(
    match?.analysisStatus === 'completed' ? { ...MOCK_FULL_ANALYSIS, matchId: match.id } : null
  );
  const [steps, setSteps] = useState(ANALYSIS_STEPS.map(l => ({ label: l, status: 'pending' as const })));
  const [progress, setProgress] = useState(0);
  const [analysisMode, setAnalysisMode] = useState<'quick' | 'full'>('full');

  const runAnalysis = useCallback(() => {
    setIsAnalyzing(true);
    setProgress(0);
    setSteps(ANALYSIS_STEPS.map(l => ({ label: l, status: 'pending' as const })));

    let step = 0;
    const interval = setInterval(() => {
      if (step < ANALYSIS_STEPS.length) {
        setSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < step ? 'done' : i === step ? 'active' : 'pending',
        })));
        setProgress(Math.round(((step + 1) / ANALYSIS_STEPS.length) * 100));
        step++;
      } else {
        clearInterval(interval);
        setIsAnalyzing(false);
        setAnalysis({ ...MOCK_FULL_ANALYSIS, matchId: id! });
      }
    }, 800);

    return () => clearInterval(interval);
  }, [id]);

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Match introuvable</p>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
      </div>
    );
  }

  const time = new Date(match.kickoff).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(match.kickoff).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const flag = COUNTRY_FLAGS[match.league.countryCode] || '⚽';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Activity className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-sm text-gradient truncate">FootAnalytics</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Match Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>{flag}</span>
            <span>{match.league.name}</span>
            <span>·</span>
            <span>{match.league.country}</span>
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="h-16 w-16 rounded-xl bg-surface flex items-center justify-center mx-auto mb-2">
                <span className="font-display font-bold text-lg">{match.homeTeam.shortName}</span>
              </div>
              <p className="font-display font-semibold text-sm">{match.homeTeam.name}</p>
            </div>

            <div className="text-center">
              {match.status === 'finished' || match.status === 'live' ? (
                <div className="font-display font-bold text-3xl">
                  {match.homeScore} <span className="text-muted-foreground">-</span> {match.awayScore}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-display font-bold text-xl text-primary">{time}</p>
                  <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
                </div>
              )}
              {match.status === 'live' && (
                <Badge className="bg-live/20 text-live border-live/30 badge-live mt-1">LIVE</Badge>
              )}
            </div>

            <div className="text-center">
              <div className="h-16 w-16 rounded-xl bg-surface flex items-center justify-center mx-auto mb-2">
                <span className="font-display font-bold text-lg">{match.awayTeam.shortName}</span>
              </div>
              <p className="font-display font-semibold text-sm">{match.awayTeam.name}</p>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            {match.venue && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.venue}</span>
            )}
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{time}</span>
            <span className="flex items-center gap-1"><Database className="h-3 w-3" />Qualité : {match.dataQuality}</span>
          </div>

          {/* Quick Analysis preview */}
          {match.quickAnalysis && !analysis && !isAnalyzing && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground mb-2">Aperçu rapide</p>
              <div className="flex justify-center gap-4">
                <div><span className="text-xs text-muted-foreground">Dom.</span> <span className="font-display font-bold text-primary">{match.quickAnalysis.homeWinProb}%</span></div>
                <div><span className="text-xs text-muted-foreground">Nul</span> <span className="font-display font-bold">{match.quickAnalysis.drawProb}%</span></div>
                <div><span className="text-xs text-muted-foreground">Ext.</span> <span className="font-display font-bold text-info">{match.quickAnalysis.awayWinProb}%</span></div>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>ELO Dom. {match.quickAnalysis.homeElo}</span>
                <span>ELO Ext. {match.quickAnalysis.awayElo}</span>
                <span>Forme: {match.quickAnalysis.homeForm} / {match.quickAnalysis.awayForm}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Action Buttons */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-2">
          {!analysis && !isAnalyzing && (
            <Button className="flex-1 glow-primary gap-2" onClick={runAnalysis}>
              <Zap className="h-4 w-4" /> Lancer l'analyse complète
            </Button>
          )}
          {analysis && !isAnalyzing && (
            <>
              <Button variant="outline" className="flex-1 gap-2" onClick={runAnalysis}>
                <RefreshCw className="h-4 w-4" /> Actualiser l'analyse
              </Button>
              <Button variant="outline" className="gap-2">
                <Eye className="h-4 w-4" /> Mode expert
              </Button>
            </>
          )}
          {isAnalyzing && (
            <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour à la liste
            </Button>
          )}
        </motion.div>

        {/* Analysis Content */}
        {isAnalyzing && <AnalysisLoader steps={steps} progress={progress} />}
        {analysis && !isAnalyzing && <AnalysisReport analysis={analysis} />}
      </main>
    </div>
  );
}
