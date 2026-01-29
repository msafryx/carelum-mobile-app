-- Migration: Add sitter availability and location tracking columns
-- Run this in Supabase SQL Editor
-- This adds columns for sitter active status and location-based filtering

-- Add columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add comments to columns
COMMENT ON COLUMN users.is_active IS 'Whether sitter is currently available/online (like Uber drivers). Only active sitters appear in parent search results (except invite mode).';
COMMENT ON COLUMN users.last_active_at IS 'Last time sitter was active/online. Automatically updated when is_active is set to true.';
COMMENT ON COLUMN users.latitude IS 'Current location latitude (for nearby search filtering). Should be updated when sitter goes online.';
COMMENT ON COLUMN users.longitude IS 'Current location longitude (for nearby search filtering). Should be updated when sitter goes online.';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE role = 'sitter' AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city) WHERE role = 'sitter';
CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude) WHERE role = 'sitter' AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('is_active', 'last_active_at', 'latitude', 'longitude')
ORDER BY column_name;
