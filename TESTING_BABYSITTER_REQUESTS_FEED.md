# Testing Guide: Babysitter Requests Feed

This guide helps you test the complete babysitter requests feed implementation.

## Prerequisites

1. **Database Setup**
   - Run migration: `scripts/ADD_EXPIRES_AT_COLUMN.sql` in Supabase SQL Editor
   - Verify `expires_at` column exists in `sessions` table

2. **Backend Running**
   - Start backend: `cd backend && ./start.sh`
   - Verify server is running: `curl http://localhost:8000/health`

3. **Test Accounts**
   - At least 1 parent account
   - At least 1 sitter account
   - At least 1 child profile linked to parent

---

## Test Scenarios

### 1. Test Backend API Endpoint

#### 1.1 Test Discover Available Sessions (All Modes)

```bash
# Get sitter JWT token (from frontend login or Supabase Auth)
SITTER_TOKEN="your_sitter_jwt_token"

# Test discover endpoint (all scopes)
curl -X GET "http://localhost:8000/api/sessions/discover/available" \
  -H "Authorization: Bearer $SITTER_TOKEN" \
  -H "Content-Type: application/json"

# Test with city filter
curl -X GET "http://localhost:8000/api/sessions/discover/available?sitter_city=Colombo" \
  -H "Authorization: Bearer $SITTER_TOKEN"

# Test with scope filter
curl -X GET "http://localhost:8000/api/sessions/discover/available?scope=nearby&max_distance=10" \
  -H "Authorization: Bearer $SITTER_TOKEN"
```

**Expected Results:**
- ✅ Returns 200 OK
- ✅ Returns array of sessions with status `requested`
- ✅ Invite requests appear first (if sitter is invited)
- ✅ Sessions include `childIds`, `timeSlots`, `searchScope`, `expiresAt` fields
- ✅ No expired sessions (if `expires_at` is in the past)

#### 1.2 Test Role Verification

```bash
# Try with parent token (should fail)
PARENT_TOKEN="your_parent_jwt_token"

curl -X GET "http://localhost:8000/api/sessions/discover/available" \
  -H "Authorization: Bearer $PARENT_TOKEN"
```

**Expected Results:**
- ❌ Returns 403 Forbidden
- ❌ Error: "Only sitters can discover available sessions"

---

### 2. Test Request Modes

#### 2.1 INVITE Mode

**Setup:**
1. Login as parent
2. Create session with `searchScope: "invite"` and specific `sitterId`

**Test:**
```bash
# Create invite session (as parent)
PARENT_TOKEN="your_parent_jwt_token"
SITTER_ID="target_sitter_id"

curl -X POST "http://localhost:8000/api/sessions" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "parent_id",
    "sitterId": "'$SITTER_ID'",
    "childId": "child_id",
    "startTime": "2026-02-01T10:00:00Z",
    "endTime": "2026-02-01T14:00:00Z",
    "location": "123 Main St, Colombo",
    "hourlyRate": 25.50,
    "notes": "Please arrive 10 minutes early",
    "searchScope": "invite"
  }'

# Check if sitter sees it (login as sitter)
curl -X GET "http://localhost:8000/api/sessions/discover/available?scope=invite" \
  -H "Authorization: Bearer $SITTER_TOKEN"
```

**Expected Results:**
- ✅ Invite request appears in sitter's feed
- ✅ Request is pinned at the top
- ✅ Request shows "Invite" badge
- ✅ Only the invited sitter sees it

#### 2.2 NEARBY Mode

**Setup:**
1. Create session with `searchScope: "nearby"` and `maxDistanceKm: 10`

**Test:**
```bash
curl -X POST "http://localhost:8000/api/sessions" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "parent_id",
    "childId": "child_id",
    "startTime": "2026-02-01T10:00:00Z",
    "endTime": "2026-02-01T14:00:00Z",
    "location": "123 Main St, Colombo",
    "hourlyRate": 25.50,
    "searchScope": "nearby",
    "maxDistanceKm": 10
  }'
```

**Expected Results:**
- ✅ Request appears for all sitters
- ✅ Shows "Nearby" badge
- ✅ Location shows city-level only (not full address)

#### 2.3 CITY Mode

