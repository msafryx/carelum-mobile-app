# Sessions Table Verification

## Table Structure
The `sessions` table is correctly defined with all necessary fields and relationships.

### Fields
- `id` (UUID, PRIMARY KEY) - Auto-generated
- `parent_id` (UUID, NOT NULL) - References `users(id)` ON DELETE CASCADE
- `sitter_id` (UUID, NULLABLE) - References `users(id)` ON DELETE SET NULL
- `child_id` (UUID, NOT NULL) - References `children(id)` ON DELETE CASCADE
- `status` (TEXT, NOT NULL, DEFAULT 'requested') - CHECK constraint: 'requested', 'pending', 'accepted', 'active', 'completed', 'cancelled'
- `start_time` (TIMESTAMPTZ, NOT NULL)
- `end_time` (TIMESTAMPTZ, NULLABLE)
- `location` (TEXT, NULLABLE)
- `hourly_rate` (DECIMAL(10, 2), NULLABLE)
- `total_amount` (DECIMAL(10, 2), NULLABLE)
- `notes` (TEXT, NULLABLE)
- `search_scope` (TEXT, DEFAULT 'invite') - CHECK constraint: 'invite', 'nearby', 'city', 'nationwide'
- `max_distance_km` (NUMERIC(5, 2), NULLABLE) - Only used when search_scope = 'nearby'
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

## Foreign Key Relationships ✅

### Sessions → Users (Parent)
- **Field:** `parent_id`
- **References:** `users(id)`
- **On Delete:** CASCADE (if parent is deleted, all their sessions are deleted)
- **Nullable:** NO
- **Status:** ✅ Correct

### Sessions → Users (Sitter)
- **Field:** `sitter_id`
- **References:** `users(id)`
- **On Delete:** SET NULL (if sitter is deleted, session remains but sitter_id becomes NULL)
- **Nullable:** YES
- **Status:** ✅ Correct

### Sessions → Children
- **Field:** `child_id`
- **References:** `children(id)`
- **On Delete:** CASCADE (if child is deleted, all their sessions are deleted)
- **Nullable:** NO
- **Status:** ✅ Correct

## Reverse Relationships (Tables referencing Sessions) ✅

### Alerts → Sessions
- **Field:** `session_id` in `alerts` table
- **References:** `sessions(id)`
- **On Delete:** CASCADE
- **Status:** ✅ Correct

### Chat Messages → Sessions
- **Field:** `session_id` in `chat_messages` table
- **References:** `sessions(id)`
- **On Delete:** CASCADE
- **Status:** ✅ Correct

### GPS Tracking → Sessions
- **Field:** `session_id` in `gps_tracking` table
- **References:** `sessions(id)`
- **On Delete:** CASCADE
- **Status:** ✅ Correct

### Reviews → Sessions
- **Field:** `session_id` in `reviews` table
- **References:** `sessions(id)`
- **On Delete:** CASCADE
- **Status:** ✅ Correct

## Indexes ✅

1. `idx_sessions_parent_id` - For querying sessions by parent
2. `idx_sessions_sitter_id` - For querying sessions by sitter
3. `idx_sessions_child_id` - For querying sessions by child
4. `idx_sessions_status` - For filtering by status
5. `idx_sessions_start_time` - For time-based queries
6. `idx_sessions_created_at` - For sorting by creation time
7. `idx_sessions_search_scope` - Partial index for non-invite scopes

## RLS Policies ✅

1. **SELECT:** Users can read their own sessions (parent_id or sitter_id matches) or if admin
2. **INSERT:** Only parents can create sessions (parent_id must match auth.uid())
3. **UPDATE:** Users can update their own sessions (parent_id or sitter_id matches) or if admin

## Status Values ✅

- `requested` - Session request created (default)
- `pending` - Session is pending acceptance
- `accepted` - Sitter has accepted the session
- `active` - Session is currently active
- `completed` - Session has been completed
- `cancelled` - Session was cancelled

## All Relationships Verified ✅

All foreign key relationships are correctly maintained with appropriate CASCADE and SET NULL behaviors.
