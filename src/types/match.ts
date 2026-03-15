export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

export type AnalysisStatus = 
  | 'not_requested'
  | 'quick_available'
  | 'generating'
  | 'completed'
  | 'expired'
  | 'partial'
  | 'error';

export type DataQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient';

export interface League {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  priority: number; // lower = higher priority
  logo?: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
}

export interface Match {
  id: string;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  kickoff: string; // ISO date
  status: MatchStatus;
  venue?: string;
  homeScore?: number;
  awayScore?: number;
  dataQuality: DataQuality;
  uncertaintyLevel: number; // 0-100
  analysisStatus: AnalysisStatus;
  quickAnalysis?: QuickAnalysis;
}

export interface QuickAnalysis {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  homeForm: string; // e.g. "WWDLW"
  awayForm: string;
  homeElo: number;
  awayElo: number;
  confidence: number; // 0-100
}

export interface FullAnalysis {
  id: string;
  matchId: string;
  status: AnalysisStatus;
  requestedAt: string;
  completedAt?: string;
  modelVersion: string;
  dataQualityScore: number;
  uncertaintyScore: number;
  sourceCount: number;
  prediction: Prediction;
  report: AnalysisReport;
}

export interface Prediction {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  predictedScore: { home: number; away: number };
  expectedGoals: number;
  bttsProb: number;
  over25Prob: number;
  over15Prob: number;
  under25Prob: number;
  firstToScoreProb: { home: number; away: number; noGoal: number };
  confidence: number;
}

export interface AnalysisReport {
  summary: string;
  keyFactors: AnalysisFactor[];
  sources: AnalysisSource[];
  missingVariables: string[];
  timeline: AnalysisEvent[];
}

export interface AnalysisFactor {
  name: string;
  impact: 'high' | 'medium' | 'low';
  direction: 'home' | 'away' | 'neutral';
  description: string;
}

export interface AnalysisSource {
  name: string;
  type: string;
  reliability: number;
  lastUpdated: string;
}

export interface AnalysisEvent {
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

export interface MatchFilters {
  date: Date;
  search: string;
  leagueIds: string[];
  countries: string[];
  popularOnly: boolean;
  sufficientDataOnly: boolean;
  analyzedOnly: boolean;
}
