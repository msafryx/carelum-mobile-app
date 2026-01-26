-- Update RLS policy to allow parents to read verification requests for verified sitters
-- This enables parents to view sitter qualifications and certifications when browsing verified sitters
-- Run this in Supabase SQL Editor

-- Drop existing policy
DROP POLICY IF EXISTS "Sitters can read own verification requests" ON verification_requests;

-- Create updated policy that allows:
-- 1. Sitters to read their own verification requests
-- 2. Admins to read all verification requests
-- 3. Parents to read verification requests for verified sitters (for viewing qualifications)
CREATE POLICY "Sitters can read own verification requests" ON verification_requests
  FOR SELECT USING (
    sitter_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') OR
    (
      -- Parents can read verification requests for verified sitters
      get_user_role(auth.uid()) = 'parent'
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = verification_requests.sitter_id 
        AND users.role = 'sitter'
        AND users.is_verified = true
      )
    )
  );

-- Add comment
COMMENT ON POLICY "Sitters can read own verification requests" ON verification_requests IS 
  'Allows sitters to read own verification, admins to read all, and parents to read verification for verified sitters';
