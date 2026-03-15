import { useState, useMemo } from 'react';
import { MOCK_MATCHES } from '@/data/mockData';
import { MatchFilters, Match } from '@/types/match';
import { DashboardFilters } from '@/components/DashboardFilters';
import { LeagueGroup } from '@/components/LeagueGroup';
import { motion } from 'framer-motion';
import { Activity, TrendingUp } from 'lucide-react';

const Index = () => {
  const [filters, setFilters] = useState<MatchFilters>({
    date: new Date(),
    search: '',
    leagueIds: [],
    countries: [],
    popularOnly: false,
    sufficientDataOnly: false,
    analyzedOnly: false,
  });

  const filteredMatches = useMemo(() => {
    let matches = MOCK_MATCHES;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      matches = matches.filter(m =>
        m.homeTeam.name.toLowerCase().includes(q) ||
        m.awayTeam.name.toLowerCase().includes(q) ||
        m.league.name.toLowerCase().includes(q)
      );
    }
    if (filters.leagueIds.length > 0) {
      matches = matches.filter(m => filters.leagueIds.includes(m.league.id));
    }
    if (filters.countries.length > 0) {
      matches = matches.filter(m => filters.countries.includes(m.league.country));
    }
    if (filters.popularOnly) {
      matches = matches.filter(m => m.league.priority <= 3);
    }
    if (filters.sufficientDataOnly) {
      matches = matches.filter(m => m.dataQuality !== 'poor' && m.dataQuality !== 'insufficient');
    }
    if (filters.analyzedOnly) {
      matches = matches.filter(m => m.analysisStatus === 'completed');
    }

    return matches;
  }, [filters]);

  // Group by league, sorted by priority then name
  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    filteredMatches.forEach(m => {
      const key = m.league.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });

    // Sort within each group by kickoff
    map.forEach((matches) => {
      matches.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    });

    // Sort groups by league priority
    return [...map.entries()].sort((a, b) => {
      const la = a[1][0].league;
      const lb = b[1][0].league;
      return la.priority - lb.priority || la.name.localeCompare(lb.name);
    });
  }, [filteredMatches]);

  const totalMatches = filteredMatches.length;
  const analyzedCount = filteredMatches.filter(m => m.analysisStatus === 'completed').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <DashboardFilters filters={filters} onChange={setFilters} />

        {grouped.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-muted-foreground text-sm">Aucun match trouvé pour ces critères.</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([leagueId, matches]) => (
              <LeagueGroup
                key={leagueId}
                leagueName={matches[0].league.name}
                countryCode={matches[0].league.countryCode}
                country={matches[0].league.country}
                matches={matches}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
