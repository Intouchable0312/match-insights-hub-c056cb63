import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMatches, DbMatch, getLeaguePriority } from '@/lib/api';
import { RealLeagueGroup } from '@/components/RealLeagueGroup';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, Star, CheckCircle2, Loader2, AlertCircle, RefreshCw, SlidersHorizontal, X, Sun, Moon } from 'lucide-react';
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
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const dateNav = (dir: -1 | 0 | 1) => {
    if (dir === 0) setDate(new Date());
    else setDate(dir === -1 ? subDays(date, 1) : addDays(date, 1));
  };

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
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une équipe…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-12 bg-surface border-border rounded-2xl text-sm"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-surface">
          <div className="flex items-center gap-3">
            <Star className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium">Ligues populaires</span>
          </div>
          <Switch checked={popularOnly} onCheckedChange={setPopularOnly} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-2xl bg-surface">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-medium">Analysées uniquement</span>
          </div>
          <Switch checked={analyzedOnly} onCheckedChange={setAnalyzedOnly} />
        </div>
      </div>

      {availableLeagues.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">Ligues</p>
          <div className="flex flex-wrap gap-2">
            {availableLeagues.map(league => {
              const active = selectedLeagues.includes(league.id);
              return (
                <Badge
                  key={league.id}
                  variant={active ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs px-3 py-1.5 rounded-full transition-all font-medium ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-hover border-border'}`}
                  onClick={() => {
                    setSelectedLeagues(active
                      ? selectedLeagues.filter(id => id !== league.id)
                      : [...selectedLeagues, league.id]
                    );
                  }}
                >
                  {league.logo && <img src={league.logo} alt="" className="h-3.5 w-3.5 mr-1.5" />}
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
          className="text-xs text-muted-foreground rounded-full"
          onClick={() => { setSearch(''); setSelectedLeagues([]); setPopularOnly(false); setAnalyzedOnly(false); }}
        >
          <X className="h-3 w-3 mr-1.5" /> Réinitialiser
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display font-black text-2xl tracking-tight text-foreground">
              ANAP
            </h1>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => refetch()}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground bg-surface px-4 py-2 rounded-full">
                <span className="font-semibold text-foreground">{totalMatches}</span> matchs
                <span className="text-border">·</span>
                <span className="font-semibold text-primary">{analyzedCount}</span> analysés
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => dateNav(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <button 
              onClick={() => dateNav(0)} 
              className="px-5 py-2.5 rounded-full bg-surface hover:bg-surface-hover transition-colors font-display font-bold text-sm"
            >
              {isToday ? "Aujourd'hui" : format(date, 'EEEE d MMMM', { locale: fr })}
            </button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => dateNav(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="hidden md:block">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher…" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-11 h-10 w-56 bg-surface border-none rounded-full text-sm" 
              />
            </div>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden h-10 rounded-full gap-2 px-4">
                <SlidersHorizontal className="h-4 w-4" /> Filtres
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-card border-border rounded-t-3xl max-h-[80vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-display font-bold text-lg">Filtres</SheetTitle>
              </SheetHeader>
              <div className="mt-4"><FilterContent /></div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop filters */}
        <div className="hidden md:block glass rounded-3xl p-5">
          <FilterContent />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-medium">Chargement des matchs…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mb-4">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <p className="text-sm text-destructive font-semibold mb-1">Erreur de chargement</p>
            <p className="text-xs text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Réessayer
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && grouped.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
            <p className="text-muted-foreground text-sm font-medium">
              {totalMatches === 0 ? 'Aucun match trouvé pour cette date.' : 'Aucun match ne correspond aux filtres.'}
            </p>
          </motion.div>
        )}

        {/* Matches */}
        {!isLoading && !error && grouped.length > 0 && (
          <div className="space-y-5">
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
