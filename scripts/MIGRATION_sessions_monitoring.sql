-- =============================================================================
-- Migration: Add monitoring columns to sessions (for GPS + cry detection)
-- Run this in Supabase SQL Editor if you get: Could not find the 'monitoring_enabled' column
-- =============================================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS monitoring_started_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_audio_signal_at TIMESTAMPTZ;
