import { League, Match, FullAnalysis, QuickAnalysis } from '@/types/match';

export const LEAGUES: League[] = [
  { id: 'ligue1', name: 'Ligue 1', country: 'France', countryCode: 'FR', priority: 1 },
  { id: 'premier-league', name: 'Premier League', country: 'Angleterre', countryCode: 'GB', priority: 1 },
  { id: 'la-liga', name: 'La Liga', country: 'Espagne', countryCode: 'ES', priority: 1 },
  { id: 'serie-a', name: 'Serie A', country: 'Italie', countryCode: 'IT', priority: 1 },
  { id: 'bundesliga', name: 'Bundesliga', country: 'Allemagne', countryCode: 'DE', priority: 1 },
  { id: 'ucl', name: 'Champions League', country: 'Europe', countryCode: 'EU', priority: 0 },
  { id: 'uel', name: 'Europa League', country: 'Europe', countryCode: 'EU', priority: 2 },
  { id: 'uecl', name: 'Conference League', country: 'Europe', countryCode: 'EU', priority: 3 },
  { id: 'mls', name: 'MLS', country: 'USA', countryCode: 'US', priority: 4 },
  { id: 'saudi', name: 'Saudi Pro League', country: 'Arabie Saoudite', countryCode: 'SA', priority: 4 },
  { id: 'eredivisie', name: 'Eredivisie', country: 'Pays-Bas', countryCode: 'NL', priority: 5 },
  { id: 'primeira', name: 'Primeira Liga', country: 'Portugal', countryCode: 'PT', priority: 5 },
  { id: 'championship', name: 'Championship', country: 'Angleterre', countryCode: 'GB', priority: 5 },
  { id: 'super-lig', name: 'Süper Lig', country: 'Turquie', countryCode: 'TR', priority: 6 },
  { id: 'belgian', name: 'Belgian Pro League', country: 'Belgique', countryCode: 'BE', priority: 6 },
  { id: 'scottish', name: 'Scottish Premiership', country: 'Écosse', countryCode: 'GB', priority: 7 },
  { id: 'libertadores', name: 'Copa Libertadores', country: 'Amérique du Sud', countryCode: 'SA', priority: 3 },
];

const makeQuick = (hw: number, d: number, aw: number, conf: number): QuickAnalysis => ({
  homeWinProb: hw, drawProb: d, awayWinProb: aw,
  homeForm: ['W','D','L','W','W'].sort(() => Math.random() - 0.5).join(''),
  awayForm: ['L','W','D','W','L'].sort(() => Math.random() - 0.5).join(''),
  homeElo: 1500 + Math.floor(Math.random() * 400),
  awayElo: 1500 + Math.floor(Math.random() * 400),
  confidence: conf,
});

const today = new Date().toISOString().split('T')[0];

