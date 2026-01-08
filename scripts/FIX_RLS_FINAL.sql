-- FINAL FIX - Run this ENTIRE script in Supabase SQL Editor
-- This fixes RLS and role mismatch issues

-- Step 1: Fix role constraint to accept both 'sitter' and 'babysitter'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('parent', 'sitter', 'babysitter', 'admin'));

-- Step 2: Add missing columns
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Step 3: Drop ALL existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow user_number read for generation" ON users;
DROP POLICY IF EXISTS "Users can read user numbers for signup" ON users;

-- Step 4: Create a SECURITY DEFINER function to insert user profile
-- This bypasses RLS and allows profile creation during sign-up
CREATE OR REPLACE FUNCTION create_user_profile(
  p_id UUID,
  p_email TEXT,
  p_display_name TEXT,
  p_role TEXT,
  p_preferred_language TEXT,
  p_user_number TEXT,
  p_phone_number TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_theme TEXT DEFAULT 'auto',
  p_is_verified BOOLEAN DEFAULT FALSE,
  p_verification_status TEXT DEFAULT NULL,
  p_hourly_rate DECIMAL(10, 2) DEFAULT NULL,
  p_bio TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (
    id, email, display_name, role, preferred_language, user_number,
    phone_number, photo_url, theme, is_verified, verification_status,
    hourly_rate, bio
  ) VALUES (
    p_id, p_email, p_display_name, p_role, p_preferred_language, p_user_number,
    p_phone_number, p_photo_url, p_theme, p_is_verified, p_verification_status,
    p_hourly_rate, p_bio
  );
END;
$$;

-- Step 5: Create RLS policies for normal operations
-- SELECT: Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT 
  USING (auth.uid() = id);

-- INSERT: Allow through function only (function bypasses RLS)
-- But also allow direct insert for authenticated users
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;

-- Done! Now sign-up will work using the function.
