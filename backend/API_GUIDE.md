# Carelum API Guide

## Overview

The Carelum backend API provides a RESTful interface for user management, admin operations, and AI services. All endpoints require authentication via Supabase JWT tokens.

## Table of Contents

1. [Setup & Installation](#setup--installation)
2. [Running the Server](#running-the-server)
3. [Testing & Verification](#testing--verification)
4. [Base URL](#base-url)
5. [Authentication](#authentication)
6. [API Endpoints](#api-endpoints)
7. [Error Handling](#error-responses)
8. [Frontend Integration](#frontend-integration)

---

## Setup & Installation

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Supabase account with project URL and anon key

### Step 1: Navigate to Backend Directory

```bash
cd backend
```

### Step 2: Create Virtual Environment (if not already created)

```bash
python3 -m venv venv
```

### Step 3: Activate Virtual Environment

**Linux/Mac:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### Step 4: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 5: Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret  # Optional, for manual JWT verification
```

**Where to find Supabase credentials:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the "Project URL" → `SUPABASE_URL`
4. Copy the "anon public" key → `SUPABASE_ANON_KEY`
5. For JWT secret: Settings → API → JWT Secret (optional)

---

## Running the Server

### Option 1: Using Startup Script (Recommended)

```bash
cd backend
./start.sh
```

### Option 2: Manual Start

```bash
cd backend
source venv/bin/activate  # Activate virtual environment
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Server Options

- `--reload`: Auto-reload on code changes (development only)
- `--host 0.0.0.0`: Make server accessible from network
- `--port 8000`: Port number (default: 8000)

### Expected Output

When the server starts successfully, you should see:

```
INFO:     Started server process
INFO:     Waiting for application startup.
✅ Supabase client initialized
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**⚠️ Warning Signs:**
- `⚠️ Supabase credentials not found` → Check your `.env` file
- `⚠️ Failed to initialize Supabase client` → Verify credentials are correct
- `Address already in use` → Port 8000 is taken, use a different port

---

## Testing & Verification

### 1. Health Check

Test if the server is running:

```bash
curl http://localhost:8000/health
```

**Expected Response:**
```json
{"status":"healthy","service":"carelum-api"}
```

### 2. Root Endpoint

Check API information:

```bash
curl http://localhost:8000/
```

**Expected Response:**
```json
{
  "message": "Carelum API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "ai": {...},
    "users": {...},
    "admin": {...}
  }
}
```

### 3. Swagger UI (Interactive Documentation)

Open in browser:
```
http://localhost:8000/docs
```

This provides:
- Interactive API testing
- All available endpoints
- Request/response schemas
- Try-it-out functionality

### 4. ReDoc (Alternative Documentation)

Open in browser:
```
http://localhost:8000/redoc
```

### 5. Test User Endpoint (Requires Authentication)

Get your Supabase JWT token from the frontend (after signing in), then:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/users/me
```

**Expected Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "role": "parent",
  ...
}
```

### 6. Test Admin Endpoint (Requires Admin Token)

```bash
curl -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
     http://localhost:8000/api/admin/stats
```

**Expected Response:**
```json
{
  "totalUsers": 100,
  "totalParents": 50,
  "totalSitters": 45,
  "totalAdmins": 5,
  "pendingVerifications": 10,
  "activeSessions": 3
}
```

### 7. Using Postman or Insomnia

1. Create a new request
2. Set method (GET, POST, PUT, DELETE)
3. Enter URL: `http://localhost:8000/api/users/me`
4. Add header: `Authorization: Bearer YOUR_TOKEN`
5. Send request

### 8. Check Server Logs

Monitor server logs for:
- ✅ Successful requests
- ❌ Error messages
- ⚠️ Warnings

---

## Base URL

```
http://localhost:8000  # Development
# Production URL to be configured
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <supabase_jwt_token>
```

The token is obtained from Supabase Auth and passed with each request.

## API Endpoints

### User Endpoints

#### GET `/api/users/me`
Get current user's profile.

**Authentication:** Required

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "role": "parent",
  "preferredLanguage": "en",
  "userNumber": "p1",
  "phoneNumber": "+1234567890",
  "profileImageUrl": "https://...",
  "theme": "auto",
  "isVerified": false,
  "verificationStatus": null,
  "hourlyRate": null,
  "bio": null,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### PUT `/api/users/me`
Update current user's profile.

**Authentication:** Required

**Request Body:**
```json
{
  "displayName": "John Doe",
  "phoneNumber": "+1234567890",
  "profileImageUrl": "https://...",
  "preferredLanguage": "en",
  "theme": "dark",
  "bio": "About me...",
  "hourlyRate": 25.50,
  "address": "123 Main St",
  "city": "New York",
  "country": "USA"
}
```

**Response:** Updated user profile (same format as GET `/api/users/me`)

**Note:** 
- All fields are optional
- Role cannot be changed via this endpoint (admin only)
- Uses authenticated Supabase client for RLS

#### GET `/api/users/sitters/verified`
Get list of verified sitters (for parents to browse and select).

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): Maximum number of sitters to return (default: 100, max: 1000)

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "sitter@example.com",
    "displayName": "Jane Smith",
    "role": "sitter",
    "preferredLanguage": "en",
    "userNumber": "s1",
    "phoneNumber": "+1234567890",
    "profileImageUrl": "https://...",
    "theme": "auto",
    "isVerified": true,
    "verificationStatus": "APPROVED",
    "hourlyRate": 25.50,
    "bio": "Experienced babysitter with 5 years of experience...",
    "address": "123 Main St",
    "city": "New York",
    "country": "USA",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

**Note:**
- Only returns sitters with `is_verified = true`
- Used by parents to browse and select sitters for invite mode sessions
- Ordered by creation date (newest first)
- All sitters in the response are verified

### Admin Endpoints

All admin endpoints require the user to have `role: "admin"`.

#### GET `/api/admin/users`
Get all users (admin only).

**Authentication:** Required (Admin)

**Query Parameters:**
- `role` (optional): Filter by role (`parent`, `sitter`, `admin`, `babysitter`)
- `limit` (optional): Maximum number of users (default: 100, max: 1000)

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "parent",
    ...
  }
]
```

#### GET `/api/admin/users/{user_id}`
Get user by ID (admin only).

**Authentication:** Required (Admin)

**Response:** Same format as user profile

#### PUT `/api/admin/users/{user_id}`
Update user (admin only).

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "displayName": "John Doe",
  "role": "parent",
  "isVerified": true,
  "verificationStatus": "APPROVED",
  ...
}
```

**Response:** Updated user profile

#### DELETE `/api/admin/users/{user_id}`
Delete user (admin only).

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

#### GET `/api/admin/stats`
Get admin statistics.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "totalUsers": 100,
  "totalParents": 50,
  "totalSitters": 45,
  "totalAdmins": 5,
  "pendingVerifications": 10,
  "activeSessions": 3
}
```

### Session Endpoints (Uber-like CRUD System)

All session endpoints require authentication. Users can only access sessions they're involved in (as parent or sitter).

**Session Status Flow:**
```
requested → accepted → active → completed
    ↓           ↓         ↓
cancelled   cancelled  cancelled
```

**Status Definitions:**
- `requested`: Parent creates a session request (default status)
- `accepted`: Sitter accepts the request
- `active`: Session has started
- `completed`: Session ended successfully
- `cancelled`: Session was cancelled (can happen at any stage before completion)

**Key Features:**
- State machine validation for status transitions
- Role-based permissions enforced
- Cancellation tracking (who, when, why)
- Session discovery for sitters
- Multiple search scopes (invite, nearby, city, nationwide)
- Multiple children per session (via `childIds` array)
- Time slots for multi-day sessions (via `timeSlots` array)

#### GET `/api/sessions`
Get current user's sessions.

**Authentication:** Required

**Query Parameters:**
- `status` (optional): Filter by status (`requested`, `accepted`, `active`, `completed`, `cancelled`)

**Response:**
```json
[
  {
    "id": "uuid",
    "parentId": "uuid",
    "sitterId": "uuid",
    "childId": "uuid",
    "childIds": ["uuid1", "uuid2"],  // Array of child IDs (for sessions with multiple children)
    "status": "active",
    "startTime": "2024-01-01T10:00:00Z",
    "endTime": null,
    "location": "123 Main St",
    "hourlyRate": 25.50,
    "totalAmount": null,
    "notes": null,
    "searchScope": "invite",
    "maxDistanceKm": null,
    "timeSlots": [  // Array of time slots (for Time Slots booking mode)
      {
        "date": "2024-01-01",
        "startTime": "10:00:00",
        "endTime": "14:00:00",
        "hours": 4.0
      },
      {
        "date": "2024-01-02",
        "startTime": "10:00:00",
        "endTime": "14:00:00",
        "hours": 4.0
      }
    ],
    "cancelledAt": null,
    "cancelledBy": null,
    "cancellationReason": null,
    "completedAt": null,
    "createdAt": "2024-01-01T09:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z"
  }
]
```

**Field Notes:**
- `childId`: Primary child ID (for backward compatibility)
- `childIds`: Array of child IDs when multiple children are in the session. If not provided, defaults to `[childId]`
- `timeSlots`: Array of time slots for "Time Slots" booking mode. Each slot contains:
  - `date`: Date string (format: "YYYY-MM-DD" or "MMM dd, yyyy")
  - `startTime`: Start time string (format: "HH:mm" or ISO string)
  - `endTime`: End time string (format: "HH:mm" or ISO string)
  - `hours`: Duration in hours (float)
- For "Continuous" booking mode: `timeSlots` is `null`, use `startTime` and `endTime` instead
- For "Time Slots" booking mode: `timeSlots` contains all daily slots, `startTime` and `endTime` represent the overall session range

#### GET `/api/sessions/{session_id}`
Get session by ID.

**Authentication:** Required (must be parent or sitter in session)

**Response:** Same format as session in list (includes all cancellation/completion tracking fields)

#### POST `/api/sessions`
Create a new session request.

**Authentication:** Required (Parent only)

**Request Body:**
```json
{
  "parentId": "uuid",
  "sitterId": "uuid",  // Required if searchScope = 'invite'
  "childId": "uuid",  // Primary child ID (required)
  "childIds": ["uuid1", "uuid2"],  // Optional: Array of child IDs (for multiple children)
  "startTime": "2024-01-01T10:00:00Z",  // Overall session start time
  "endTime": "2024-01-01T14:00:00Z",  // Optional: Overall session end time (for Continuous mode)
  "location": "123 Main St",
  "hourlyRate": 25.50,
  "notes": "Please arrive 10 minutes early",
  "searchScope": "invite",  // 'invite' | 'nearby' | 'city' | 'nationwide'
  "maxDistanceKm": 10,  // Required if searchScope = 'nearby' (5, 10, or 25)
  "timeSlots": [  // Optional: Array of time slots (for Time Slots booking mode)
    {
      "date": "2024-01-01",
      "startTime": "10:00:00",
      "endTime": "14:00:00",
      "hours": 4.0
    },
    {
      "date": "2024-01-02",
      "startTime": "10:00:00",
      "endTime": "14:00:00",
      "hours": 4.0
    }
  ]
}
```

**Response:** Created session with status `requested`

**Validation:**
- Parent ID must match authenticated user
- If `searchScope = 'invite'`: `sitterId` is required
- If `searchScope = 'nearby'`: `maxDistanceKm` is required (must be 5, 10, or 25)
- Status always starts as `requested`
- `childId` is required (primary child)
- `childIds` is optional; if provided, should include `childId` in the array
- `timeSlots` is optional; if provided, creates a "Time Slots" booking mode session
- If `timeSlots` is not provided, creates a "Continuous" booking mode session (uses `startTime` and `endTime`)

**Booking Modes:**
- **Continuous Mode**: Single session with `startTime` and `endTime`. `timeSlots` is `null`.
- **Time Slots Mode**: Single session with multiple daily time slots stored in `timeSlots` array. `startTime` and `endTime` represent the overall session range.

#### PUT `/api/sessions/{session_id}`
Update session (status, notes, etc.) with state machine validation.

**Authentication:** Required (must be parent or sitter in session)

**Request Body:**
```json
{
  "status": "active",  // Validated state transitions
  "endTime": "2024-01-01T14:00:00Z",
  "totalAmount": 100.00,
  "notes": "Session completed successfully",
  "cancellationReason": "Change of plans"  // Optional, for cancellation
}
```

**Response:** Updated session

**Status Transitions (Validated):**
- `requested` → `accepted` (sitter only)
- `requested` → `cancelled` (anyone)
- `accepted` → `active` (sitter only)
- `accepted` → `cancelled` (anyone)
- `active` → `completed` (sitter only)
- `active` → `cancelled` (anyone)
- Terminal states (`completed`, `cancelled`) cannot be changed

**Automatic Tracking:**
- When `accepted`: Sitter automatically assigned (`sitter_id` set)
- When `cancelled`: Tracks `cancelled_at`, `cancelled_by`, `cancellation_reason`
- When `completed`: Tracks `completed_at`, sets `end_time` if not provided

#### DELETE `/api/sessions/{session_id}`
Cancel a session (Uber-like soft delete with tracking).

**Authentication:** Required (must be parent or sitter in session)

**Query Parameters:**
- `reason` (optional): Cancellation reason

**Response:**
```json
{
  "success": true,
  "message": "Session cancelled successfully"
}
```

**Behavior:**
- Soft delete: Updates status to `cancelled` (doesn't actually delete)
- Tracks: `cancelled_at`, `cancelled_by` (parent/sitter), `cancellation_reason`
- Cannot cancel terminal states (`completed`, `cancelled`)

#### GET `/api/sessions/discover/available`
Discover available session requests for sitters (Uber-like discovery).

**Authentication:** Required (Sitter only)

**Query Parameters:**
- `scope` (optional): Filter by search scope (`nearby`, `city`, `nationwide`)
- `max_distance` (optional): Maximum distance in km (for nearby scope)

**Response:** List of available sessions with status `requested`

**Logic:**
- Shows sessions with status `requested`
- For `invite` scope: Only shows if sitter is invited
- For other scopes: Shows all matching sessions
- Ordered by start time (soonest first)

### Children Endpoints

All children endpoints require authentication. Only parents can access their own children.

#### GET `/api/children`
Get current user's children (parent only).

**Authentication:** Required (Parent only)

**Response:**
```json
[
  {
    "id": "uuid",
    "parentId": "uuid",
    "name": "Emma",
    "age": 5,
    "dateOfBirth": "2019-01-15",
    "gender": "female",
    "photoUrl": "https://...",
    "childNumber": "c1",
    "parentNumber": "p1",
    "sitterNumber": null,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

#### GET `/api/children/{child_id}`
Get child by ID.

**Authentication:** Required (must be parent of child)

**Response:** Same format as child in list

#### POST `/api/children`
Create a new child profile.

**Authentication:** Required (Parent only)

**Request Body:**
```json
{
  "name": "Emma",
  "age": 5,
  "dateOfBirth": "2019-01-15",
  "gender": "female",
  "photoUrl": "https://...",
  "childNumber": "c1",
  "parentNumber": "p1"
}
```

**Response:** Created child

#### PUT `/api/children/{child_id}`
Update child profile.

**Authentication:** Required (must be parent of child)

**Request Body:**
```json
{
  "name": "Emma Smith",
  "age": 6,
  "photoUrl": "https://..."
}
```

**Response:** Updated child

#### DELETE `/api/children/{child_id}`
Delete child profile.

**Authentication:** Required (must be parent of child)

**Response:**
```json
{
  "success": true,
  "message": "Child deleted successfully"
}
```

#### GET `/api/children/{child_id}/instructions`
Get child instructions.

**Authentication:** Required (must be parent of child)

**Response:**
```json
{
  "id": "uuid",
  "childId": "uuid",
  "parentId": "uuid",
  "feedingSchedule": "Every 3 hours",
  "napSchedule": "2-4 PM",
  "medication": "None",
  "allergies": "Peanuts, Dairy",
  "emergencyContacts": {
    "doctor": {
      "name": "Dr. Smith",
      "phone": "+1234567890"
    }
  },
  "specialInstructions": "Likes to be read to before nap",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### PUT `/api/children/{child_id}/instructions`
Update or create child instructions.

**Authentication:** Required (must be parent of child)

**Request Body:**
```json
{
  "feedingSchedule": "Every 3 hours",
  "napSchedule": "2-4 PM",
  "medication": "None",
  "allergies": "Peanuts, Dairy",
  "emergencyContacts": {
    "doctor": {
      "name": "Dr. Smith",
      "phone": "+1234567890"
    },
    "parent": {
      "name": "John Doe",
      "phone": "+1234567890"
    }
  },
  "specialInstructions": "Likes to be read to before nap"
}
```

**Response:** Updated or created instructions (same format as GET)

**Note:** 
- All fields are optional
- Creates instructions if they don't exist, updates if they do
- `emergencyContacts` is stored as JSON in the database

### Alert Endpoints

All alert endpoints require authentication. Users can only access alerts they're involved in.

#### GET `/api/alerts`
Get current user's alerts.

**Authentication:** Required

**Query Parameters:**
- `session_id` (optional): Filter by session ID
- `status` (optional): Filter by status (`new`, `viewed`, `acknowledged`, `resolved`)
- `type` (optional): Filter by alert type (`cry_detection`, `emergency`, `gps_anomaly`, `session_reminder`)

**Response:**
```json
[
  {
    "id": "uuid",
    "sessionId": "uuid",
    "childId": "uuid",
    "parentId": "uuid",
    "sitterId": "uuid",
    "type": "cry_detection",
    "severity": "high",
    "title": "Cry Detected",
    "message": "Baby crying detected with 85% confidence",
    "status": "new",
    "audioLogId": "uuid",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "viewedAt": null,
    "acknowledgedAt": null,
    "resolvedAt": null,
    "createdAt": "2024-01-01T12:00:00Z"
  }
]
```

#### GET `/api/alerts/{alert_id}`
Get alert by ID.

**Authentication:** Required (must be parent or sitter in alert)

**Response:** Same format as alert in list

#### POST `/api/alerts`
Create a new alert (for system/internal use).

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "uuid",
  "childId": "uuid",
  "parentId": "uuid",
  "sitterId": "uuid",
  "type": "cry_detection",
  "severity": "high",
  "title": "Cry Detected",
  "message": "Baby crying detected",
  "audioLogId": "uuid",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

**Response:** Created alert

#### PUT `/api/alerts/{alert_id}/view`
Mark alert as viewed.

**Authentication:** Required (must be parent or sitter in alert)

**Response:** Updated alert

#### PUT `/api/alerts/{alert_id}/acknowledge`
Acknowledge alert.

**Authentication:** Required (must be parent or sitter in alert)

**Response:** Updated alert

#### PUT `/api/alerts/{alert_id}/resolve`
Resolve alert.

**Authentication:** Required (must be parent or sitter in alert)

**Response:** Updated alert

### GPS Tracking Endpoints

GPS tracking endpoints require authentication. Sitters can track GPS for their active sessions, parents can view GPS for their sessions.

#### POST `/api/gps/track`
Record GPS location update.

**Authentication:** Required (Sitter for active sessions)

**Request Body:**
```json
{
  "sessionId": "uuid",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10.5,
  "speed": 5.2,
  "heading": 90.0
}
```

**Response:**
```json
{
  "id": "uuid",
  "sessionId": "uuid",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10.5,
  "speed": 5.2,
  "heading": 90.0,
  "createdAt": "2024-01-01T12:00:00Z"
}
```

#### GET `/api/gps/sessions/{session_id}/gps`
Get GPS history for a session.

**Authentication:** Required (must be parent or sitter in session)

**Response:**
```json
[
  {
    "id": "uuid",
    "sessionId": "uuid",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10.5,
    "speed": 5.2,
    "heading": 90.0,
    "createdAt": "2024-01-01T12:00:00Z"
  }
]
```

#### GET `/api/gps/sessions/{session_id}/gps/latest`
Get latest GPS location for a session.

**Authentication:** Required (must be parent or sitter in session)

**Response:** Single GPS location object (same format as in history)

### Chat Message Endpoints

Chat message endpoints require authentication. Users can only access messages for sessions they're involved in.

#### GET `/api/sessions/{session_id}/messages`
Get chat messages for a session.

**Authentication:** Required (must be parent or sitter in session)

**Query Parameters:**
- `limit` (optional): Maximum number of messages (default: 50, max: 200)

**Response:**
```json
[
  {
    "id": "uuid",
    "sessionId": "uuid",
    "senderId": "uuid",
    "receiverId": "uuid",
    "message": "How is everything going?",
    "messageType": "text",
    "attachmentUrl": null,
    "readAt": null,
    "createdAt": "2024-01-01T12:00:00Z"
  }
]
```

#### POST `/api/sessions/{session_id}/messages`
Send a message in a session.

**Authentication:** Required (must be parent or sitter in session)

**Request Body:**
```json
{
  "receiverId": "uuid",
  "message": "Everything is going well!",
  "messageType": "text",
  "attachmentUrl": null
}
```

**Response:** Created message (same format as in list)

#### PUT `/api/messages/{message_id}/read`
Mark message as read.

**Authentication:** Required (must be receiver of message)

**Response:** Updated message

### AI Endpoints

#### POST `/predict`
Predict if audio contains crying sounds.

**Authentication:** Not required (currently)

**Request:**
- Content-Type: `multipart/form-data`
- Body: `audio` file (audio file upload)

**Response:**
```json
{
  "label": "crying" | "normal",
  "score": 0.85
}
```

**Note:** This is a placeholder endpoint. In production, this will:
1. Extract MFCC features from audio
2. Run CRNN model inference
3. Return prediction label and confidence score

#### POST `/bot/update`
Update child care instructions for chatbot context.

**Authentication:** Not required (currently)

**Request Body:**
```json
{
  "parentId": "uuid",
  "instructions": "Feed every 3 hours, nap at 2 PM",
  "schedule": "Daily routine",
  "allergies": ["peanuts", "dairy"],
  "emergencyContacts": [
    {
      "name": "Dr. Smith",
      "phone": "+1234567890"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Instructions updated successfully"
}
```

**Note:** This is a placeholder endpoint. In production, this will store instructions in Firestore and index them for retrieval.

#### POST `/bot/ask`
Ask chatbot a question about child care instructions.

**Authentication:** Not required (currently)

**Request Body:**
```json
{
  "sessionId": "uuid",
  "question": "What time should I feed the baby?"
}
```

**Response:**
```json
{
  "answer": "Based on the instructions, feed the baby every 3 hours...",
  "sources": ["instruction_id_1", "instruction_id_2"]
}
```

**Note:** This is a placeholder endpoint. In production, this will:
1. Retrieve relevant instructions from Firestore using RAG-like retrieval
2. Generate answer using LLM
3. Return answer with source references

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: No token provided or token invalid
- `FORBIDDEN`: User doesn't have permission (e.g., not admin, not session participant)
- `PROFILE_NOT_FOUND`: User profile not found
- `USER_NOT_FOUND`: User not found (admin endpoints)
- `SESSION_NOT_FOUND`: Session not found
- `CHILD_NOT_FOUND`: Child not found
- `ALERT_NOT_FOUND`: Alert not found
- `MESSAGE_NOT_FOUND`: Message not found
- `GPS_NOT_FOUND`: GPS location not found
- `DB_NOT_AVAILABLE`: Database connection unavailable
- `CREATE_FAILED`: Failed to create resource
- `UPDATE_FAILED`: Failed to update resource
- `INVALID_SESSION_STATUS`: Invalid session status for operation
- `INVALID_RECEIVER`: Receiver is not part of session
- `INTERNAL_SERVER_ERROR`: Server error

## Updating the API

### Adding New Endpoints

1. **Create route file** (if new module):
   ```bash
   touch backend/app/routes/new_module.py
   ```

2. **Define router and endpoints**:
   ```python
   from fastapi import APIRouter, Depends
   from app.utils.auth import verify_token, CurrentUser
   
   router = APIRouter()
   
   @router.get("/endpoint")
   async def new_endpoint(user: CurrentUser = Depends(verify_token)):
       return {"message": "Hello"}
   ```

3. **Register router in `main.py`**:
   ```python
   from app.routes import new_module
   app.include_router(new_module.router, prefix="/api/new", tags=["new"])
   ```

4. **Restart server** (auto-reload if using `--reload`)

### Updating Existing Endpoints

1. Edit the route file in `backend/app/routes/`
2. Server auto-reloads (if using `--reload` flag)
3. Test the endpoint using Swagger UI or curl

### Checking Changes

1. **View in Swagger UI**: http://localhost:8000/docs
2. **Test endpoint**: Use Swagger's "Try it out" feature
3. **Check logs**: Monitor terminal for errors

---

## Troubleshooting

### Server Won't Start

**Issue: Module not found**
```bash
# Solution: Activate virtual environment
source venv/bin/activate
pip install -r requirements.txt
```

**Issue: Port already in use**
```bash
# Solution: Use different port
uvicorn app.main:app --reload --port 8001
```

**Issue: Supabase credentials not found**
```bash
# Solution: Check .env file exists and has correct values
cat backend/.env
# Should show:
# SUPABASE_URL=...
# SUPABASE_ANON_KEY=...
```

### API Returns Errors

**401 Unauthorized**
- Token missing or expired
- Solution: Get new token from Supabase Auth

**403 Forbidden**
- User doesn't have required role (e.g., not admin)
- Solution: Use admin account or check user role

**404 Not Found**
- Endpoint doesn't exist
- Solution: Check URL and ensure router is registered

**500 Internal Server Error**
- Check server logs for details
- Verify database connection
- Check environment variables

### Database Connection Issues

**Issue: "DB_NOT_AVAILABLE" error**
```bash
# Check Supabase credentials
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Or check .env file
cat backend/.env
```

**Issue: "Supabase client initialization failed"**
- Verify credentials are correct
- Check network connection
- Ensure Supabase project is active

---

## Environment Variables

Set these environment variables in the `.env` file:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret  # Optional, for manual JWT verification
```

**Note:** The `.env` file is automatically loaded when the server starts.

## Session Management

Sessions are managed by Supabase Auth:

1. User signs in via Supabase Auth (frontend)
2. Supabase returns a JWT access token
3. Frontend includes this token in `Authorization: Bearer <token>` header
4. Backend validates the token and extracts user information
5. Token expires after a set period (configurable in Supabase)

## Best Practices

1. **Always include the Authorization header** for protected endpoints
2. **Handle token expiration** - refresh tokens when they expire
3. **Use proper error handling** - check `success` field in responses
4. **Validate user roles** - ensure admin endpoints are only called by admins
5. **Cache user profile** - don't fetch profile on every request
6. **Use Swagger UI for testing** - Interactive testing is faster than curl
7. **Monitor server logs** - Check for errors and warnings
8. **Test endpoints after changes** - Verify functionality before deploying

## Quick Reference

### Start Server
```bash
cd backend && ./start.sh
# OR
source venv/bin/activate && uvicorn app.main:app --reload
```

### Test Health
```bash
curl http://localhost:8000/health
```

### View Documentation
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Get User Profile
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/users/me
```

### Get Admin Stats
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:8000/api/admin/stats
```

## Frontend Integration

The frontend provides service layers:

- `user-api.service.ts` - User/profile operations
- `admin-api.service.ts` - Admin operations

These services handle:
- Token management
- Request/response transformation
- Error handling
- Retry logic

Example usage:

```typescript
// User profile
import { getCurrentUserProfileFromAPI } from '@/src/services/user-api.service';
const result = await getCurrentUserProfileFromAPI();

// Sessions
import { createSessionRequest, cancelSession, discoverAvailableSessions } from '@/src/services/session.service';
const session = await createSessionRequest({ parentId, childId, startTime, ... });
const cancelled = await cancelSession(sessionId, "Change of plans");
const available = await discoverAvailableSessions("nearby", 10);

// Children
import { getChildren, updateChildInstructions } from '@/src/services/child.service';
const children = await getChildren();
```

**Error Handling Pattern:**
All services return `{ success: boolean, data?: T, error?: AppError }` format for consistent error handling.

---

## API Endpoints Summary

### Quick Reference

**User Management:**
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user profile
- `GET /api/users/sitters/verified` - Get verified sitters (for parents to browse)

**Admin Operations:**
- `GET /api/admin/users` - List all users (admin only)
- `GET /api/admin/users/{user_id}` - Get user by ID (admin only)
- `PUT /api/admin/users/{user_id}` - Update user (admin only)
- `DELETE /api/admin/users/{user_id}` - Delete user (admin only)
- `GET /api/admin/stats` - Get admin statistics

**Session Management (Uber-like CRUD):**
- `GET /api/sessions` - Get user's sessions (filter by status)
- `GET /api/sessions/{session_id}` - Get session by ID
- `POST /api/sessions` - Create session request (parent only)
- `PUT /api/sessions/{session_id}` - Update session (status transitions)
- `DELETE /api/sessions/{session_id}` - Cancel session (soft delete)
- `GET /api/sessions/discover/available` - Discover available sessions (sitter only)

**Children Management:**
- `GET /api/children` - Get user's children (parent only)
- `GET /api/children/{child_id}` - Get child by ID
- `POST /api/children` - Create child profile (parent only)
- `PUT /api/children/{child_id}` - Update child profile
- `DELETE /api/children/{child_id}` - Delete child profile
- `GET /api/children/{child_id}/instructions` - Get child instructions
- `PUT /api/children/{child_id}/instructions` - Update/create child instructions

**Alerts:**
- `GET /api/alerts` - Get user's alerts (filter by session, status, type)
- `GET /api/alerts/{alert_id}` - Get alert by ID
- `POST /api/alerts` - Create alert (system use)
- `PUT /api/alerts/{alert_id}/view` - Mark alert as viewed
- `PUT /api/alerts/{alert_id}/acknowledge` - Acknowledge alert
- `PUT /api/alerts/{alert_id}/resolve` - Resolve alert

**GPS Tracking:**
- `POST /api/gps/track` - Record GPS location (sitter for active sessions)
- `GET /api/gps/sessions/{session_id}/gps` - Get GPS history for session
- `GET /api/gps/sessions/{session_id}/gps/latest` - Get latest GPS location

**Chat Messages:**
- `GET /api/sessions/{session_id}/messages` - Get session messages
- `POST /api/sessions/{session_id}/messages` - Send message
- `PUT /api/messages/{message_id}/read` - Mark message as read

**AI Services:**
- `POST /predict` - Cry detection prediction (audio upload)
- `POST /bot/update` - Update child care instructions for chatbot
- `POST /bot/ask` - Ask chatbot a question

**System:**
- `GET /health` - Health check
- `GET /` - API information and endpoint list

### Total Endpoints: 35

### Authentication Requirements

- **No Auth Required:** `/health`, `/`, `/predict`, `/bot/*` (currently)
- **User Auth Required:** All `/api/*` endpoints
- **Admin Only:** All `/api/admin/*` endpoints
- **Parent Only:** `/api/children/*`, `POST /api/sessions`
- **Sitter Only:** `GET /api/sessions/discover/available`, `POST /api/gps/track` (for active sessions)

### Latest Updates

**Session Management (Uber-like System):**
- ✅ State machine validation for status transitions
- ✅ Soft delete with cancellation tracking (`cancelled_at`, `cancelled_by`, `cancellation_reason`)
- ✅ Completion tracking (`completed_at`)
- ✅ Session discovery for sitters with multiple search scopes
- ✅ Automatic field updates based on status changes
- ✅ Multiple children per session (`childIds` array support)
- ✅ Time slots booking mode (`timeSlots` array for multi-day sessions)
- ✅ Graceful handling of missing database columns (`child_ids`, `time_slots`)

**User Profile:**
- ✅ Address, city, country fields added
- ✅ RLS-aware authentication for database access
- ✅ Verified sitters endpoint for parents to browse and select

**Error Handling:**
- ✅ Comprehensive error codes
- ✅ Detailed error messages
- ✅ RLS permission error detection

**Documentation:**
- ✅ Complete endpoint documentation
- ✅ Request/response examples
- ✅ Query parameter details
- ✅ Authentication requirements
- ✅ Status transition rules
