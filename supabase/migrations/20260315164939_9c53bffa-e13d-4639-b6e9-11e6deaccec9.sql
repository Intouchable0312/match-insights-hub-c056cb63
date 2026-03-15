
-- Drop overly permissive policies
DROP POLICY "Matches can be inserted by service role" ON public.matches;
DROP POLICY "Matches can be updated by service role" ON public.matches;
DROP POLICY "Analyses can be inserted" ON public.analyses;
DROP POLICY "Analyses can be updated" ON public.analyses;

-- Recreate with service role restriction (only service_role can write)
CREATE POLICY "Service role can insert matches" ON public.matches FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update matches" ON public.matches FOR UPDATE TO service_role USING (true);
CREATE POLICY "Service role can insert analyses" ON public.analyses FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update analyses" ON public.analyses FOR UPDATE TO service_role USING (true);
