-- =============================================================================
-- Migration: Meeting requests (pre-booking video call) + new alert types
-- Run this in Supabase SQL Editor after your main schema is applied.
-- If your main schema already includes meeting_requests and the new alert types,
-- you can skip this file.
-- =============================================================================

-- 1) Add new alert types for meeting requests (parent/sitter notifications)
-- Drop existing type check (name may be alerts_type_check or auto-generated).
-- If DROP fails, run: SELECT conname FROM pg_constraint WHERE conrelid = 'alerts'::regclass AND contype = 'c';
-- then: ALTER TABLE alerts DROP CONSTRAINT <that_name>;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (type IN (
  'cry_detection', 'emergency', 'gps_anomaly', 'session_reminder', 'session_request',
  'session_accepted', 'session_cancelled', 'session_started', 'session_completed',
  'interview_scheduled', 'meeting_request', 'meeting_accepted', 'meeting_declined'
));

-- 2) Pre-booking video call table (parent requests to meet sitter before sending a session request)
CREATE TABLE IF NOT EXISTS meeting_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sitter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferred_time TIMESTAMPTZ,
  scheduled_time TIMESTAMPTZ,
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_parent_id ON meeting_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_sitter_id ON meeting_requests(sitter_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);

-- 3) Trigger for updated_at (reuse existing function if present)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meeting_requests_updated_at ON meeting_requests;
CREATE TRIGGER update_meeting_requests_updated_at BEFORE UPDATE ON meeting_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4) RLS for meeting_requests
ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parent and sitter can read own meeting requests" ON meeting_requests;
CREATE POLICY "Parent and sitter can read own meeting requests" ON meeting_requests
  FOR SELECT USING (parent_id = auth.uid() OR sitter_id = auth.uid());

DROP POLICY IF EXISTS "Parent can create meeting request" ON meeting_requests;
CREATE POLICY "Parent can create meeting request" ON meeting_requests
  FOR INSERT WITH CHECK (parent_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update meeting request" ON meeting_requests;
CREATE POLICY "Participants can update meeting request" ON meeting_requests
  FOR UPDATE USING (parent_id = auth.uid() OR sitter_id = auth.uid());
