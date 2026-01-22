# Session CRUD System - Uber-like Implementation

## Overview
This document describes the comprehensive Uber-like session CRUD (Create, Read, Update, Delete) system implemented for the Carelum babysitting app. The system follows Uber's ride-booking model with proper state management, status transitions, and real-time updates.

## Architecture

### Status Flow (State Machine)
```
requested → accepted → active → completed
    ↓           ↓         ↓
cancelled   cancelled  cancelled
```

**Status Definitions:**
- `requested`: Parent creates a session request (like ordering a ride)
- `accepted`: Sitter accepts the request (like driver accepting ride)
- `active`: Session has started (like ride in progress)
- `completed`: Session ended successfully (like ride completed)
- `cancelled`: Session was cancelled (can happen at any stage before completion)

### Key Features

#### 1. **Session Creation (CREATE)**
- **Who**: Only parents can create sessions
- **Status**: Always starts as `requested`
- **Search Scopes**:
  - `invite`: Direct invitation to specific sitter
  - `nearby`: Search within X km radius (5, 10, or 25 km)
  - `city`: City-wide search
  - `nationwide`: Nationwide search
- **Validation**: 
  - Parent ID must match authenticated user
  - Search scope-specific validations (e.g., `sitterId` required for `invite`)
  - `maxDistanceKm` required for `nearby` scope

#### 2. **Session Discovery (READ - Discovery)**
- **Who**: Sitters can discover available sessions
- **Endpoint**: `GET /api/sessions/discover/available`
- **Filters**:
  - `scope`: Filter by search scope (nearby, city, nationwide)
  - `max_distance`: Maximum distance for nearby scope
- **Logic**:
  - Shows sessions with status `requested`
  - For `invite` scope: Only shows if sitter is invited
  - For other scopes: Shows all matching sessions
  - Ordered by start time (soonest first)

#### 3. **Session Retrieval (READ)**
- **List Sessions**: `GET /api/sessions?status=<status>`
  - Returns user's sessions (parent or sitter)
  - Filterable by status
  - Uses authenticated Supabase client for RLS
- **Get by ID**: `GET /api/sessions/{session_id}`
  - Returns single session with full details
  - Access control: Only parent or sitter in session can view

#### 4. **Session Updates (UPDATE)**
- **Status Transitions**: Validated by state machine
  - `requested` → `accepted` (sitter only)
  - `requested` → `cancelled` (anyone)
  - `accepted` → `active` (sitter only, must be accepted first)
  - `accepted` → `cancelled` (anyone)
  - `active` → `completed` (sitter only, must be active first)
  - `active` → `cancelled` (anyone)
  - Terminal states (`completed`, `cancelled`) cannot be changed
- **Automatic Tracking**:
  - When `accepted`: Sitter is automatically assigned (`sitter_id` set)
  - When `cancelled`: Tracks `cancelled_at`, `cancelled_by`, `cancellation_reason`
  - When `completed`: Tracks `completed_at`, sets `end_time` if not provided
  - When `active`: Ensures sitter is assigned

