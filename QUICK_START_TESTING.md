# Quick Start Testing Guide

## 🚀 Quick Setup & Test

### Step 1: Verify Environment Variables

**Backend (.env file):**
```bash
cd backend
# Create or edit .env file
nano .env
```

Add these lines:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

**Frontend (app.config.js or .env):**
```javascript
extra: {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
}
```

Or create `.env` in root:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 2: Create Database Schema

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy contents of `scripts/create-supabase-schema.sql`
3. Paste and **Run**
4. Verify tables appear in **Table Editor**

### Step 3: Run Verification Scripts

```bash
# Verify database connection
./scripts/verify-database-sync.sh

# Test database CRUD (requires Python)
cd backend
source venv/bin/activate
python ../scripts/test-database-crud.py
```

### Step 4: Start Backend

```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

**Expected output:**
```
✅ Supabase client initialized
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 5: Test Backend API

```bash
# Health check (no auth)
curl http://localhost:8000/health

# Should return: {"status":"healthy","service":"carelum-api"}
```

### Step 6: Start Frontend

```bash
npx expo start
```

### Step 7: Test in App

1. **Register a new user**
   - Go to Register screen
   - Fill in details
   - Submit
   - ✅ Check Supabase Dashboard → Table Editor → `users` table

2. **Login**
   - Should navigate instantly
   - ✅ Check browser console for: `✅ Session initialized from cache (instant)`

3. **Create a child**
   - Go to Instructions screen
   - Add child
   - ✅ Check Supabase `children` table

4. **Create a session**
   - Go to Home/Search
   - Create session
   - ✅ Check Supabase `sessions` table

5. **View activities**
   - Go to Activities screen
   - ✅ Should load instantly from AsyncStorage

## 🔍 Verification Checklist

### Database
- [ ] All tables exist in Supabase
- [ ] Backend connects to Supabase
- [ ] Frontend connects to Supabase

### User Operations
- [ ] Registration creates user in Supabase
- [ ] Login works instantly
- [ ] Profile updates sync to Supabase

### Children Operations
- [ ] Create child saves to AsyncStorage instantly
- [ ] Create child syncs to Supabase
- [ ] Read children loads instantly

### Sessions
- [ ] Create session saves locally instantly
- [ ] Create session syncs to Supabase
- [ ] Read sessions loads instantly

## 🐛 Common Issues

### "SUPABASE_URL not set"
**Solution:** Create `backend/.env` with Supabase credentials

### "Table doesn't exist"
**Solution:** Run `scripts/create-supabase-schema.sql` in Supabase SQL Editor

### "Backend can't connect"
**Solution:** 
1. Check `.env` file has correct credentials
2. Verify Supabase project is active
3. Check backend logs for errors

### "Data not syncing"
**Solution:**
1. Check browser console for errors
2. Verify backend is running
3. Check Supabase logs

## 📚 Full Testing Guide

For comprehensive testing instructions, see: **COMPREHENSIVE_TESTING_GUIDE.md**
