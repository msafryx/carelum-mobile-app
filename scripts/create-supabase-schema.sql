-- Supabase Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USER REGISTRATION SYNC: auth.users <-> public.users
-- ============================================

-- Drop existing function(s) if they exist (to avoid "function name is not unique" error)
DROP FUNCTION IF EXISTS create_user_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, DECIMAL, TEXT
);
DROP FUNCTION IF EXISTS create_user_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT
);

-- Function to create/update user profile (called during sign-up)
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

-- Grant execute permission to authenticated and anon users
-- Specify full signature to avoid ambiguity
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, DECIMAL, TEXT) TO anon;

-- Trigger function to auto-sync auth.users to public.users on INSERT
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

-- Trigger on auth.users INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_created();

-- ============================================
-- SYNC DELETIONS: auth.users <-> public.users
-- ============================================
-- This ensures that when a user is deleted from auth.users, they are also deleted from public.users
CREATE OR REPLACE FUNCTION handle_auth_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_deleted();

-- Enable Realtime for tables that need it
-- (Do this in Supabase Dashboard → Database → Replication)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('parent', 'sitter', 'admin')),
  phone_number TEXT,
  photo_url TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Sri Lanka',
  preferred_language TEXT DEFAULT 'en',
  user_number TEXT UNIQUE, -- p1, b1, etc.
  theme TEXT DEFAULT 'auto',
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status TEXT,
  hourly_rate DECIMAL(10, 2),
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Children table
CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  date_of_birth DATE,
  gender TEXT,
  photo_url TEXT,
  child_number TEXT UNIQUE, -- c1, c2, etc.
  parent_number TEXT, -- p1, p2, etc.
  sitter_number TEXT, -- b1, b2, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Child instructions table
-- Note: Run ADD_CHILD_INSTRUCTIONS_COLUMNS.sql migration to add all fields for chatbot RAG
CREATE TABLE IF NOT EXISTS child_instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feeding_schedule TEXT,
  nap_schedule TEXT,
  medication TEXT, -- Legacy: Use medications (JSONB) after migration
  allergies TEXT, -- Legacy: Use allergies (JSONB) after migration
  emergency_contacts JSONB,
  special_instructions TEXT,
  -- New columns added by migration: bedtime, dietary_restrictions, medications (JSONB),
  -- allergies (JSONB), favorite_activities, comfort_items, routines, special_needs,
  -- doctor_info, additional_notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, parent_id)
);

-- Sessions table
-- Note: For existing databases, run UPDATE_SESSIONS_STATUS.sql to update status constraint
--       and ADD_SESSION_TRACKING_COLUMNS.sql to add cancellation/completion tracking columns
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sitter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE, -- Primary child (for backward compatibility)
  child_ids JSONB DEFAULT '[]'::jsonb, -- Array of child IDs for sessions with multiple children. Stored as JSONB array. The child_id column remains as the primary child for backward compatibility.
  -- Status: 'requested' (default), 'pending', 'accepted', 'active', 'completed', 'cancelled'
  -- For existing databases: Run UPDATE_SESSIONS_STATUS.sql to add 'requested' status support
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'pending', 'accepted', 'active', 'completed', 'cancelled')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  hourly_rate DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  notes TEXT,
  search_scope TEXT DEFAULT 'invite' CHECK (search_scope IN ('invite', 'nearby', 'city', 'nationwide')), -- Session request scope
  max_distance_km NUMERIC(5, 2), -- Maximum distance in km for nearby search scope (only used when search_scope = 'nearby')
  time_slots JSONB DEFAULT '[]'::jsonb, -- Array of time slots for multi-day sessions (Time Slots mode). Format: [{"date": "2026-01-29", "startTime": "09:00", "endTime": "12:00", "hours": 3}, ...]
  -- Cancellation tracking (Uber-like)
  -- For existing databases: Run ADD_SESSION_TRACKING_COLUMNS.sql to add these columns
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT CHECK (cancelled_by IN ('parent', 'sitter', 'system')),
  cancellation_reason TEXT,
  -- Completion tracking
  completed_at TIMESTAMPTZ,
  -- Request expiration (for OPEN status requests)
  expires_at TIMESTAMPTZ, -- When the request expires (for OPEN status requests). Used to filter out expired requests in the babysitter requests feed.
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sessions search_scope
CREATE INDEX IF NOT EXISTS idx_sessions_search_scope ON sessions(search_scope) WHERE search_scope != 'invite';

