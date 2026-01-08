-- Fix Row Level Security Policies
-- Run this in Supabase SQL Editor to fix RLS issues

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Recreate policies with proper permissions
-- Users can read their own profile, admins can read all
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can insert their own profile (for sign-up)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Also fix children policies
DROP POLICY IF EXISTS "Parents can manage own children" ON children;
CREATE POLICY "Parents can manage own children" ON children
  FOR ALL USING (
    parent_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Fix child instructions policies
DROP POLICY IF EXISTS "Parents can manage own child instructions" ON child_instructions;
CREATE POLICY "Parents can manage own child instructions" ON child_instructions
  FOR ALL USING (
    parent_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Fix sessions policies
DROP POLICY IF EXISTS "Users can read own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;

CREATE POLICY "Users can read own sessions" ON sessions
  FOR SELECT USING (
    parent_id = auth.uid() OR 
    sitter_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create own sessions" ON sessions
  FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE USING (
    parent_id = auth.uid() OR 
    sitter_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Fix alerts policies
DROP POLICY IF EXISTS "Users can read own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can create alerts" ON alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON alerts;

CREATE POLICY "Users can read own alerts" ON alerts
  FOR SELECT USING (
    parent_id = auth.uid() OR 
    sitter_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create alerts" ON alerts
  FOR INSERT WITH CHECK (parent_id = auth.uid() OR sitter_id = auth.uid());

CREATE POLICY "Users can update own alerts" ON alerts
  FOR UPDATE USING (
    parent_id = auth.uid() OR 
    sitter_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Fix chat messages policies
DROP POLICY IF EXISTS "Users can read own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON chat_messages;

CREATE POLICY "Users can read own messages" ON chat_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can send messages" ON chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update own messages" ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Fix GPS tracking policies
DROP POLICY IF EXISTS "Users can read session GPS" ON gps_tracking;
DROP POLICY IF EXISTS "Users can create GPS tracking" ON gps_tracking;

CREATE POLICY "Users can read session GPS" ON gps_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = gps_tracking.session_id 
      AND (sessions.parent_id = auth.uid() OR sessions.sitter_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create GPS tracking" ON gps_tracking
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = gps_tracking.session_id 
      AND (sessions.parent_id = auth.uid() OR sessions.sitter_id = auth.uid())
    )
  );

-- Fix verification requests policies
DROP POLICY IF EXISTS "Sitters can read own verification requests" ON verification_requests;
DROP POLICY IF EXISTS "Sitters can create verification requests" ON verification_requests;
DROP POLICY IF EXISTS "Admins can update verification requests" ON verification_requests;

CREATE POLICY "Sitters can read own verification requests" ON verification_requests
  FOR SELECT USING (
    sitter_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Sitters can create verification requests" ON verification_requests
  FOR INSERT WITH CHECK (sitter_id = auth.uid());

CREATE POLICY "Admins can update verification requests" ON verification_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Fix reviews policies
DROP POLICY IF EXISTS "Users can read session reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;

CREATE POLICY "Users can read session reviews" ON reviews
  FOR SELECT USING (
    reviewer_id = auth.uid() OR
    reviewee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = reviews.session_id 
      AND (sessions.parent_id = auth.uid() OR sessions.sitter_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create reviews" ON reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());