**Setup:**
1. Ensure parent's location has `city` field
2. Ensure sitter's profile has matching `city`
3. Create session with `searchScope: "city"`

**Test:**
```bash
curl -X POST "http://localhost:8000/api/sessions" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "parent_id",
    "childId": "child_id",
    "startTime": "2026-02-01T10:00:00Z",
    "endTime": "2026-02-01T14:00:00Z",
    "location": "{\"address\": \"123 Main St\", \"city\": \"Colombo\"}",
    "hourlyRate": 25.50,
    "searchScope": "city"
  }'
```

**Expected Results:**
- ✅ Request appears only for sitters in same city
- ✅ Shows "City" badge
- ✅ Location shows city name only

#### 2.4 NATIONWIDE Mode

**Test:**
```bash
curl -X POST "http://localhost:8000/api/sessions" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "parent_id",
    "childId": "child_id",
    "startTime": "2026-02-01T10:00:00Z",
    "endTime": "2026-02-01T14:00:00Z",
    "location": "123 Main St, Colombo",
    "hourlyRate": 25.50,
    "searchScope": "nationwide"
  }'
```

**Expected Results:**
- ✅ Request appears for all sitters
- ✅ Shows "Nationwide" badge

---

### 3. Test Frontend UI

#### 3.1 Access Requests Feed

1. **Login as Sitter**
   - Open app
   - Login with sitter credentials
   - Navigate to "Requests" tab (bottom navigation)

**Expected Results:**
- ✅ Requests feed loads
- ✅ Shows loading indicator initially
- ✅ Empty state if no requests
- ✅ List of requests if available

#### 3.2 Test Request Card Display

**Check each request card shows:**
- ✅ Child name and age (e.g., "Emma, 5 years old")
- ✅ Multiple children indicator (e.g., "+2 more children")
- ✅ Parent name (e.g., "from John Doe")
- ✅ Date and time (e.g., "Feb 01, 2026 • 10:00 AM")
- ✅ Duration (e.g., "4h" or "2 days 5 hours" for time slots)
- ✅ Location (city-level for non-invite, full address for invite)
- ✅ Hourly rate (e.g., "$25/hr")
- ✅ Parent notes (if provided)
- ✅ Request mode badge (Invite/Nearby/City/Nationwide)

#### 3.3 Test Invite Requests (Pinned)

**Setup:**
- Create at least 1 invite request and 1 nearby request

**Expected Results:**
- ✅ Invite requests appear in separate section at top
- ✅ Section header: "Direct Invitations (X)"
- ✅ Invite requests have left border accent (blue)
- ✅ Other requests appear below in "Available Requests" section

#### 3.4 Test Actions

**For INVITE Mode:**
- ✅ "Decline" button (red border)
- ✅ "Accept" button (blue background)
- ✅ Both buttons work correctly

**For Other Modes (Nearby/City/Nationwide):**
- ✅ "Ignore" button (gray border)
- ✅ "Accept" button (blue background)
- ✅ Ignore removes request from feed immediately
- ✅ Accept works correctly

#### 3.5 Test Real-Time Updates

**Setup:**
1. Open requests feed as sitter
2. In another device/browser, login as parent
3. Create a new session request

**Expected Results:**
- ✅ New request appears in sitter's feed automatically (without refresh)
- ✅ Request appears in correct section (invite vs other)

**Test Status Changes:**
1. Sitter accepts a request
2. Request should disappear from feed (or show as accepted)
3. If another sitter accepts, request should disappear

---

### 4. Test Edge Cases

#### 4.1 Expired Requests

**Setup:**
1. Create request with `expiresAt` in the past
2. Or manually set `expires_at` in database to past date

**Expected Results:**
- ✅ Expired requests don't appear in feed
- ✅ Backend filters them out

#### 4.2 Multiple Children

**Setup:**
1. Create session with `childIds: ["child1", "child2", "child3"]`

**Expected Results:**
- ✅ Request shows primary child name and age
- ✅ Shows "+2 more children" indicator
- ✅ All children loaded correctly

#### 4.3 Time Slots Mode

**Setup:**
1. Create session with `timeSlots` array (multiple days)

**Expected Results:**
- ✅ Duration calculated from time slots
- ✅ Shows format like "2 days 5 hours"
- ✅ Time slots displayed in session details

