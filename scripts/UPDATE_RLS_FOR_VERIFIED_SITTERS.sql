-- Update RLS policy to allow parents to read verified sitter profiles
-- This enables parents to browse and select verified sitters when creating session requests
-- Run this in Supabase SQL Editor

-- First, create a helper function to check user role (avoids infinite recursion)
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = user_id;
  
  RETURN COALESCE(user_role, 'parent');
END;
$$;

-- Drop existing policy
DROP POLICY IF EXISTS "Users can read own profile" ON users;

-- Create updated policy that allows:
-- 1. Users to read their own profile
-- 2. Admins to read all profiles
-- 3. Parents to read verified sitter profiles (for browsing and selecting)
-- Uses helper function to avoid infinite recursion
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (
    auth.uid() = id 
    OR get_user_role(auth.uid()) = 'admin'
    OR (
      -- Parents can read verified sitter profiles (for browsing and selecting)
      get_user_role(auth.uid()) = 'parent'
      AND users.role = 'sitter'
      AND users.is_verified = true
    )
  );

-- Add comment
COMMENT ON POLICY "Users can read own profile" ON users IS 
  'Allows users to read own profile, admins to read all, and parents to read verified sitter profiles for browsing';

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO anon;
