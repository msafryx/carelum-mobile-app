-- Add expires_at column to sessions table
-- This column is used to track when a session request expires (for OPEN status requests)
-- Run this in Supabase SQL Editor

-- Add expires_at column
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN sessions.expires_at IS 'When the session request expires (for OPEN status requests). Used to filter out expired requests in the babysitter requests feed.';

-- Add index for efficient filtering of expired requests
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at) WHERE expires_at IS NOT NULL;

-- Add index for filtering non-expired requests
CREATE INDEX IF NOT EXISTS idx_sessions_not_expired ON sessions(expires_at) 
WHERE status = 'requested' AND (expires_at IS NULL OR expires_at > NOW());
