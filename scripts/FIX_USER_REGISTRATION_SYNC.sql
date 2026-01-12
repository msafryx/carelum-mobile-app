-- ============================================
-- COMPLETE FIX: User Registration Sync
-- ============================================
-- This script fixes the issue where new auth users are not synced to public.users
-- Run this ENTIRE script in Supabase SQL Editor

-- Step 1: Update create_user_profile function to handle conflicts properly
CREATE OR REPLACE FUNCTION create_user_profile(
  p_id UUID,
  p_email TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'parent',
  p_preferred_language TEXT DEFAULT 'en',
  p_user_number TEXT DEFAULT NULL,
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
  -- Insert or update user profile
  -- SECURITY DEFINER bypasses RLS, so this will work even during sign-up
  INSERT INTO users (
    id, email, display_name, role, preferred_language, user_number,
    phone_number, photo_url, theme, is_verified, verification_status,
    hourly_rate, bio, created_at, updated_at
  )
  VALUES (
    p_id, p_email, p_display_name, p_role, p_preferred_language, p_user_number,
    p_phone_number, p_photo_url, p_theme, p_is_verified, p_verification_status,
    p_hourly_rate, p_bio, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    role = COALESCE(EXCLUDED.role, users.role),
    preferred_language = COALESCE(EXCLUDED.preferred_language, users.preferred_language),
    user_number = COALESCE(EXCLUDED.user_number, users.user_number),
    phone_number = COALESCE(EXCLUDED.phone_number, users.phone_number),
    photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
    theme = COALESCE(EXCLUDED.theme, users.theme),
    is_verified = COALESCE(EXCLUDED.is_verified, users.is_verified),
    verification_status = COALESCE(EXCLUDED.verification_status, users.verification_status),
    hourly_rate = COALESCE(EXCLUDED.hourly_rate, users.hourly_rate),
    bio = COALESCE(EXCLUDED.bio, users.bio),
    updated_at = NOW();
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO anon;

-- Step 2: Create trigger function to auto-sync auth.users to public.users
-- This automatically creates a basic profile when a new auth user is created
CREATE OR REPLACE FUNCTION handle_auth_user_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_display_name TEXT;
BEGIN
  -- Get email from auth.users
  user_email := NEW.email;
  
  -- Extract display name from email (fallback)
  user_display_name := COALESCE(
    split_part(user_email, '@', 1),
    user_email
  );
  
  -- Create basic user profile in public.users
  -- SECURITY DEFINER allows this to bypass RLS
  INSERT INTO public.users (
    id,
    email,
    display_name,
    role,
    preferred_language,
    theme,
    is_verified,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    user_email,
    user_display_name,
    'parent', -- Default role, will be updated by frontend
    'en',
    'auto',
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Don't overwrite if profile already exists
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 4: Create trigger on auth.users INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_created();

-- Step 5: Ensure RLS policies allow the function to work
-- The function uses SECURITY DEFINER, so it bypasses RLS
-- But we still need policies for normal operations

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;

-- Create SELECT policy: Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT 
  USING (auth.uid() = id);

-- Create INSERT policy: Allow authenticated users to insert their own profile
-- Note: The trigger and function will handle most inserts, but this allows direct inserts too
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Create UPDATE policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create policy for admins to read all users
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Step 6: Verify setup
DO $$
BEGIN
  RAISE NOTICE '✅ create_user_profile function updated';
  RAISE NOTICE '✅ handle_auth_user_created trigger function created';
  RAISE NOTICE '✅ on_auth_user_created trigger created';
  RAISE NOTICE '✅ RLS policies updated';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next steps:';
  RAISE NOTICE '   1. Register a new user in the app';
  RAISE NOTICE '   2. Check Supabase Dashboard → Table Editor → users';
  RAISE NOTICE '   3. User should appear automatically';
  RAISE NOTICE '   4. Run test script: ./scripts/test-all-db-operations.sh';
END $$;