#### 4.4 Cancelled Requests

**Setup:**
1. Parent cancels a request
2. Or manually set `status = 'cancelled'` in database

**Expected Results:**
- ✅ Cancelled requests don't appear in feed
- ✅ Backend filters them out

#### 4.5 Accepted by Another Sitter

**Setup:**
1. Sitter A accepts a request
2. Check Sitter B's feed

**Expected Results:**
- ✅ Request disappears from Sitter B's feed
- ✅ Only Sitter A sees it (in their accepted sessions)

---

### 5. Test Backend Error Handling

#### 5.1 Missing Column Graceful Handling

**Test:**
- Remove `expires_at` column temporarily
- Call discover endpoint

**Expected Results:**
- ✅ No error (gracefully handles missing column)
- ✅ Still returns requests (just doesn't filter expired)

#### 5.2 Invalid Scope

```bash
curl -X GET "http://localhost:8000/api/sessions/discover/available?scope=invalid" \
  -H "Authorization: Bearer $SITTER_TOKEN"
```

**Expected Results:**
- ❌ Returns 400 Bad Request
- ❌ Error: "Scope must be one of: invite, nearby, city, nationwide"

---

### 6. Test Performance

#### 6.1 Large Dataset

**Setup:**
- Create 50+ session requests with different scopes

**Expected Results:**
- ✅ Feed loads within 2-3 seconds
- ✅ No UI freezing
- ✅ Smooth scrolling
- ✅ Proper pagination/limiting (max 100 requests)

---

### 7. Manual Database Verification

#### 7.1 Check Column Exists

```sql
-- Run in Supabase SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
AND column_name = 'expires_at';
```

**Expected Results:**
- ✅ Column exists
- ✅ Type is `timestamp with time zone`

#### 7.2 Check Indexes

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'sessions' 
AND indexname LIKE '%expires%';
```

**Expected Results:**
- ✅ `idx_sessions_expires_at` exists
- ✅ `idx_sessions_not_expired` exists

---

## Quick Test Checklist

- [ ] Backend discover endpoint returns 200 OK
- [ ] Parent cannot access discover endpoint (403)
- [ ] Invite requests appear at top
- [ ] Request cards show all required information
- [ ] Mode badges display correctly
- [ ] Accept/Decline buttons work
- [ ] Ignore button works (for non-invite)
- [ ] Real-time updates work
- [ ] Expired requests filtered out
- [ ] Cancelled requests filtered out
- [ ] Multiple children display correctly
- [ ] Time slots duration calculated correctly
- [ ] City filtering works (if city matches)
- [ ] Location shows correctly (city vs full address)

---

## Common Issues & Solutions

### Issue: "Only sitters can discover available sessions" error
**Solution:** Check user role in database. Ensure `role = 'sitter'` in `users` table.

### Issue: Invite requests not appearing
**Solution:** 
- Verify `sitterId` matches current sitter's ID
- Check `searchScope = 'invite'`
- Verify request status is `'requested'`

### Issue: City filtering not working
**Solution:**
- Ensure parent's `location` has `city` field
- Ensure sitter's profile has `city` field
- Verify cities match (case-insensitive)

### Issue: Expired requests still showing
**Solution:**
- Run migration: `scripts/ADD_EXPIRES_AT_COLUMN.sql`
- Verify `expires_at` column exists
- Check `expires_at` value is in the past

### Issue: Real-time updates not working
**Solution:**
- Check Supabase Realtime is enabled
- Verify WebSocket connection
- Check browser console for errors

---

## Testing Tools

1. **Postman/Insomnia**: For API testing
2. **Supabase Dashboard**: For database inspection
3. **React Native Debugger**: For frontend debugging
4. **Browser DevTools**: For network inspection

---

## Next Steps After Testing

1. **If all tests pass**: Feature is ready for production
2. **If issues found**: 
   - Check error logs
   - Verify database schema
   - Test individual components
   - Review code for edge cases

---

## Notes

- The `expires_at` column is optional - requests work without it
- Real-time updates require Supabase Realtime to be enabled
- City filtering requires both parent and sitter to have `city` in their profiles
- Ignore functionality is client-side only (doesn't persist across app restarts)
