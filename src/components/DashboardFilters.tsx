import { MatchFilters } from '@/types/match';
import { LEAGUES, COUNTRY_FLAGS } from '@/data/mockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, Calendar, Star, Database, CheckCircle2, SlidersHorizontal, X } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

interface DashboardFiltersProps {
  filters: MatchFilters;
  onChange: (filters: MatchFilters) => void;
}

export function DashboardFilters({ filters, onChange }: DashboardFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const update = (partial: Partial<MatchFilters>) => onChange({ ...filters, ...partial });

  const dateNav = (dir: -1 | 0 | 1) => {
    if (dir === 0) update({ date: new Date() });
    else update({ date: dir === -1 ? subDays(filters.date, 1) : addDays(filters.date, 1) });
  };

  const isToday = format(filters.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  const uniqueCountries = [...new Set(LEAGUES.map(l => l.country))];

  const FilterContent = () => (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une équipe…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="pl-9 bg-surface border-border"
        />
      </div>

      {/* Toggle Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-gold" />
            <span>Ligues populaires uniquement</span>
          </div>
          <Switch checked={filters.popularOnly} onCheckedChange={(v) => update({ popularOnly: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-info" />
            <span>Données suffisantes uniquement</span>
          </div>
          <Switch checked={filters.sufficientDataOnly} onCheckedChange={(v) => update({ sufficientDataOnly: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Analyses générées uniquement</span>
          </div>
          <Switch checked={filters.analyzedOnly} onCheckedChange={(v) => update({ analyzedOnly: v })} />
        </div>
      </div>

      {/* League Filter */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Ligues</p>
        <div className="flex flex-wrap gap-1.5">
          {LEAGUES.sort((a, b) => a.priority - b.priority).map(league => {
            const active = filters.leagueIds.includes(league.id);
            return (
              <Badge
                key={league.id}
                variant={active ? 'default' : 'outline'}
                className={`cursor-pointer text-xs transition-all ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-hover'}`}
                onClick={() => {
                  update({
                    leagueIds: active
                      ? filters.leagueIds.filter(id => id !== league.id)
                      : [...filters.leagueIds, league.id],
                  });
                }}
              >
                {COUNTRY_FLAGS[league.countryCode] || '⚽'} {league.name}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Country Filter */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Pays</p>
        <div className="flex flex-wrap gap-1.5">
          {uniqueCountries.map(country => {
            const active = filters.countries.includes(country);
            return (
              <Badge
                key={country}
                variant={active ? 'default' : 'outline'}
                className={`cursor-pointer text-xs transition-all ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-hover'}`}
                onClick={() => {
                  update({
                    countries: active
                      ? filters.countries.filter(c => c !== country)
                      : [...filters.countries, country],
                  });
                }}
              >
                {country}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      {(filters.search || filters.leagueIds.length > 0 || filters.countries.length > 0 || filters.popularOnly || filters.sufficientDataOnly || filters.analyzedOnly) && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => update({ search: '', leagueIds: [], countries: [], popularOnly: false, sufficientDataOnly: false, analyzedOnly: false })}
        >
          <X className="h-3 w-3 mr-1" /> Réinitialiser les filtres
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dateNav(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => dateNav(0)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
          >
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-sm">
              {isToday ? "Aujourd'hui" : format(filters.date, 'EEEE d MMMM', { locale: fr })}
            </span>
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dateNav(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop Filters inline search */}
        <div className="hidden md:flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              className="pl-9 h-8 w-48 bg-surface border-border text-sm"
            />
          </div>
        </div>

        {/* Mobile filter button */}
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
            <div className="mt-4">
              <FilterContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop expanded filters */}
      <div className="hidden md:block glass rounded-lg p-4">
        <FilterContent />
      </div>
    </div>
  );
}
