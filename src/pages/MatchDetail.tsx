import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { analyzeMatch, getAnalysis, DbAnalysis } from '@/lib/api';
import { AnalysisLoader } from '@/components/AnalysisLoader';
import { RealAnalysisReport } from '@/components/RealAnalysisReport';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, RefreshCw, Eye, Clock, MapPin, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const ANALYSIS_STEPS = [
  'Récupération des données match',
  'Récupération des confrontations directes',
  'Récupération du classement',
  'Récupération des cotes',
  'Agrégation des sources',
  'Analyse IA en cours',
  'Génération du rapport',
];

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DbAnalysis | null>(null);
  const [steps, setSteps] = useState<{ label: string; status: 'pending' | 'active' | 'done' | 'error' }[]>(
    ANALYSIS_STEPS.map(l => ({ label: l, status: 'pending' as const }))
  );
  const [progress, setProgress] = useState(0);

  // Fetch match from DB
  const { data: match, isLoading: matchLoading, error: matchError } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id,
  });

  // Fetch existing analysis
  useEffect(() => {
    if (id) {
      getAnalysis(id).then(a => {
        if (a && a.status === 'completed') setAnalysis(a);
      }).catch(console.error);
    }
  }, [id]);

  const runAnalysis = async () => {
    if (!id) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    setProgress(0);
    setSteps(ANALYSIS_STEPS.map(l => ({ label: l, status: 'pending' as const })));

    // Simulate step progression while real analysis runs
    let step = 0;
    const interval = setInterval(() => {
      if (step < ANALYSIS_STEPS.length - 1) {
        setSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < step ? 'done' : i === step ? 'active' : 'pending',
        })));
        setProgress(Math.round(((step + 1) / ANALYSIS_STEPS.length) * 90));
        step++;
      }
    }, 1500);

    try {
      const result = await analyzeMatch(id, 'full');
      clearInterval(interval);
      setSteps(ANALYSIS_STEPS.map(l => ({ label: l, status: 'done' as const })));
      setProgress(100);

      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysis(result);
        toast({ title: 'Analyse terminée', description: 'Le rapport a été généré avec succès.' });
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setIsAnalyzing(false);
      setSteps(prev => prev.map((s, i) => ({
        ...s,
        status: s.status === 'active' ? 'error' : s.status,
      })));
      toast({
        title: 'Erreur',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  if (matchLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (matchError || !match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
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
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];
  const finishedStatuses = ['FT', 'AET', 'PEN'];
  const isLive = liveStatuses.includes(match.status_short);
  const isFinished = finishedStatuses.includes(match.status_short);

  return (
    <div className="min-h-screen bg-background">
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
            {match.league_logo && <img src={match.league_logo} alt="" className="h-4 w-4" />}
            <span>{match.league_name}</span>
            <span>·</span>
            <span>{match.league_country}</span>
            {match.league_round && <><span>·</span><span>{match.league_round}</span></>}
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="h-16 w-16 rounded-xl bg-surface flex items-center justify-center mx-auto mb-2 overflow-hidden">
                {match.home_team_logo ? (
                  <img src={match.home_team_logo} alt={match.home_team_name} className="h-10 w-10 object-contain" />
                ) : (
                  <span className="font-display font-bold text-lg">{match.home_team_name.slice(0, 3).toUpperCase()}</span>
                )}
              </div>
              <p className="font-display font-semibold text-sm">{match.home_team_name}</p>
            </div>

            <div className="text-center">
              {(isFinished || isLive) && match.home_score != null ? (
                <div className="font-display font-bold text-3xl">
                  {match.home_score} <span className="text-muted-foreground">-</span> {match.away_score}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-display font-bold text-xl text-primary">{time}</p>
                  <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
                </div>
              )}
              {isLive && (
                <Badge className="bg-live/20 text-live border-live/30 badge-live mt-1">LIVE</Badge>
              )}
            </div>

            <div className="text-center">
              <div className="h-16 w-16 rounded-xl bg-surface flex items-center justify-center mx-auto mb-2 overflow-hidden">
                {match.away_team_logo ? (
                  <img src={match.away_team_logo} alt={match.away_team_name} className="h-10 w-10 object-contain" />
                ) : (
                  <span className="font-display font-bold text-lg">{match.away_team_name.slice(0, 3).toUpperCase()}</span>
                )}
              </div>
              <p className="font-display font-semibold text-sm">{match.away_team_name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            {match.venue_name && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.venue_name}{match.venue_city ? `, ${match.venue_city}` : ''}</span>
            )}
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{time}</span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-2">
          {!analysis && !isAnalyzing && (
            <Button className="flex-1 glow-primary gap-2" onClick={runAnalysis}>
              <Zap className="h-4 w-4" /> Lancer l'analyse IA
            </Button>
          )}
          {analysis && !isAnalyzing && (
            <Button variant="outline" className="flex-1 gap-2" onClick={runAnalysis}>
              <RefreshCw className="h-4 w-4" /> Actualiser l'analyse
            </Button>
          )}
          {isAnalyzing && (
            <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour à la liste
            </Button>
          )}
        </motion.div>

        {/* Analysis Content */}
        {isAnalyzing && <AnalysisLoader steps={steps} progress={progress} />}
        {analysis && !isAnalyzing && <RealAnalysisReport analysis={analysis} />}
      </main>
    </div>
  );
}
