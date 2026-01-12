# API Testing Guide

This guide explains how to test the Carelum API endpoints.

## Prerequisites

1. **Backend server running:**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Get authentication token:**
   - Use Supabase Auth to sign in
   - Extract the JWT token from the session
   - Or use the Supabase client in your frontend to get the token

## Quick Test Script

Use the provided test script:

```bash
cd backend
./test_endpoints.sh [YOUR_TOKEN]
```

Without a token, it will only check endpoint structure. With a token, it will test authentication and basic functionality.

## Manual Testing with curl

### 1. Health Check (No Auth)
```bash
curl http://localhost:8000/health
```

### 2. Get User Profile
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/users/me
```

### 3. Get Sessions
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/sessions
```

### 4. Get Children
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/children
```

### 5. Get Alerts
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/alerts
```

### 6. Create Session
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "parentId": "your-parent-id",
       "childId": "your-child-id",
       "startTime": "2024-01-01T10:00:00Z",
       "location": "123 Main St",
       "hourlyRate": 25.50
     }' \
     http://localhost:8000/api/sessions
```

### 7. Track GPS Location
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "session-uuid",
       "latitude": 40.7128,
       "longitude": -74.0060,
       "accuracy": 10.5
     }' \
     http://localhost:8000/api/gps/track
```

## Testing with Postman

1. **Import Collection:**
   - Create a new collection in Postman
   - Add environment variable: `base_url` = `http://localhost:8000`
   - Add environment variable: `token` = `YOUR_JWT_TOKEN`

2. **Set Authorization:**
   - For each request, set Authorization type to "Bearer Token"
   - Use `{{token}}` as the token value

3. **Test Endpoints:**
   - Start with `/health` (no auth)
   - Then `/api/users/me` (requires auth)
   - Continue with other endpoints

## Expected Responses

### Success Response
```json
{
  "id": "uuid",
  "field": "value",
  ...
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

## Common Issues

1. **401 UNAUTHORIZED:**
   - Token is missing or invalid
   - Token has expired
   - Solution: Get a fresh token from Supabase Auth

2. **403 FORBIDDEN:**
   - User doesn't have permission
   - User trying to access another user's data
   - Solution: Ensure you're authenticated as the correct user

3. **404 NOT FOUND:**
   - Resource doesn't exist
   - Invalid ID provided
   - Solution: Check the resource ID

4. **500 INTERNAL SERVER ERROR:**
   - Server-side error
   - Check server logs for details
   - Solution: Verify database connection and environment variables

## Testing Frontend Services

The frontend services have been migrated to use the REST API. To test:

1. **Start backend server:**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

2. **Start frontend:**
   ```bash
   npm start
   # or
   npx expo start
   ```

3. **Test in app:**
   - Login as a user
   - Navigate to different screens
   - Verify data loads correctly
   - Check that AsyncStorage caching still works
   - Verify real-time subscriptions still work

## Verification Checklist

- [ ] Health endpoint responds
- [ ] User profile endpoint works with auth
- [ ] Sessions can be created and retrieved
- [ ] Children can be created and retrieved
- [ ] Alerts can be created and retrieved
- [ ] GPS tracking works for active sessions
- [ ] Messages can be sent and retrieved
- [ ] Error handling works correctly
- [ ] Authentication is enforced
- [ ] Role-based access control works
- [ ] Frontend services work correctly
- [ ] AsyncStorage caching still works
- [ ] Real-time subscriptions still work
