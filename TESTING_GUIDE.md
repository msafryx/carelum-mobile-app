# Complete Testing Guide - Carelum Platform

## 📋 Overview

This guide provides step-by-step instructions to test all features of the Carelum platform, including database sync, CRUD operations, user sessions, and all app features.

---

## 🔍 Step 1: Verify Database Sync

### Quick Verification

```bash
cd "/home/muhammed_safry/My Projects/Carelum/frontend"
./scripts/verify-database-sync.sh
```

**Or manually:**
```bash
cd backend
source venv/bin/activate
python3 ../scripts/verify-database-sync-complete.py
```

**Expected Output:**
```
✅ ALL TABLES ARE SYNCED AND WORKING!
```

**If tables are missing:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste `scripts/create-supabase-schema.sql`
5. Click **Run**
6. Re-run the verification script

---

## 🗄️ Step 2: Test Database CRUD Operations

### 2.1 Test Backend Connection

```bash
cd backend
source venv/bin/activate
python3 -c "from app.utils.database import get_supabase; client = get_supabase(); print('✅ Connected' if client else '❌ Failed')"
```

### 2.2 Test Direct Database Access

```bash
cd backend
source venv/bin/activate
python3 ../scripts/test-database-crud.py
```

**Expected Output:**
```
✅ All CRUD operations (READ) are working
```

---

## 🚀 Step 3: Test Backend API

### 3.1 Start Backend Server

```bash
cd backend
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000
```

**Look for:**
```
✅ Supabase client initialized
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 3.2 Test Health Endpoint

```bash
curl http://localhost:8000/health
```

**Expected:** `{"status":"healthy","service":"carelum-api"}`

### 3.3 Test API Root

```bash
curl http://localhost:8000/
```

**Expected:** JSON with all available endpoints

---

## 👤 Step 4: Test User Authentication

### 4.1 Test User Registration

**Via Frontend:**
1. Open app
2. Go to **Register** screen
3. Fill in:
   - Email: `test@example.com`
   - Password: `test123456`
   - Role: Select **Parent** or **Sitter**
4. Click **Register**

**Expected:**
- ✅ User created in Supabase `auth.users`
- ✅ User profile created in `public.users` table
- ✅ Redirected to appropriate home screen

**Verify in Supabase:**
1. Go to **Table Editor** → `users`
2. Check new user appears

### 4.2 Test User Login

**Via Frontend:**
1. Go to **Login** screen
2. Enter credentials
3. Click **Login**

**Expected:**
- ✅ Login successful
- ✅ User profile loaded
- ✅ Redirected to correct role-based home screen
- ✅ No "admin profile loading for specific user" issue

**Verify:**
- Check browser console for errors
- Check user profile loads correctly

### 4.3 Test Profile Update

**Via Frontend:**
1. Go to **Profile** screen
2. Update display name or phone number
3. Save

**Expected:**
- ✅ Profile updates instantly (AsyncStorage)
- ✅ Updates sync to Supabase in background
- ✅ Changes persist after app restart

**Verify in Supabase:**
1. Go to **Table Editor** → `users`
2. Check `updated_at` timestamp changed
3. Check field values updated

---

## 👶 Step 5: Test Children Management

### 5.1 Create Child (Parent Only)

**Via Frontend:**
1. Login as **Parent**
2. Navigate to children management (if available)
3. Add a new child:
   - Name: `Test Child`
   - Age: `5`
   - Date of Birth: Select date
   - Gender: Select

**Expected:**
- ✅ Child created in `children` table
- ✅ `parent_id` matches logged-in user
- ✅ Child appears in children list

**Verify in Supabase:**
```sql
SELECT * FROM children WHERE parent_id = '<your-user-id>';
```

### 5.2 Add Child Instructions

**Via Frontend:**
1. Select a child
2. Go to **Instructions** screen
3. Add:
   - Feeding schedule
   - Nap schedule
   - Allergies
   - Emergency contacts

**Expected:**
- ✅ Instructions saved to `child_instructions` table
- ✅ Instructions load when viewing child

**Verify in Supabase:**
```sql
SELECT * FROM child_instructions WHERE child_id = '<child-id>';
```

### 5.3 Test Child CRUD via API

```bash
# Get auth token first (from login)
TOKEN="your-jwt-token"

# List children
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/children

# Get child by ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/children/<child-id>

