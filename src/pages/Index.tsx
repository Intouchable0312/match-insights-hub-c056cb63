import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMatches, DbMatch, getLeaguePriority } from '@/lib/api';
import { RealLeagueGroup } from '@/components/RealLeagueGroup';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, Search, ChevronLeft, ChevronRight, Calendar, Star, CheckCircle2, Loader2, AlertCircle, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

const Index = () => {
  const [date, setDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [popularOnly, setPopularOnly] = useState(false);
  const [analyzedOnly, setAnalyzedOnly] = useState(false);
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  const { data: matches, isLoading, error, refetch } = useQuery({
    queryKey: ['matches', dateStr],
    queryFn: () => fetchMatches(dateStr),
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 2,
  });

  const dateNav = (dir: -1 | 0 | 1) => {
    if (dir === 0) setDate(new Date());
    else setDate(dir === -1 ? subDays(date, 1) : addDays(date, 1));
  };

  // Get unique leagues from matches
  const availableLeagues = useMemo(() => {
    if (!matches) return [];
    const leagueMap = new Map<number, { id: number; name: string; logo: string | null; country: string }>();
    matches.forEach(m => {
      if (!leagueMap.has(m.league_id)) {
        leagueMap.set(m.league_id, { id: m.league_id, name: m.league_name, logo: m.league_logo, country: m.league_country });
      }
    });
    return [...leagueMap.values()].sort((a, b) => getLeaguePriority(a.id) - getLeaguePriority(b.id));
  }, [matches]);

  // Filter matches
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    let result = matches;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.home_team_name.toLowerCase().includes(q) ||
        m.away_team_name.toLowerCase().includes(q) ||
        m.league_name.toLowerCase().includes(q)
      );
    }
    if (selectedLeagues.length > 0) {
      result = result.filter(m => selectedLeagues.includes(m.league_id));
    }
    if (popularOnly) {
      result = result.filter(m => getLeaguePriority(m.league_id) <= 3);
    }
    if (analyzedOnly) {
      result = result.filter(m => m.analyses?.some((a: any) => a.status === 'completed'));
    }

    return result;
  }, [matches, search, selectedLeagues, popularOnly, analyzedOnly]);

  // Group by league
  const grouped = useMemo(() => {
    const map = new Map<number, DbMatch[]>();
    filteredMatches.forEach(m => {
      if (!map.has(m.league_id)) map.set(m.league_id, []);
      map.get(m.league_id)!.push(m);
    });
    map.forEach(matches => matches.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()));
    return [...map.entries()].sort((a, b) => getLeaguePriority(a[0]) - getLeaguePriority(b[0]));
  }, [filteredMatches]);

  const totalMatches = matches?.length || 0;
  const analyzedCount = matches?.filter(m => m.analyses?.some((a: any) => a.status === 'completed')).length || 0;

  const hasFilters = search || selectedLeagues.length > 0 || popularOnly || analyzedOnly;

  const FilterContent = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une équipe…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-surface border-border"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-gold" />
            <span>Ligues populaires uniquement</span>
          </div>
          <Switch checked={popularOnly} onCheckedChange={setPopularOnly} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Analyses générées uniquement</span>
          </div>
          <Switch checked={analyzedOnly} onCheckedChange={setAnalyzedOnly} />
        </div>
      </div>

      {availableLeagues.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Ligues ({availableLeagues.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {availableLeagues.map(league => {
              const active = selectedLeagues.includes(league.id);
              return (
                <Badge
                  key={league.id}
                  variant={active ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs transition-all ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-hover'}`}
                  onClick={() => {
                    setSelectedLeagues(active
                      ? selectedLeagues.filter(id => id !== league.id)
                      : [...selectedLeagues, league.id]
                    );
                  }}
                >
                  {league.logo && <img src={league.logo} alt="" className="h-3 w-3 mr-1" />}
                  {league.name}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => { setSearch(''); setSelectedLeagues([]); setPopularOnly(false); setAnalyzedOnly(false); }}
        >
          <X className="h-3 w-3 mr-1" /> Réinitialiser
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="font-display font-bold text-lg">
                <span className="text-gradient">FootAnalytics</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span>{totalMatches} matchs</span>
                <span>·</span>
                <span>{analyzedCount} analysés</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dateNav(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button onClick={() => dateNav(0)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover transition-colors">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-display font-semibold text-sm">
                {isToday ? "Aujourd'hui" : format(date, 'EEEE d MMMM', { locale: fr })}
              </span>
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dateNav(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 w-48 bg-surface border-border text-sm" />
            </div>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden h-8 gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filtres
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl max-h-[80vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-display">Filtres</SheetTitle>
              </SheetHeader>
              <div className="mt-4"><FilterContent /></div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop filters */}
        <div className="hidden md:block glass rounded-lg p-4">
          <FilterContent />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Chargement des matchs…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-20">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive mb-2">Erreur de chargement</p>
            <p className="text-xs text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Réessayer
            </Button>
          </div>
        )}

        {/* Matches */}
        {!isLoading && !error && grouped.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <p className="text-muted-foreground text-sm">
              {totalMatches === 0 ? 'Aucun match trouvé pour cette date.' : 'Aucun match ne correspond aux filtres.'}
            </p>
          </motion.div>
        )}

        {!isLoading && !error && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([leagueId, leagueMatches]) => (
              <RealLeagueGroup
                key={leagueId}
                leagueName={leagueMatches[0].league_name}
                leagueLogo={leagueMatches[0].league_logo}
                leagueFlag={leagueMatches[0].league_flag}
                leagueCountry={leagueMatches[0].league_country}
                matches={leagueMatches}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