export const MOCK_MATCHES: Match[] = [
  // Premier League
  { id: 'm1', league: LEAGUES[1], homeTeam: { id: 't1', name: 'Arsenal', shortName: 'ARS' }, awayTeam: { id: 't2', name: 'Chelsea', shortName: 'CHE' }, kickoff: `${today}T15:00:00Z`, status: 'scheduled', dataQuality: 'excellent', uncertaintyLevel: 22, analysisStatus: 'quick_available', quickAnalysis: makeQuick(48, 26, 26, 82) },
  { id: 'm2', league: LEAGUES[1], homeTeam: { id: 't3', name: 'Manchester United', shortName: 'MUN' }, awayTeam: { id: 't4', name: 'Liverpool', shortName: 'LIV' }, kickoff: `${today}T17:30:00Z`, status: 'scheduled', dataQuality: 'excellent', uncertaintyLevel: 18, analysisStatus: 'not_requested', quickAnalysis: makeQuick(32, 28, 40, 85) },
  { id: 'm3', league: LEAGUES[1], homeTeam: { id: 't5', name: 'Tottenham', shortName: 'TOT' }, awayTeam: { id: 't6', name: 'Aston Villa', shortName: 'AVL' }, kickoff: `${today}T20:00:00Z`, status: 'scheduled', dataQuality: 'good', uncertaintyLevel: 30, analysisStatus: 'not_requested', quickAnalysis: makeQuick(44, 28, 28, 75) },
  // Ligue 1
  { id: 'm4', league: LEAGUES[0], homeTeam: { id: 't7', name: 'Paris Saint-Germain', shortName: 'PSG' }, awayTeam: { id: 't8', name: 'Olympique de Marseille', shortName: 'OM' }, kickoff: `${today}T21:00:00Z`, status: 'scheduled', dataQuality: 'excellent', uncertaintyLevel: 15, analysisStatus: 'completed', quickAnalysis: makeQuick(58, 22, 20, 88) },
  { id: 'm5', league: LEAGUES[0], homeTeam: { id: 't9', name: 'OGC Nice', shortName: 'NCE' }, awayTeam: { id: 't10', name: 'AS Monaco', shortName: 'MON' }, kickoff: `${today}T19:00:00Z`, status: 'scheduled', dataQuality: 'good', uncertaintyLevel: 35, analysisStatus: 'not_requested', quickAnalysis: makeQuick(38, 30, 32, 70) },
  // La Liga
  { id: 'm6', league: LEAGUES[2], homeTeam: { id: 't11', name: 'Real Madrid', shortName: 'RMA' }, awayTeam: { id: 't12', name: 'FC Barcelona', shortName: 'FCB' }, kickoff: `${today}T21:00:00Z`, status: 'scheduled', venue: 'Santiago Bernabéu', dataQuality: 'excellent', uncertaintyLevel: 20, analysisStatus: 'not_requested', quickAnalysis: makeQuick(42, 25, 33, 90) },
  { id: 'm7', league: LEAGUES[2], homeTeam: { id: 't13', name: 'Atlético Madrid', shortName: 'ATM' }, awayTeam: { id: 't14', name: 'Real Sociedad', shortName: 'RSO' }, kickoff: `${today}T16:15:00Z`, status: 'scheduled', dataQuality: 'good', uncertaintyLevel: 28, analysisStatus: 'not_requested', quickAnalysis: makeQuick(50, 26, 24, 78) },
  // Serie A
  { id: 'm8', league: LEAGUES[3], homeTeam: { id: 't15', name: 'Inter Milan', shortName: 'INT' }, awayTeam: { id: 't16', name: 'AC Milan', shortName: 'MIL' }, kickoff: `${today}T20:45:00Z`, status: 'scheduled', venue: 'San Siro', dataQuality: 'excellent', uncertaintyLevel: 25, analysisStatus: 'quick_available', quickAnalysis: makeQuick(45, 27, 28, 80) },
  { id: 'm9', league: LEAGUES[3], homeTeam: { id: 't17', name: 'Juventus', shortName: 'JUV' }, awayTeam: { id: 't18', name: 'SSC Napoli', shortName: 'NAP' }, kickoff: `${today}T18:00:00Z`, status: 'scheduled', dataQuality: 'good', uncertaintyLevel: 30, analysisStatus: 'not_requested', quickAnalysis: makeQuick(40, 28, 32, 76) },
  // Bundesliga
  { id: 'm10', league: LEAGUES[4], homeTeam: { id: 't19', name: 'Bayern Munich', shortName: 'BAY' }, awayTeam: { id: 't20', name: 'Borussia Dortmund', shortName: 'BVB' }, kickoff: `${today}T18:30:00Z`, status: 'scheduled', dataQuality: 'excellent', uncertaintyLevel: 20, analysisStatus: 'not_requested', quickAnalysis: makeQuick(52, 24, 24, 84) },
  // Champions League
  { id: 'm11', league: LEAGUES[5], homeTeam: { id: 't1', name: 'Arsenal', shortName: 'ARS' }, awayTeam: { id: 't19', name: 'Bayern Munich', shortName: 'BAY' }, kickoff: `${today}T21:00:00Z`, status: 'scheduled', venue: 'Emirates Stadium', dataQuality: 'excellent', uncertaintyLevel: 22, analysisStatus: 'not_requested', quickAnalysis: makeQuick(40, 28, 32, 82) },
  // Eredivisie
  { id: 'm12', league: LEAGUES[10], homeTeam: { id: 't21', name: 'Ajax Amsterdam', shortName: 'AJX' }, awayTeam: { id: 't22', name: 'PSV Eindhoven', shortName: 'PSV' }, kickoff: `${today}T16:45:00Z`, status: 'scheduled', dataQuality: 'fair', uncertaintyLevel: 40, analysisStatus: 'not_requested', quickAnalysis: makeQuick(38, 30, 32, 65) },
  // MLS
  { id: 'm13', league: LEAGUES[8], homeTeam: { id: 't23', name: 'Inter Miami', shortName: 'MIA' }, awayTeam: { id: 't24', name: 'LA Galaxy', shortName: 'LAG' }, kickoff: `${today}T01:30:00Z`, status: 'finished', homeScore: 3, awayScore: 1, dataQuality: 'good', uncertaintyLevel: 35, analysisStatus: 'completed', quickAnalysis: makeQuick(45, 25, 30, 72) },
  // Saudi Pro League
  { id: 'm14', league: LEAGUES[9], homeTeam: { id: 't25', name: 'Al-Hilal', shortName: 'HIL' }, awayTeam: { id: 't26', name: 'Al-Nassr', shortName: 'NAS' }, kickoff: `${today}T19:00:00Z`, status: 'scheduled', dataQuality: 'fair', uncertaintyLevel: 42, analysisStatus: 'not_requested', quickAnalysis: makeQuick(44, 28, 28, 60) },
];

