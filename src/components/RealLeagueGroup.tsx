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
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full group px-1"
      >
        <div className="h-8 w-8 rounded-xl bg-surface flex items-center justify-center overflow-hidden shrink-0">
          {leagueLogo ? (
            <img src={leagueLogo} alt="" className="h-5 w-5 object-contain" />
          ) : leagueFlag ? (
            <img src={leagueFlag} alt="" className="h-4 w-auto" />
          ) : (
            <span className="text-sm">⚽</span>
          )}
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-display font-bold text-sm">{leagueName}</h3>
          <p className="text-xs text-muted-foreground">{leagueCountry} · {matches.length} match{matches.length > 1 ? 's' : ''}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
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
