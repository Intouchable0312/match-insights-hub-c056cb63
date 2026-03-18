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

// League priority mapping (API-Football IDs)
const LEAGUE_PRIORITIES: Record<number, number> = {
  1: 0,     // World Cup
  2: 0,     // Champions League
  3: 1,     // Europa League
  848: 1,   // Conference League
  32: 1,    // UEFA WC Qualifiers
  309: 2,   // Women's Champions League
  13: 2,    // Copa Libertadores
  11: 2,    // Copa Sudamericana
  12: 2,    // CAF Champions League
  16: 2,    // CONCACAF Champions Cup
  61: 3,    // Ligue 1
  39: 3,    // Premier League
  140: 3,   // La Liga
  135: 3,   // Serie A
  78: 3,    // Bundesliga
  66: 4,    // Coupe de France
  45: 4,    // FA Cup
  46: 4,    // EFL Cup
  143: 4,   // Copa del Rey
  137: 4,   // Coppa Italia
  81: 4,    // DFB Pokal
  147: 4,   // Belgian Cup
  180: 4,   // Scottish FA Cup
  63: 5,    // Ligue 2
  40: 5,    // Championship
  79: 5,    // Bundesliga 2
  141: 5,   // Liga Segunda
  136: 5,   // Serie B
  94: 5,    // Liga Portugal
  95: 5,    // Portugal Segunda Liga
  88: 5,    // Eredivisie
  144: 5,   // Belgian Pro League
  203: 6,   // Süper Lig
  179: 6,   // Scottish Premiership
  253: 6,   // MLS
  71: 6,    // Brazilian Série A
  262: 6,   // Liga MX
  128: 6,   // Argentine Primera
  207: 7,   // Swiss Super League
  106: 7,   // Ekstraklasa
  120: 7,   // Danish Superliga
  113: 7,   // Allsvenskan
  103: 7,   // Eliteserien
  218: 7,   // Austrian Bundesliga
  197: 7,   // Greek Super League
  345: 7,   // Czech First League
  283: 7,   // Romanian Liga I
  333: 7,   // Ukrainian Premier League
  98: 8,    // J-League
  292: 8,   // K-League
  169: 8,   // Chinese Super League
  188: 8,   // A-League
  239: 8,   // Colombian Primera A
  265: 8,   // Chilean Primera
  242: 8,   // Ecuadorian Serie A
  249: 8,   // Paraguayan Primera
  210: 8,   // Croatian HNL
  271: 8,   // Hungarian NB I
  286: 8,   // Serbian Super Liga
  172: 8,   // Bulgarian First League
  225: 9,   // Bosnian Premijer Liga
  318: 9,   // Cypriot Division 1
  329: 9,   // Estonian Meistriliiga
  244: 9,   // Finnish Veikkausliiga
  327: 9,   // Georgian Erovnuli Liga
  370: 9,   // Azerbaijani Premyer Liqası
  353: 9,   // Irish Premier Division
  365: 9,   // Latvian Virsliga
  362: 9,   // Lithuanian A Lyga
  374: 9,   // Luxembourg Division Nationale
  393: 9,   // Maltese Premier League
  408: 9,   // Northern Irish Premiership
  332: 9,   // Slovak Super Liga
  373: 9,   // Slovenian PrvaLiga
  110: 9,   // Welsh Premier League
};

export function getLeaguePriority(leagueId: number): number {
  return LEAGUE_PRIORITIES[leagueId] ?? 10;
}
