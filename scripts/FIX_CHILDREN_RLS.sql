-- Fix Children RLS Policy for INSERT Operations
-- Run this in Supabase SQL Editor

-- Drop existing policy
DROP POLICY IF EXISTS "Parents can manage own children" ON children;

-- Create separate policies for better control
CREATE POLICY "Parents can read own children" ON children
  FOR SELECT USING (parent_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Parents can insert own children" ON children
  FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update own children" ON children
  FOR UPDATE USING (parent_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Parents can delete own children" ON children
  FOR DELETE USING (parent_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'children';
