-- Migration: Add alert types for session notifications (session_request, session_accepted, session_cancelled)
-- Run this on existing databases so backend can create these alert types for sitter/parent notifications.

-- Drop existing type check (try common name first)
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_check;

-- If your DB uses a different constraint name, find it with:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'alerts'::regclass AND contype = 'c';
-- then: ALTER TABLE alerts DROP CONSTRAINT <conname>;

-- Add new constraint with all types (including session_started for parent notification when sitter starts)
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (
  type IN (
    'cry_detection', 'emergency', 'gps_anomaly', 'session_reminder',
    'session_request', 'session_accepted', 'session_cancelled', 'session_started'
  )
);
