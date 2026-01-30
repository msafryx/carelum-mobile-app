-- Migration: Add started_at to sessions and session_events table for Session Start flow
-- Run this on existing databases that already have sessions table without started_at

-- Add started_at to sessions (when sitter starts session → LIVE)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Session timeline events (SESSION_STARTED, SESSION_COMPLETED, etc.)
CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('session_started', 'session_completed', 'session_cancelled')),
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_created_at ON session_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at) WHERE started_at IS NOT NULL;

-- RLS for session_events
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read session events for own sessions" ON session_events;
CREATE POLICY "Users can read session events for own sessions" ON session_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_events.session_id
      AND (s.parent_id = auth.uid() OR s.sitter_id = auth.uid())
    ) OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
DROP POLICY IF EXISTS "Sitter can insert session_started for assigned session" ON session_events;
CREATE POLICY "Sitter can insert session_started for assigned session" ON session_events
  FOR INSERT WITH CHECK (
    type = 'session_started' AND triggered_by = auth.uid()
    AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_events.session_id AND s.sitter_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users can insert session_completed_cancelled for own sessions" ON session_events;
CREATE POLICY "Users can insert session_completed_cancelled for own sessions" ON session_events
  FOR INSERT WITH CHECK (
    type IN ('session_completed', 'session_cancelled')
    AND (triggered_by = auth.uid())
    AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_events.session_id AND (s.parent_id = auth.uid() OR s.sitter_id = auth.uid()))
  );
