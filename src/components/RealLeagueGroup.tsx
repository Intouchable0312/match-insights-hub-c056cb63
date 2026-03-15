import { DbMatch, getLeaguePriority } from '@/lib/api';
import { RealMatchCard } from './RealMatchCard';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RealLeagueGroupProps {
  leagueName: string;
  leagueLogo: string | null;
  leagueFlag: string | null;
  leagueCountry: string;
  matches: DbMatch[];
}

export function RealLeagueGroup({ leagueName, leagueLogo, leagueFlag, leagueCountry, matches }: RealLeagueGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full group py-1"
      >
        {leagueLogo ? (
          <img src={leagueLogo} alt="" className="h-5 w-5 object-contain" />
        ) : leagueFlag ? (
          <img src={leagueFlag} alt="" className="h-4 w-auto" />
        ) : (
          <span className="text-lg">⚽</span>
        )}
        <h3 className="font-display font-semibold text-sm text-foreground">{leagueName}</h3>
        <span className="text-xs text-muted-foreground">· {leagueCountry}</span>
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
              <RealMatchCard key={match.id} match={match} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
