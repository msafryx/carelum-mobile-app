-- ============================================================
-- Migration: Session Timeline (Prompt 9) + Parent Review (Prompt 10)
-- Run this in Supabase SQL Editor if you already have the DB created.
-- Safe to run multiple times (idempotent where possible).
-- ============================================================

-- 1) Session events: allow new event types (session_requested, session_accepted, monitoring_disabled, cry_detected, admin_action)
-- If your constraint has a different name, check: SELECT conname FROM pg_constraint WHERE conrelid = 'session_events'::regclass AND contype = 'c';
ALTER TABLE session_events
  DROP CONSTRAINT IF EXISTS session_events_type_check;

ALTER TABLE session_events
  ADD CONSTRAINT session_events_type_check
  CHECK (type IN (
    'session_requested',
    'session_accepted',
    'session_started',
    'monitoring_enabled',
    'monitoring_disabled',
    'cry_detected',
    'session_completed',
    'session_cancelled',
    'admin_action',
    'sitter_requested_end',
    'session_time_expired',
    'session_extended',
    'session_auto_completed',
    'admin_force_end',
    'emergency_contact_called'
  ));

-- 2) Session events: allow session participants and admin to insert timeline events
DROP POLICY IF EXISTS "Session participants and admin can insert timeline events" ON session_events;
CREATE POLICY "Session participants and admin can insert timeline events" ON session_events
  FOR INSERT WITH CHECK (
    triggered_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM sessions s WHERE s.id = session_events.session_id AND (s.parent_id = auth.uid() OR s.sitter_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
    )
  );

-- 3) Reviews: allow admins to delete (moderate) reviews
DROP POLICY IF EXISTS "Admin can delete reviews" ON reviews;
CREATE POLICY "Admin can delete reviews" ON reviews
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- 4) Emergency call (Prompt 13): children emergency fields
ALTER TABLE children ADD COLUMN IF NOT EXISTS medical_notes TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS doctor_contact TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS doctor_phone TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- 5) Child Care Assistant (Prompt): child_care_instructions + assistant_query_logs
CREATE TABLE IF NOT EXISTS child_care_instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  instruction_type TEXT NOT NULL CHECK (instruction_type IN ('feeding', 'sleep', 'medicine', 'behavior', 'safety', 'general')),
  instruction_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_child_care_instructions_child_id ON child_care_instructions(child_id);

CREATE TABLE IF NOT EXISTS assistant_query_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assistant_query_logs_session_id ON assistant_query_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_assistant_query_logs_created_at ON assistant_query_logs(created_at DESC);

ALTER TABLE child_care_instructions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read child_care_instructions for own or session child" ON child_care_instructions;
CREATE POLICY "Read child_care_instructions for own or session child" ON child_care_instructions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM children c WHERE c.id = child_care_instructions.child_id AND c.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM sessions s WHERE s.child_id = child_care_instructions.child_id AND (s.parent_id = auth.uid() OR s.sitter_id = auth.uid()))
  );
DROP POLICY IF EXISTS "Parent can manage child_care_instructions" ON child_care_instructions;
CREATE POLICY "Parent can manage child_care_instructions" ON child_care_instructions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM children c WHERE c.id = child_care_instructions.child_id AND c.parent_id = auth.uid())
  );

ALTER TABLE assistant_query_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Session participants can insert assistant logs" ON assistant_query_logs;
CREATE POLICY "Session participants can insert assistant logs" ON assistant_query_logs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = assistant_query_logs.session_id AND (s.parent_id = auth.uid() OR s.sitter_id = auth.uid()))
  );
DROP POLICY IF EXISTS "Participants and admin can read assistant logs" ON assistant_query_logs;
CREATE POLICY "Participants and admin can read assistant logs" ON assistant_query_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sessions s WHERE s.id = assistant_query_logs.session_id AND (s.parent_id = auth.uid() OR s.sitter_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
