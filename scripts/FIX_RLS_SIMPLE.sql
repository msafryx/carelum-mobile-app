-- SIMPLE FIX - Run this in Supabase SQL Editor
-- This fixes the RLS policy to allow sign-up

-- Step 1: Add missing columns
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Step 2: Drop all existing policies on users
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow user_number read for generation" ON users;
DROP POLICY IF EXISTS "Users can read user numbers for signup" ON users;

-- Step 3: Create simple policies without recursion
-- SELECT: Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT 
  USING (auth.uid() = id);

-- INSERT: Users can create their own profile (for sign-up)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE 
  USING (auth.uid() = id);

-- That's it! The sign-up should work now.
-- The user number generation will use local fallback to avoid RLS recursion.
