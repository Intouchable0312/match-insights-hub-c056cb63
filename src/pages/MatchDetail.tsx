import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { analyzeMatch, getAnalysis, DbAnalysis } from '@/lib/api';
import { AnalysisLoader } from '@/components/AnalysisLoader';
import { RealAnalysisReport } from '@/components/RealAnalysisReport';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, RefreshCw, Clock, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const ANALYSIS_STEPS = [
  'Récupération des données match',
  'Récupération des confrontations directes',
  'Récupération du classement',
  'Récupération des cotes',
  'Récupération des blessures',
  'Agrégation des sources',
  'Analyse IA en cours',
  'Génération du rapport',
];

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Restore theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('anap-theme');
    const isDark = stored ? stored === 'dark' : true;
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }, []);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DbAnalysis | null>(null);
  const [steps, setSteps] = useState<{ label: string; status: 'pending' | 'active' | 'done' | 'error' }[]>(
    ANALYSIS_STEPS.map(l => ({ label: l, status: 'pending' as const }))
  );
  const [progress, setProgress] = useState(0);

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
    }, 1200);

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
      setSteps(prev => prev.map(s => ({
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
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-muted-foreground font-medium">Match introuvable</p>
          <Button variant="outline" className="rounded-full" onClick={() => navigate('/')}>
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
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-display font-black text-lg">ANAP</span>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Match Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6 text-center space-y-5">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {match.league_logo && <img src={match.league_logo} alt="" className="h-4 w-4" />}
            <span className="font-semibold">{match.league_name}</span>
            <span className="text-border">·</span>
            <span>{match.league_country}</span>
            {match.league_round && <><span className="text-border">·</span><span>{match.league_round}</span></>}
          </div>

          <div className="flex items-center justify-center gap-4 sm:gap-8">
            <div className="text-center flex-1 min-w-0 max-w-[120px]">
              <div className="h-18 w-18 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-3 overflow-hidden" style={{ height: 72, width: 72 }}>
                {match.home_team_logo ? (
                  <img src={match.home_team_logo} alt={match.home_team_name} className="h-12 w-12 object-contain" />
                ) : (
                  <span className="font-display font-black text-lg">{match.home_team_name.slice(0, 3).toUpperCase()}</span>
                )}
              </div>
              <p className="font-display font-bold text-sm truncate">{match.home_team_name}</p>
            </div>

            <div className="text-center">
              {(isFinished || isLive) && match.home_score != null ? (
                <div className="font-display font-black text-4xl tracking-tight">
                  {match.home_score} <span className="text-muted-foreground mx-1">-</span> {match.away_score}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-display font-black text-2xl text-primary">{time}</p>
                  <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
                </div>
              )}
              {isLive && (
                <Badge className="bg-live/15 text-live border-none rounded-full badge-live mt-2 font-bold">LIVE</Badge>
              )}
            </div>

            <div className="text-center flex-1 min-w-0 max-w-[120px]">
              <div className="h-18 w-18 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-3 overflow-hidden" style={{ height: 72, width: 72 }}>
                {match.away_team_logo ? (
                  <img src={match.away_team_logo} alt={match.away_team_name} className="h-12 w-12 object-contain" />
                ) : (
                  <span className="font-display font-black text-lg">{match.away_team_name.slice(0, 3).toUpperCase()}</span>
                )}
              </div>
              <p className="font-display font-bold text-sm truncate">{match.away_team_name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            {match.venue_name && (
              <span className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full">
                <MapPin className="h-3 w-3" />{match.venue_name}{match.venue_city ? `, ${match.venue_city}` : ''}
              </span>
            )}
            <span className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full">
              <Clock className="h-3 w-3" />{time}
            </span>
          </div>
        </motion.div>

        {/* Action */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {!analysis && !isAnalyzing && (
            <Button className="w-full h-12 rounded-2xl gap-2 font-display font-bold text-base" onClick={runAnalysis}>
              <Zap className="h-5 w-5" /> Lancer l'analyse IA
            </Button>
          )}
          {analysis && !isAnalyzing && (
            <Button variant="outline" className="w-full h-12 rounded-2xl gap-2 font-display font-bold text-base" onClick={runAnalysis}>
              <RefreshCw className="h-5 w-5" /> Actualiser l'analyse
            </Button>
          )}
          {isAnalyzing && (
            <Button variant="outline" className="w-full h-12 rounded-2xl font-display font-bold" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
          )}
        </motion.div>

        {/* Analysis Content */}
        {isAnalyzing && <AnalysisLoader steps={steps} progress={progress} />}
        {analysis && !isAnalyzing && (
          <RealAnalysisReport
            analysis={analysis}
            homeTeamName={match.home_team_name}
            awayTeamName={match.away_team_name}
            homeTeamLogo={match.home_team_logo}
            awayTeamLogo={match.away_team_logo}
            leagueName={match.league_name}
            leagueLogo={match.league_logo}
            kickoff={match.kickoff}
          />
        )}
      </main>
    </div>
  );
}
