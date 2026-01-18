-- Add multi-scope session request support to sessions table
-- Run this in Supabase SQL Editor

-- Add search_scope column
-- Values: 'invite' (direct invite to specific sitter), 'nearby' (radius-based search), 
--         'city' (city-wide search), 'nationwide' (country-wide search)
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS search_scope TEXT 
DEFAULT 'invite' 
CHECK (search_scope IN ('invite', 'nearby', 'city', 'nationwide'));

-- Add max_distance_km column (nullable)
-- Only used when search_scope = 'nearby' (values: 5, 10, 25 km)
-- NULL for invite, city, and nationwide scopes
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS max_distance_km NUMERIC(5, 2);

-- Add comment for documentation
COMMENT ON COLUMN sessions.search_scope IS 'Session request scope: invite (specific sitter), nearby (radius search), city (city-wide), nationwide (country-wide)';
COMMENT ON COLUMN sessions.max_distance_km IS 'Maximum distance in km for nearby search scope. Only used when search_scope = ''nearby''. Values: 5, 10, or 25 km.';

-- Add index for efficient querying by search scope
CREATE INDEX IF NOT EXISTS idx_sessions_search_scope ON sessions(search_scope) WHERE search_scope != 'invite';