export const MOCK_FULL_ANALYSIS: FullAnalysis = {
  id: 'a1',
  matchId: 'm4',
  status: 'completed',
  requestedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  modelVersion: 'v2.4.1',
  dataQualityScore: 92,
  uncertaintyScore: 15,
  sourceCount: 8,
  prediction: {
    homeWinProb: 58,
    drawProb: 22,
    awayWinProb: 20,
    predictedScore: { home: 2, away: 1 },
    expectedGoals: 2.8,
    bttsProb: 62,
    over25Prob: 58,
    over15Prob: 82,
    under25Prob: 42,
    firstToScoreProb: { home: 55, away: 35, noGoal: 10 },
    confidence: 88,
  },
  report: {
    summary: "Le PSG part favori dans ce Classique avec un avantage net à domicile. La forme récente et la profondeur de l'effectif parisien font pencher la balance. L'OM pourrait toutefois créer la surprise si la pression défensive fonctionne.",
    keyFactors: [
      { name: 'Avantage domicile', impact: 'high', direction: 'home', description: 'Le PSG affiche 85% de victoires à domicile cette saison' },
      { name: 'Forme récente', impact: 'high', direction: 'home', description: 'PSG sur une série de 8 victoires consécutives' },
      { name: 'Confrontations directes', impact: 'medium', direction: 'home', description: '7 victoires sur les 10 derniers Classiques' },
      { name: 'Absences', impact: 'medium', direction: 'away', description: "2 joueurs clés absents côté PSG" },
      { name: 'Motivation', impact: 'medium', direction: 'away', description: "L'OM joue pour une place en Ligue des Champions" },
      { name: 'Fatigue', impact: 'low', direction: 'home', description: 'Match de C1 en milieu de semaine pour le PSG' },
    ],
    sources: [
      { name: 'Football-Data.co.uk', type: 'statistics', reliability: 92, lastUpdated: new Date().toISOString() },
      { name: 'Transfermarkt', type: 'squad', reliability: 88, lastUpdated: new Date().toISOString() },
      { name: 'FBref', type: 'advanced_stats', reliability: 95, lastUpdated: new Date().toISOString() },
      { name: 'Understat', type: 'xG', reliability: 90, lastUpdated: new Date().toISOString() },
      { name: 'SofaScore', type: 'live_data', reliability: 85, lastUpdated: new Date().toISOString() },
      { name: 'WhoScored', type: 'ratings', reliability: 82, lastUpdated: new Date().toISOString() },
      { name: 'ClubElo', type: 'elo', reliability: 88, lastUpdated: new Date().toISOString() },
      { name: 'Odds Portal', type: 'odds', reliability: 80, lastUpdated: new Date().toISOString() },
    ],
    missingVariables: ['Météo détaillée', 'Composition confirmée', 'Données blessures temps réel'],
    timeline: [
      { timestamp: new Date().toISOString(), message: 'Récupération des données match', type: 'info' },
      { timestamp: new Date().toISOString(), message: 'Agrégation des 8 sources', type: 'info' },
      { timestamp: new Date().toISOString(), message: 'Calcul des features', type: 'info' },
      { timestamp: new Date().toISOString(), message: '3 variables manquantes détectées', type: 'warning' },
      { timestamp: new Date().toISOString(), message: 'Estimation probabiliste terminée', type: 'success' },
      { timestamp: new Date().toISOString(), message: 'Rapport généré avec succès', type: 'success' },
    ],
  },
};

export const COUNTRY_FLAGS: Record<string, string> = {
  FR: '🇫🇷', GB: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ES: '🇪🇸', IT: '🇮🇹', DE: '🇩🇪', EU: '🇪🇺',
  US: '🇺🇸', SA: '🇸🇦', NL: '🇳🇱', PT: '🇵🇹', TR: '🇹🇷', BE: '🇧🇪',
};