#### 5. **Session Cancellation (DELETE - Soft Delete)**
- **Who**: Parent or sitter in the session
- **Method**: `DELETE /api/sessions/{session_id}?reason=<reason>`
- **Behavior**: 
  - Soft delete: Updates status to `cancelled` (doesn't actually delete)
  - Tracks who cancelled, when, and why
  - Cannot cancel terminal states (`completed`, `cancelled`)

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES users(id),
  sitter_id UUID REFERENCES users(id),
  child_id UUID NOT NULL REFERENCES children(id),
  status TEXT NOT NULL DEFAULT 'requested',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  hourly_rate DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  notes TEXT,
  search_scope TEXT DEFAULT 'invite',
  max_distance_km NUMERIC(5, 2),
  -- Uber-like tracking
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT CHECK (cancelled_by IN ('parent', 'sitter', 'system')),
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### Backend (`backend/app/routes/sessions.py`)

1. **POST `/api/sessions`** - Create session request
   - Auth: Parent only
   - Body: `CreateSessionRequest`
   - Returns: `SessionResponse`

2. **GET `/api/sessions`** - List user's sessions
   - Auth: Required
   - Query: `?status=<status>` (optional)
   - Returns: `List[SessionResponse]`

3. **GET `/api/sessions/{session_id}`** - Get session by ID
   - Auth: Required (must be parent or sitter in session)
   - Returns: `SessionResponse`

4. **GET `/api/sessions/discover/available`** - Discover available sessions (sitters)
   - Auth: Sitter only
   - Query: `?scope=<scope>&max_distance=<km>` (optional)
   - Returns: `List[SessionResponse]`

5. **PUT `/api/sessions/{session_id}`** - Update session
   - Auth: Required (must be parent or sitter in session)
   - Body: `UpdateSessionRequest`
   - Returns: `SessionResponse`

6. **DELETE `/api/sessions/{session_id}`** - Cancel session
   - Auth: Required (must be parent or sitter in session)
   - Query: `?reason=<reason>` (optional)
   - Returns: `{success: bool, message: string}`

## Frontend Services

### Session Service (`src/services/session.service.ts`)

**Key Functions:**
- `createSessionRequest()` - Create new session
- `getSessionById()` - Get session with caching
- `getUserSessions()` - Get user's sessions with caching
- `discoverAvailableSessions()` - Discover available sessions (sitters)
- `updateSessionStatus()` - Update session status
- `acceptSessionRequest()` - Accept request (sitter)
- `declineSessionRequest()` - Decline request (sitter)
- `startSession()` - Start session (sitter)
- `completeSession()` - Complete session (sitter)
- `cancelSession()` - Cancel session (with reason)
- `subscribeToSession()` - Real-time updates
- `subscribeToUserSessions()` - Real-time updates for user's sessions

## Frontend UI

### Sitter Home Screen (`app/(sitter)/home.tsx`)
- **Active Sessions**: Shows currently active sessions
- **Upcoming Sessions**: Shows accepted but not yet active sessions
- **Available Sessions**: Shows discoverable session requests (Uber-like)

### Sitter Requests Screen (`app/(sitter)/requests.tsx`)
- Shows session requests specifically invited to the sitter
- Accept/Decline actions

## State Machine Validation

The backend validates all status transitions using `validate_status_transition()`:

```python
def validate_status_transition(current_status, new_status, user_role, session_data):
    """
    Validates session status transition
    - Checks if transition is allowed
    - Validates role permissions
    - Returns (is_valid, error_message)
    """
```

**Rules:**
- Terminal states cannot be changed
- Role-based permissions enforced
- State dependencies validated (e.g., must be `accepted` before `active`)

## Real-time Updates

- Uses Supabase Realtime subscriptions
- Frontend hooks: `useSession()`, `subscribeToSession()`, `subscribeToUserSessions()`
- Automatic UI updates when session status changes

## Error Handling

- Comprehensive error messages
- RLS policy violations detected and reported
- Status transition errors with clear messages
- Database constraint violations handled gracefully

## Security

- **RLS (Row Level Security)**: All queries use authenticated Supabase client
- **Access Control**: Users can only access their own sessions
- **Role Validation**: Actions restricted by role (parent/sitter)
- **State Validation**: Invalid transitions rejected

## Migration

Run `scripts/ADD_SESSION_TRACKING_COLUMNS.sql` to add:
- `cancelled_at`
- `cancelled_by`
- `cancellation_reason`
- `completed_at`

## Testing Checklist

- [ ] Parent creates session request
- [ ] Sitter discovers available sessions
- [ ] Sitter accepts request
- [ ] Sitter starts session
- [ ] Sitter completes session
- [ ] Parent cancels before acceptance
- [ ] Sitter cancels after acceptance
- [ ] Invalid status transitions rejected
- [ ] Real-time updates work
- [ ] RLS policies enforced

## Future Enhancements

1. **Location-based matching** for nearby scope
2. **Push notifications** for status changes
3. **Session history** with filters
4. **Rating/review system** after completion
5. **Payment integration** with session completion
6. **Auto-assignment** for nearby/city/nationwide scopes
7. **Session reminders** before start time
