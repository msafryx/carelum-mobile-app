-- Add missing columns to users table
-- Run this if you already created the users table without these columns

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Update the readable view
CREATE OR REPLACE VIEW users_readable AS
SELECT 
  *,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_readable,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at_readable
FROM users;