# Get child instructions
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/children/<child-id>/instructions
```

---

## 📅 Step 6: Test Sessions

### 6.1 Create Session (Parent)

**Via Frontend:**
1. Login as **Parent**
2. Create a new session:
   - Select child
   - Select sitter (if available)
   - Set start time
   - Set end time
   - Add location

**Expected:**
- ✅ Session created in `sessions` table
- ✅ Status: `pending`
- ✅ Session appears in **Activities** screen

**Verify in Supabase:**
```sql
SELECT * FROM sessions WHERE parent_id = '<your-user-id>' ORDER BY created_at DESC LIMIT 1;
```

### 6.2 Accept Session (Sitter)

**Via Frontend:**
1. Login as **Sitter**
2. Go to **Requests** or **Activities** screen
3. Find pending session
4. Accept session

**Expected:**
- ✅ Session status changes to `accepted`
- ✅ `sitter_id` updated
- ✅ Both parent and sitter see updated status

**Verify in Supabase:**
```sql
SELECT status, sitter_id FROM sessions WHERE id = '<session-id>';
```

### 6.3 Start Session (Sitter)

**Via Frontend:**
1. Sitter starts session
2. Status changes to `active`

**Expected:**
- ✅ Session status: `active`
- ✅ GPS tracking begins
- ✅ Real-time monitoring available

### 6.4 View Session Details

**Via Frontend:**
1. Click on session in **Activities** screen
2. View session details

**Expected:**
- ✅ Session info displays
- ✅ GPS map shows location (if active)
- ✅ Cry detection alerts visible
- ✅ Chat messages visible
- ✅ Session controls work

**Test API:**
```bash
# Get session by ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/sessions/<session-id>

# List user sessions
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/sessions
```

### 6.5 Complete Session

**Via Frontend:**
1. Sitter ends session
2. Status changes to `completed`

**Expected:**
- ✅ Session status: `completed`
- ✅ `end_time` set
- ✅ Session appears in **Completed** tab

---

## 📍 Step 7: Test GPS Tracking

### 7.1 Start GPS Tracking

**Via Frontend:**
1. Start an active session
2. GPS tracking should begin automatically

**Expected:**
- ✅ Location updates sent to `gps_tracking` table
- ✅ Map shows real-time location
- ✅ Location history visible

**Verify in Supabase:**
```sql
SELECT * FROM gps_tracking WHERE session_id = '<session-id>' ORDER BY created_at DESC LIMIT 10;
```

**Test API:**
```bash
# Track GPS location
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<session-id>", "latitude": 6.9271, "longitude": 79.8612}' \
  http://localhost:8000/api/gps/track

# Get GPS history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/gps/sessions/<session-id>/gps
```

---

## 🚨 Step 8: Test Alerts

### 8.1 Create Alert

**Via Frontend:**
1. During active session
2. Cry detection triggers alert

**Expected:**
- ✅ Alert created in `alerts` table
- ✅ Alert appears in **Alerts** screen
- ✅ Push notification sent (if enabled)

**Verify in Supabase:**
```sql
SELECT * FROM alerts WHERE session_id = '<session-id>' ORDER BY created_at DESC LIMIT 5;
```

**Test API:**
```bash
# List alerts
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/alerts

# Get alert by ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/alerts/<alert-id>
```

### 8.2 Acknowledge Alert

**Via Frontend:**
1. View alert
2. Click **Acknowledge**

**Expected:**
- ✅ Alert status: `acknowledged`
- ✅ `acknowledged_at` timestamp set

---

## 💬 Step 9: Test Chat Messages

### 9.1 Send Message

**Via Frontend:**
1. Open session chat
2. Type message
3. Send

**Expected:**
- ✅ Message saved to `chat_messages` table
- ✅ Message appears in chat
- ✅ Real-time update for other user

**Verify in Supabase:**
```sql
SELECT * FROM chat_messages WHERE session_id = '<session-id>' ORDER BY created_at DESC;
```

**Test API:**
```bash
# Get session messages
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/sessions/<session-id>/messages

# Send message (if endpoint exists)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<session-id>", "receiver_id": "<receiver-id>", "message": "Test message"}' \
  http://localhost:8000/api/sessions/<session-id>/messages
```

---

## 🤖 Step 10: Test AI Features

### 10.1 Cry Detection

**Via Frontend:**
1. During active session
2. Cry detection should trigger automatically

**Expected:**
- ✅ Alert created
- ✅ Visual indicator shown
- ✅ Audio recording (if enabled)

**Test API:**
```bash
# Cry detection endpoint
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<session-id>", "audio_data": "base64..."}' \
  http://localhost:8000/predict
```

### 10.2 Chatbot

**Via Frontend:**
1. Open chatbot in session
2. Ask question about child instructions

**Expected:**
- ✅ Bot responds with relevant information
- ✅ Uses child instructions as context

**Test API:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<session-id>", "message": "What are the feeding instructions?"}' \
  http://localhost:8000/bot
```

---

## 👨‍💼 Step 11: Test Admin Features

### 11.1 Admin Login

**Via Frontend:**
1. Login as admin user
2. Should see admin dashboard

**Expected:**
- ✅ Admin home screen loads
- ✅ Access to admin features

### 11.2 View All Users

**Via Frontend:**
1. Go to **Users** screen
2. View user list

**Expected:**
- ✅ All users displayed
- ✅ User details visible

