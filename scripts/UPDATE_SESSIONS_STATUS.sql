-- Update Sessions Table Status Constraint
-- Run this in Supabase SQL Editor to fix the status constraint
-- This adds 'requested' status and makes it the default

-- Step 1: Drop the existing constraint
ALTER TABLE sessions 
DROP CONSTRAINT IF EXISTS sessions_status_check;

-- Step 2: Add the updated constraint with 'requested' status
ALTER TABLE sessions 
ADD CONSTRAINT sessions_status_check 
CHECK (status IN ('requested', 'pending', 'accepted', 'active', 'completed', 'cancelled'));

-- Step 3: Update default value to 'requested'
ALTER TABLE sessions 
ALTER COLUMN status SET DEFAULT 'requested';

-- Step 4: Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_child_id ON sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- Verification: Check the constraint
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'sessions'::regclass
AND conname = 'sessions_status_check';

-- Done! The sessions table now supports 'requested' status.
