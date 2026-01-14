-- ============================================
-- FIX VERIFICATION REQUESTS RLS POLICIES
-- ============================================
-- This script ensures sitters can update their own verification requests
-- and admins can read all verification requests
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Sitters can read own verification requests" ON verification_requests;
DROP POLICY IF EXISTS "Sitters can create verification requests" ON verification_requests;
DROP POLICY IF EXISTS "Sitters can update own verification requests" ON verification_requests;
DROP POLICY IF EXISTS "Admins can update verification requests" ON verification_requests;
DROP POLICY IF EXISTS "Admins can read all verification requests" ON verification_requests;

-- Sitters can read their own verification requests
CREATE POLICY "Sitters can read own verification requests" ON verification_requests
  FOR SELECT USING (sitter_id = auth.uid());

-- Admins can read all verification requests
CREATE POLICY "Admins can read all verification requests" ON verification_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Sitters can create verification requests
CREATE POLICY "Sitters can create verification requests" ON verification_requests
  FOR INSERT WITH CHECK (sitter_id = auth.uid());

-- Sitters can update their own verification requests (for resubmission)
CREATE POLICY "Sitters can update own verification requests" ON verification_requests
  FOR UPDATE USING (sitter_id = auth.uid());

-- Admins can update all verification requests
CREATE POLICY "Admins can update verification requests" ON verification_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'verification_requests'
ORDER BY policyname;