**Test API:**
```bash
# Get all users (admin only)
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/api/admin/users

# Get statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/api/admin/stats
```

### 11.3 Verify Sitter

**Via Frontend:**
1. Go to **Verifications** screen
2. View pending requests
3. Approve/reject

**Expected:**
- ✅ Verification status updated
- ✅ Sitter `is_verified` updated

**Verify in Supabase:**
```sql
SELECT * FROM verification_requests WHERE status = 'pending';
SELECT * FROM users WHERE role = 'sitter' AND is_verified = true;
```

---

## 🔄 Step 12: Test Real-time Updates

### 12.1 Test Session Status Updates

**Setup:**
1. Login as Parent in one browser/device
2. Login as Sitter in another browser/device
3. Both view same session

**Test:**
1. Sitter accepts session
2. Parent should see status update automatically

**Expected:**
- ✅ Real-time status update
- ✅ No page refresh needed

### 12.2 Test Chat Real-time

**Setup:**
1. Parent and Sitter both in chat
2. Parent sends message

**Expected:**
- ✅ Sitter sees message immediately
- ✅ No refresh needed

---

## 📱 Step 13: Test Frontend Features

### 13.1 Activities Screen

**Test:**
1. Login
2. Go to **Activities**
3. View sessions by status (Ongoing, Completed, Cancelled)

**Expected:**
- ✅ Sessions load from database
- ✅ Correct status filtering
- ✅ Click session → Navigate to detail screen

### 13.2 Settings Screen

**Test:**
1. Go to **Settings**
2. Update preferences
3. Save

**Expected:**
- ✅ Settings saved
- ✅ Changes persist

### 13.3 Profile Screen

**Test:**
1. Go to **Profile**
2. View user info
3. Edit profile

**Expected:**
- ✅ Profile displays correctly
- ✅ Updates work

---

## ✅ Step 14: Complete Feature Checklist

Use this checklist to verify all features:

### Authentication
- [ ] User registration
- [ ] User login
- [ ] Role-based routing (parent/sitter/admin)
- [ ] Profile update
- [ ] Logout

### Children Management
- [ ] Create child
- [ ] View children list
- [ ] Update child
- [ ] Delete child
- [ ] Add child instructions
- [ ] View child instructions

### Sessions
- [ ] Create session (parent)
- [ ] View sessions list
- [ ] Accept session (sitter)
- [ ] Start session
- [ ] View session details
- [ ] Complete session
- [ ] Cancel session

### GPS Tracking
- [ ] GPS tracking starts automatically
- [ ] Real-time location updates
- [ ] Location history visible
- [ ] Map displays correctly

### Alerts
- [ ] Cry detection alerts
- [ ] Alert notifications
- [ ] View alerts list
- [ ] Acknowledge alerts

### Chat
- [ ] Send message
- [ ] Receive message
- [ ] Real-time chat updates
- [ ] Message history

### AI Features
- [ ] Cry detection works
- [ ] Chatbot responds
- [ ] Instructions retrieval

### Admin
- [ ] Admin login
- [ ] View all users
- [ ] View statistics
- [ ] Verify sitters
- [ ] Manage verifications

---

## 🐛 Troubleshooting

### Database Not Synced

**Symptoms:**
- Tables don't exist
- CRUD operations fail

**Fix:**
1. Run `scripts/create-supabase-schema.sql` in Supabase SQL Editor
2. Re-run verification script

### RLS Policy Issues

**Symptoms:**
- "Permission denied" errors
- Can't read own data

**Fix:**
1. Run `scripts/FIX_RLS_FINAL.sql` in Supabase SQL Editor
2. Check RLS policies in Dashboard

### API Not Working

**Symptoms:**
- 500 errors
- Connection refused

**Fix:**
1. Check backend server is running
2. Verify `.env` file has correct credentials
3. Check backend logs for errors

### Frontend Not Loading Data

**Symptoms:**
- Empty screens
- Loading forever

**Fix:**
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check AsyncStorage for cached data
4. Clear app cache and restart

---

## 📊 Testing Summary

After completing all tests, you should have verified:

✅ Database tables exist and are accessible  
✅ CRUD operations work for all tables  
✅ User authentication works  
✅ Sessions can be created and managed  
✅ GPS tracking works  
✅ Alerts are created and displayed  
✅ Chat messages work  
✅ Real-time updates function  
✅ Admin features work  
✅ All frontend screens load correctly  

---

## 🎯 Next Steps

1. **Performance Testing**: Test with multiple users
2. **Load Testing**: Test with many sessions/alerts
3. **Security Testing**: Verify RLS policies
4. **Mobile Testing**: Test on iOS/Android devices
5. **Offline Testing**: Test offline functionality

---

## 📝 Notes

- Always test with real Supabase credentials
- Use test accounts, not production data
- Check Supabase Dashboard for data verification
- Monitor backend logs for errors
- Use browser DevTools for frontend debugging
