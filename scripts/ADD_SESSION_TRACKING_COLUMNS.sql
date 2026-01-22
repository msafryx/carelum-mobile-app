-- Add cancellation and completion tracking columns to sessions table
-- Run this in Supabase SQL Editor to add Uber-like session tracking

-- Step 1: Add cancellation tracking columns
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('parent', 'sitter', 'system')),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Step 2: Add completion tracking column
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Step 3: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_cancelled_at ON sessions(cancelled_at) WHERE cancelled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_completed_at ON sessions(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_cancelled_by ON sessions(cancelled_by) WHERE cancelled_by IS NOT NULL;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN sessions.cancelled_at IS 'Timestamp when session was cancelled (Uber-like tracking)';
COMMENT ON COLUMN sessions.cancelled_by IS 'Who cancelled the session: parent, sitter, or system';
COMMENT ON COLUMN sessions.cancellation_reason IS 'Reason for cancellation (optional)';
COMMENT ON COLUMN sessions.completed_at IS 'Timestamp when session was completed';

-- Verification: Check the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sessions'
AND column_name IN ('cancelled_at', 'cancelled_by', 'cancellation_reason', 'completed_at')
ORDER BY column_name;

-- Done! Sessions table now has Uber-like cancellation and completion tracking.
