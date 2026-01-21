-- Fix create_user_profile function to preserve roles
-- Run this in Supabase SQL Editor to fix the "function name is not unique" error

-- Step 1: Drop ALL existing versions of the function (to avoid ambiguity)
DROP FUNCTION IF EXISTS create_user_profile CASCADE;

-- Step 2: Create the new function with role preservation
CREATE OR REPLACE FUNCTION create_user_profile(
  p_id UUID,
  p_email TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,  -- Changed: NULL instead of 'parent' to preserve existing role on updates
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
    p_id, p_email, p_display_name, 
    COALESCE(p_role, 'parent'),  -- Use 'parent' as default only for NEW users (INSERT)
    p_preferred_language, p_user_number,
    p_phone_number, p_photo_url, p_theme, p_is_verified, p_verification_status,
    p_hourly_rate, p_bio, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    -- CRITICAL: Always preserve existing role on updates - never change role via this function
    role = users.role,  -- Preserve existing role, only set during INSERT for new users
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

-- Step 3: Grant execute permission (with full signature to avoid ambiguity)
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, DECIMAL, TEXT) TO anon;

-- Done! The function should now work without the "function name is not unique" error.
