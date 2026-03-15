-- =============================================================================
-- STEP 8 — DATABASE DESIGN: cry_analysis table (Supabase)
-- =============================================================================
-- Run this in Supabase SQL Editor to create the table.
-- Columns: id, session_id, audio_url, cry_type, confidence_score, created_at, user_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cry_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    audio_url TEXT,
    cry_type TEXT NOT NULL,
    confidence_score DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- RLS: users can only read/insert their own rows
ALTER TABLE public.cry_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cry_analysis"
    ON public.cry_analysis FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cry_analysis"
    ON public.cry_analysis FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Optional: index for listing by user and time
CREATE INDEX IF NOT EXISTS idx_cry_analysis_user_created
    ON public.cry_analysis (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cry_analysis_session
    ON public.cry_analysis (session_id) WHERE session_id IS NOT NULL;

COMMENT ON TABLE public.cry_analysis IS 'Baby cry AI analysis results: cry_type (belly pain, burping, discomfort, hungry, tired)';
