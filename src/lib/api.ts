import { supabase } from '@/integrations/supabase/client';

export interface DbMatch {
  id: string;
  api_fixture_id: number;
  league_id: number;
  league_name: string;
  league_country: string;
  league_logo: string | null;
  league_flag: string | null;
  league_round: string | null;
  home_team_id: number;
  home_team_name: string;
  home_team_logo: string | null;
  away_team_id: number;
  away_team_name: string;
  away_team_logo: string | null;
  kickoff: string;
  venue_name: string | null;
  venue_city: string | null;
  status_short: string;
  status_long: string;
  home_score: number | null;
  away_score: number | null;
  fetched_at: string;
  analyses: DbAnalysis[];
}

export interface DbAnalysis {
  id: string;
  match_id: string;
  status: string;
  analysis_type: string;
  prediction: any;
  report: any;
  model_version: string | null;
  data_quality_score: number | null;
  uncertainty_score: number | null;
  source_count: number | null;
  completed_at: string | null;
  error_message: string | null;
  requested_at: string;
}

export async function fetchMatches(date: string): Promise<DbMatch[]> {
  const { data, error } = await supabase.functions.invoke('fetch-matches', {
    body: null,
    headers: { 'Content-Type': 'application/json' },
  });

  // Use query params via manual fetch since invoke doesn't support query params easily
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-matches?date=${date}`,
    {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result.matches || [];
}

export async function analyzeMatch(matchId: string, type: 'quick' | 'full' = 'full'): Promise<DbAnalysis> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-match`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ match_id: matchId, analysis_type: type }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (response.status === 429) throw new Error('Trop de requêtes. Réessayez dans quelques instants.');
    if (response.status === 402) throw new Error('Crédits insuffisants. Veuillez recharger votre compte.');
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return result.analysis;
}

export async function getAnalysis(matchId: string): Promise<DbAnalysis | null> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return (data && data.length > 0) ? data[0] as unknown as DbAnalysis : null;
}

// League priority mapping
const LEAGUE_PRIORITIES: Record<number, number> = {
  2: 0,    // Champions League
  61: 1,   // Ligue 1
  39: 1,   // Premier League
  140: 1,  // La Liga
  135: 1,  // Serie A
  78: 1,   // Bundesliga
  3: 2,    // Europa League
  848: 3,  // Conference League
  13: 3,   // Copa Libertadores
  253: 4,  // MLS
  307: 4,  // Saudi Pro League
  88: 5,   // Eredivisie
  94: 5,   // Primeira Liga
  40: 5,   // Championship
  203: 6,  // Super Lig
  144: 6,  // Belgian Pro League
  179: 7,  // Scottish Premiership
};

export function getLeaguePriority(leagueId: number): number {
  return LEAGUE_PRIORITIES[leagueId] ?? 10;
}
