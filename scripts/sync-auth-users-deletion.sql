-- Sync Deletions Between auth.users and public.users
-- Run this in Supabase SQL Editor
-- This ensures that when a user is deleted from auth.users, they are also deleted from public.users
-- And vice versa (with admin privileges)

-- ============================================
-- TRIGGER 1: Delete from public.users when auth.users is deleted
-- ============================================
-- This trigger automatically deletes the user profile when the auth user is deleted
CREATE OR REPLACE FUNCTION handle_auth_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the user profile from public.users
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Create trigger on auth.users DELETE
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_deleted();

-- ============================================
-- TRIGGER 2: Delete from auth.users when public.users is deleted (Admin only)
-- ============================================
-- This trigger deletes the auth user when the profile is deleted
-- Note: This requires admin privileges to delete from auth.users
-- Only use this if you want bidirectional deletion
CREATE OR REPLACE FUNCTION handle_public_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the auth user (requires admin/service role)
  -- Note: This might fail if the user doesn't have permission
  -- You may want to comment this out if you only want one-way sync
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_public_user_deleted ON public.users;

-- Create trigger on public.users DELETE
-- WARNING: This will try to delete from auth.users, which requires elevated privileges
-- Uncomment only if you want bidirectional deletion
-- CREATE TRIGGER on_public_user_deleted
--   AFTER DELETE ON public.users
--   FOR EACH ROW
--   EXECUTE FUNCTION handle_public_user_deleted();

-- ============================================
-- VERIFY TRIGGERS
-- ============================================
-- Check if triggers are created
SELECT 
  trigger_name,
  event_object_table,
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN ('on_auth_user_deleted', 'on_public_user_deleted')
ORDER BY trigger_name;
