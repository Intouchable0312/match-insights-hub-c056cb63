import { Match } from '@/types/match';
import { MatchCard } from './MatchCard';
import { COUNTRY_FLAGS } from '@/data/mockData';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeagueGroupProps {
  leagueName: string;
  countryCode: string;
  country: string;
  matches: Match[];
}

export function LeagueGroup({ leagueName, countryCode, country, matches }: LeagueGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const flag = COUNTRY_FLAGS[countryCode] || '⚽';

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full group py-1"
      >
        <span className="text-lg">{flag}</span>
        <h3 className="font-display font-semibold text-sm text-foreground">{leagueName}</h3>
        <span className="text-xs text-muted-foreground">· {country}</span>
        <span className="text-xs text-muted-foreground ml-auto">{matches.length} match{matches.length > 1 ? 's' : ''}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {matches.map((match, i) => (
              <MatchCard key={match.id} match={match} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
