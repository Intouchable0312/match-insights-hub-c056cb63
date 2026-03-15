
-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Matches table: stores real match data from API-Football
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_fixture_id INTEGER NOT NULL UNIQUE,
  league_id INTEGER NOT NULL,
  league_name TEXT NOT NULL,
  league_country TEXT NOT NULL,
  league_logo TEXT,
  league_flag TEXT,
  league_round TEXT,
  home_team_id INTEGER NOT NULL,
  home_team_name TEXT NOT NULL,
  home_team_logo TEXT,
  away_team_id INTEGER NOT NULL,
  away_team_name TEXT NOT NULL,
  away_team_logo TEXT,
  kickoff TIMESTAMP WITH TIME ZONE NOT NULL,
  venue_name TEXT,
  venue_city TEXT,
  status_short TEXT NOT NULL DEFAULT 'NS',
  status_long TEXT NOT NULL DEFAULT 'Not Started',
  home_score INTEGER,
  away_score INTEGER,
  home_score_ht INTEGER,
  away_score_ht INTEGER,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_kickoff ON public.matches (kickoff);
CREATE INDEX idx_matches_league ON public.matches (league_id);
CREATE INDEX idx_matches_api_fixture ON public.matches (api_fixture_id);

-- Analyses table: stores AI-generated analyses
CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'error', 'expired')),
  analysis_type TEXT NOT NULL DEFAULT 'full' CHECK (analysis_type IN ('quick', 'full')),
  model_version TEXT,
  data_quality_score INTEGER,
  uncertainty_score INTEGER,
  source_count INTEGER,
  
  -- Prediction payload (JSONB)
  prediction JSONB,
  
  -- Full report payload (JSONB)  
  report JSONB,
  
  -- Raw AI response for debugging
  raw_response TEXT,
  
  error_message TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_analyses_match ON public.analyses (match_id);
CREATE INDEX idx_analyses_status ON public.analyses (status);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Matches are readable by everyone (public data)
CREATE POLICY "Matches are publicly readable" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Matches can be inserted by service role" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Matches can be updated by service role" ON public.matches FOR UPDATE USING (true);

-- Analyses are readable by everyone, writable by service role
CREATE POLICY "Analyses are publicly readable" ON public.analyses FOR SELECT USING (true);
CREATE POLICY "Analyses can be inserted" ON public.analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Analyses can be updated" ON public.analyses FOR UPDATE USING (true);

-- Triggers
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON public.analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
