-- =============================================================================
-- Migration: Add ended_at to sessions (for End Session from parent/admin)
-- Run this in Supabase SQL Editor if you get: Could not find the 'ended_at' column
-- =============================================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
