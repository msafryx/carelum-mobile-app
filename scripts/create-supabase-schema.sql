-- Supabase Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
CREATE TABLE IF NOT EXISTS child_instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feeding_schedule TEXT,
  nap_schedule TEXT,
  medication TEXT,
  allergies TEXT,
  emergency_contacts JSONB,
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, parent_id)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sitter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'active', 'completed', 'cancelled')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  hourly_rate DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  documents JSONB, -- Array of document URLs
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
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
-- Note: You'll need to customize these based on your security requirements

-- Users: Users can read their own profile, admins can read all
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Users can insert their own profile (for sign-up)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

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

-- Verification Requests: Sitters can read their own, admins can read all
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