-- Index for child_ids JSONB queries (useful for filtering sessions by multiple children)
CREATE INDEX IF NOT EXISTS idx_sessions_child_ids ON sessions USING GIN (child_ids);

-- Alerts table (for real-time subscriptions)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sitter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('cry_detection', 'emergency', 'gps_anomaly', 'session_reminder')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'acknowledged', 'resolved')),
  audio_log_id TEXT,
  location JSONB, -- {latitude: number, longitude: number}
  viewed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table (for real-time messaging)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'location')),
  attachment_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GPS tracking table
CREATE TABLE IF NOT EXISTS gps_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  speed DECIMAL(10, 2),
  heading DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification requests table
CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sitter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  documents JSONB, -- JSONB structure: {idDocument: {...}, backgroundCheck: {...}, qualificationDocument: {...}, certifications: [...], bio: "...", hourlyRate: number}
  qualifications_text TEXT, -- Text field for qualifications
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for verification_requests
CREATE INDEX IF NOT EXISTS idx_verification_requests_qualifications ON verification_requests USING gin(to_tsvector('english', qualifications_text));
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_sitter_id ON verification_requests(sitter_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at ON verification_requests(created_at DESC);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_children_parent_id ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_child_instructions_child_id ON child_instructions(child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_parent_id ON sessions(parent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_sitter_id ON sessions(sitter_id);
CREATE INDEX IF NOT EXISTS idx_sessions_child_id ON sessions(child_id); -- Added: Index for child_id lookups
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time); -- Added: Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC); -- Added: Index for sorting by creation time

-- Indexes for cancellation and completion tracking (Uber-like)
-- For existing databases: These indexes are created by ADD_SESSION_TRACKING_COLUMNS.sql
CREATE INDEX IF NOT EXISTS idx_sessions_cancelled_at ON sessions(cancelled_at) WHERE cancelled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_completed_at ON sessions(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_cancelled_by ON sessions(cancelled_by) WHERE cancelled_by IS NOT NULL;

-- Indexes for request expiration (for babysitter requests feed)
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_not_expired ON sessions(expires_at) 
WHERE status = 'requested' AND (expires_at IS NULL OR expires_at > NOW());

-- ============================================
-- MIGRATION SCRIPTS FOR EXISTING DATABASES
-- ============================================
-- If you have an existing database, run these scripts in order:
--
-- 1. UPDATE_SESSIONS_STATUS.sql
--    - Updates status constraint to include 'requested' status
--    - Sets default status to 'requested'
--    - Adds missing indexes (idx_sessions_child_id, idx_sessions_start_time, idx_sessions_created_at)
--
-- 2. ADD_SESSION_TRACKING_COLUMNS.sql
--    - Adds cancellation tracking columns (cancelled_at, cancelled_by, cancellation_reason)
--    - Adds completion tracking column (completed_at)
--
-- 3. ADD_EXPIRES_AT_COLUMN.sql
--    - Adds expires_at column for request expiration tracking
--    - Adds indexes for efficient filtering of expired requests
--    - NOTE: Already integrated above in sessions table definition
--
-- 4. UPDATE_RLS_FOR_VERIFIED_SITTERS.sql (INTEGRATED)
--    - Updates RLS policy to allow parents to read verified sitter profiles
--    - Enables parents to browse and select verified sitters for session requests
--    - NOTE: Already integrated above in users table RLS policies (see line ~449)
--
-- 5. UPDATE_VERIFICATION_RLS_FOR_PARENTS.sql (INTEGRATED)
--    - Updates RLS policy to allow parents to read verification requests for verified sitters
--    - Enables parents to view sitter qualifications and certifications when browsing verified sitters
--    - NOTE: Already integrated above in verification_requests table RLS policies (see line ~573)
--    - Creates indexes for cancellation/completion queries
--    - Adds column comments for documentation
--
-- These migrations are already included in this schema file for new installations.
CREATE INDEX IF NOT EXISTS idx_alerts_parent_id ON alerts(parent_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_session_id ON gps_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_created_at ON gps_tracking(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_children_updated_at BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_child_instructions_updated_at BEFORE UPDATE ON child_instructions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verification_requests_updated_at BEFORE UPDATE ON verification_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (users can read/write their own data)
-- Note: The create_user_profile function uses SECURITY DEFINER to bypass RLS during sign-up

-- Helper function to get user role (avoids infinite recursion in RLS policies)
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

GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO anon;

-- Users: Users can read their own profile, admins can read all, parents can read verified sitters
DROP POLICY IF EXISTS "Users can read own profile" ON users;
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

-- Users can insert their own profile (for sign-up)
-- Note: Most inserts are handled by create_user_profile function and handle_auth_user_created trigger
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Children: Parents can read/write their own children
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Parents can manage own children" ON children;

-- Separate policies for better control
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

-- Child Instructions: Parents can manage their children's instructions
CREATE POLICY "Parents can manage own child instructions" ON child_instructions
  FOR ALL USING (parent_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Sessions: Parents and sitters can read their sessions
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

-- Alerts: Users can read their own alerts
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

-- Chat Messages: Users can read messages they sent or received
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

-- GPS Tracking: Users can read GPS data for their sessions
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

-- Verification Requests: Sitters can read their own, admins can read all, parents can read for verified sitters
CREATE POLICY "Sitters can read own verification requests" ON verification_requests
  FOR SELECT USING (
    sitter_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') OR
    (
      -- Parents can read verification requests for verified sitters (for viewing qualifications)
      get_user_role(auth.uid()) = 'parent'
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = verification_requests.sitter_id 
        AND users.role = 'sitter'
        AND users.is_verified = true
      )
    )
  );

CREATE POLICY "Sitters can create verification requests" ON verification_requests
  FOR INSERT WITH CHECK (sitter_id = auth.uid());

-- Sitters can update their own verification requests (for resubmission)
CREATE POLICY "Sitters can update own verification requests" ON verification_requests
  FOR UPDATE USING (sitter_id = auth.uid());

CREATE POLICY "Admins can update verification requests" ON verification_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Reviews: Users can read reviews for their sessions
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

-- Views for readable date formats (optional, for easier querying)
CREATE OR REPLACE VIEW users_readable AS
SELECT 
  *,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_readable,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at_readable
FROM users;

CREATE OR REPLACE VIEW children_readable AS
SELECT 
  *,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_readable,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at_readable,
  TO_CHAR(date_of_birth, 'YYYY-MM-DD') as date_of_birth_readable
FROM children;

CREATE OR REPLACE VIEW alerts_readable AS
SELECT 
  *,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_readable,
  TO_CHAR(viewed_at, 'YYYY-MM-DD HH24:MI:SS') as viewed_at_readable,
  TO_CHAR(acknowledged_at, 'YYYY-MM-DD HH24:MI:SS') as acknowledged_at_readable,
  TO_CHAR(resolved_at, 'YYYY-MM-DD HH24:MI:SS') as resolved_at_readable
FROM alerts;

-- Add column comments for documentation
COMMENT ON COLUMN verification_requests.documents IS 
'JSONB structure: {
  "idDocument": {"url": "...", "verified": boolean, "adminComment": "..."},
  "backgroundCheck": {"url": "...", "verified": boolean, "adminComment": "..."},
  "qualificationDocument": {"url": "...", "verified": boolean, "adminComment": "..."},
  "certifications": [{"name": "...", "url": "...", "issuedDate": "...", "expiryDate": "...", "verified": boolean, "adminComment": "..."}],
  "bio": "...",
  "hourlyRate": number
}';

COMMENT ON COLUMN sessions.search_scope IS 'Session request scope: invite (specific sitter), nearby (radius search), city (city-wide), nationwide (country-wide)';
COMMENT ON COLUMN sessions.max_distance_km IS 'Maximum distance in km for nearby search scope. Only used when search_scope = ''nearby''. Values: 5, 10, or 25 km.';

CREATE OR REPLACE VIEW chat_messages_readable AS
SELECT 
  *,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_readable,
  TO_CHAR(read_at, 'YYYY-MM-DD HH24:MI:SS') as read_at_readable
FROM chat_messages;

CREATE OR REPLACE VIEW sessions_readable AS
SELECT 
  *,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_readable,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at_readable,
  TO_CHAR(start_time, 'YYYY-MM-DD HH24:MI:SS') as start_time_readable,
  TO_CHAR(end_time, 'YYYY-MM-DD HH24:MI:SS') as end_time_readable
FROM sessions;
