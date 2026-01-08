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
  "hourlyRate": 25.50
}
```

**Response:** Same as GET `/api/users/me`

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

### AI Endpoints

#### POST `/predict`
Predict if audio contains crying sounds.

**Authentication:** Not required (or can be added)

#### POST `/bot/update`
Update child care instructions.

**Authentication:** Not required (or can be added)

#### POST `/bot/ask`
Ask chatbot a question.

**Authentication:** Not required (or can be added)

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
- `FORBIDDEN`: User doesn't have permission (e.g., not admin)
- `PROFILE_NOT_FOUND`: User profile not found
- `USER_NOT_FOUND`: User not found (admin endpoints)
- `DB_NOT_AVAILABLE`: Database connection unavailable
- `UPDATE_FAILED`: Failed to update resource
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
import { getCurrentUserProfileFromAPI } from '@/src/services/user-api.service';

const result = await getCurrentUserProfileFromAPI();
if (result.success) {
  const user = result.data;
  // Use user profile
} else {
  // Handle error
  console.error(result.error);
}
```
