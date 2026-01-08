-- QUICK FIX for RLS Error During Sign-Up
-- Copy and paste this ENTIRE file into Supabase SQL Editor and run it

-- Step 1: Add missing columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Step 2: Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Step 3: Create INSERT policy that allows users to create their profile
-- This policy allows authenticated users to insert a row where id = auth.uid()
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can insert own profile';
