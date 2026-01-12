# 🔍 Database & Integration Verification Plan

## Overview
Systematic verification of database schema, RLS policies, triggers, API integrations, and UI connections. We'll check each component step-by-step before moving to bigger features.

---

## 📋 Phase 1: Database Schema Verification

### Step 1.1: Verify Core Tables Exist
**Goal**: Ensure all required tables are created in Supabase

**Tables to verify:**
- [ ] `users` - User profiles
- [ ] `children` - Child profiles  
- [ ] `sessions` - Babysitting sessions
- [ ] `child_instructions` - Child care instructions
- [ ] `alerts` - Real-time alerts
- [ ] `chat_messages` - Chat messages
- [ ] `gps_tracking` - GPS location data
- [ ] `verification_requests` - Sitter verification
- [ ] `reviews` - Session reviews

**Action**: Run verification script or check Supabase Dashboard

**Files to check:**
- `scripts/create-supabase-schema.sql`
- `scripts/verify-database-sync-complete.py`

---

### Step 1.2: Verify Table Columns & Constraints
**Goal**: Ensure all columns exist and constraints are correct

**Check for each table:**
- [ ] Primary keys (UUID)
- [ ] Foreign key relationships
- [ ] Unique constraints (email, user_number, etc.)
- [ ] NOT NULL constraints
- [ ] CHECK constraints (role, status, etc.)
- [ ] Default values (created_at, updated_at, etc.)

**Action**: Compare schema SQL with actual Supabase tables

---

### Step 1.3: Verify Indexes
**Goal**: Ensure performance indexes are created

**Indexes to verify:**
- [ ] `idx_children_parent_id`
- [ ] `idx_sessions_parent_id`
- [ ] `idx_sessions_sitter_id`
- [ ] `idx_sessions_status`
- [ ] `idx_alerts_parent_id`
- [ ] `idx_chat_messages_session_id`
- [ ] `idx_gps_tracking_session_id`

**Action**: Check Supabase Dashboard → Database → Indexes

---

## 📋 Phase 2: RLS (Row Level Security) Policies

### Step 2.1: Verify Users Table RLS
**Goal**: Ensure users can only access their own data

**Policies to verify:**
- [ ] SELECT: Users can read own profile
- [ ] INSERT: Users can insert own profile
- [ ] UPDATE: Users can update own profile
- [ ] DELETE: Users can delete own profile (if needed)
- [ ] Admin policies (if applicable)

**Files to check:**
- `scripts/FIX_RLS_FINAL.sql`
- `scripts/FIX_USER_REGISTRATION_SYNC.sql`

**Action**: Test with different user roles

---

### Step 2.2: Verify Children Table RLS
**Goal**: Ensure parents can only access their own children

**Policies to verify:**
- [ ] SELECT: Parents can read own children
- [ ] INSERT: Parents can create children
- [ ] UPDATE: Parents can update own children
- [ ] DELETE: Parents can delete own children
- [ ] Sitter read access (if applicable)

**Files to check:**
- `scripts/FIX_CHILDREN_RLS.sql`

---

### Step 2.3: Verify Sessions Table RLS
**Goal**: Ensure proper access control for sessions

**Policies to verify:**
- [ ] SELECT: Parents can read own sessions
- [ ] SELECT: Sitters can read assigned sessions
- [ ] INSERT: Parents can create sessions
- [ ] UPDATE: Parents/Sitters can update relevant sessions
- [ ] Status-based access (pending, active, completed)

---

### Step 2.4: Verify Other Tables RLS
**Goal**: Ensure RLS for remaining tables

**Tables to check:**
- [ ] `alerts` - Parent/Sitter access
- [ ] `chat_messages` - Session participants only
- [ ] `gps_tracking` - Session participants only
- [ ] `verification_requests` - Sitter own requests
- [ ] `reviews` - Session participants only
- [ ] `child_instructions` - Parent access

---

## 📋 Phase 3: Database Triggers & Functions

### Step 3.1: Verify User Registration Trigger
**Goal**: Ensure auth.users → public.users sync works

**Functions to verify:**
- [ ] `handle_auth_user_created()` - Auto-creates user profile
- [ ] `create_user_profile()` RPC - Manual profile creation
- [ ] `on_auth_user_created` trigger - Fires on signup

**Files to check:**
- `scripts/FIX_USER_REGISTRATION_SYNC.sql`

**Test**: Register new user and verify profile created

---

### Step 3.2: Verify User Deletion Trigger
**Goal**: Ensure cascade deletion works

**Functions to verify:**
- [ ] `handle_auth_user_deleted()` - Deletes from public.users
- [ ] `on_auth_user_deleted` trigger

**Test**: Delete user and verify cleanup

---

### Step 3.3: Verify Timestamp Triggers
**Goal**: Ensure updated_at auto-updates

**Check:**
- [ ] `updated_at` column updates on row changes
- [ ] Trigger or function handles this

---

## 📋 Phase 4: API Endpoint Verification

### Step 4.1: Verify User/Profile API
**Goal**: Test user profile endpoints

**Endpoints to test:**
- [ ] `GET /api/users/me` - Get current user profile
- [ ] `PUT /api/users/me` - Update user profile
- [ ] Error handling (unauthorized, not found, etc.)

**Files to check:**
- `backend/app/routes/users.py`
- `src/services/user-api.service.ts`

**Test**: Use Postman/curl or test from UI

---

### Step 4.2: Verify Children API
**Goal**: Test children CRUD operations

**Endpoints to test:**
- [ ] `GET /api/children` - List parent's children
- [ ] `GET /api/children/{id}` - Get child by ID
- [ ] `POST /api/children` - Create child
- [ ] `PUT /api/children/{id}` - Update child
- [ ] `DELETE /api/children/{id}` - Delete child

**Files to check:**
- `backend/app/routes/children.py`
- `src/services/child.service.ts`

---

### Step 4.3: Verify Sessions API
**Goal**: Test session management endpoints

**Endpoints to test:**
- [ ] `GET /api/sessions` - List sessions
- [ ] `GET /api/sessions/{id}` - Get session details
- [ ] `POST /api/sessions` - Create session
- [ ] `PUT /api/sessions/{id}` - Update session
- [ ] Status transitions (pending → accepted → active → completed)

**Files to check:**
- `backend/app/routes/sessions.py`
- `src/services/session.service.ts` (if exists)

---

### Step 4.4: Verify Other APIs
**Goal**: Test remaining endpoints

**APIs to verify:**
- [ ] Alerts API (`/api/alerts`)
- [ ] GPS API (`/api/gps`)
- [ ] Messages API (`/api/messages`)
- [ ] Admin API (`/api/admin/*`)

---

## 📋 Phase 5: UI Integration Verification

### Step 5.1: Verify Profile Screen Integration
**Goal**: Ensure profile screen correctly reads/writes to DB

**Check:**
- [ ] Profile loads from Supabase on mount
- [ ] Profile updates save to Supabase
- [ ] Realtime updates work (profile changes reflect immediately)
- [ ] Error handling (network errors, validation errors)
- [ ] Loading states (no blocking UI)

**Files to check:**
- `app/(parent)/profile.tsx`
- `app/(sitter)/profile.tsx`
- `src/services/user-api.service.ts`
- `src/services/session-manager.service.ts`

**Test**: Update profile and verify in Supabase Dashboard

---

### Step 5.2: Verify Children Management Integration
**Goal**: Ensure children CRUD works from UI

**Check:**
- [ ] List children loads from Supabase
- [ ] Add child saves to Supabase
- [ ] Edit child updates Supabase
- [ ] Delete child removes from Supabase
- [ ] Realtime sync works

**Files to check:**
- `app/(parent)/profile.tsx` (children section)
- `src/services/child.service.ts`

**Test**: Add/edit/delete child and verify in DB

---

### Step 5.3: Verify Session Management Integration
**Goal**: Ensure session creation/management works

**Check:**
- [ ] Create session saves to Supabase
- [ ] Session list loads from Supabase
- [ ] Session status updates work
- [ ] Realtime session updates

**Files to check:**
- `app/(parent)/home.tsx`
- `app/(parent)/activities.tsx`
- `app/(sitter)/requests.tsx`

---

### Step 5.4: Verify Realtime Subscriptions
**Goal**: Ensure realtime updates work across features

**Check:**
- [ ] Profile realtime updates
- [ ] Children realtime updates
- [ ] Sessions realtime updates
- [ ] Alerts realtime updates
- [ ] Chat messages realtime updates

**Test**: Update data from another device/user and verify UI updates

---

## 📋 Phase 6: Data Flow Verification

### Step 6.1: Verify Registration Flow
**Goal**: End-to-end registration test

**Flow:**
1. [ ] User registers → Auth user created
2. [ ] Trigger fires → Profile created in `users` table
3. [ ] `display_name` saved correctly
4. [ ] Profile appears in UI immediately
5. [ ] No duplicate key errors

**Test**: Register new user and verify all steps

---

### Step 6.2: Verify Profile Update Flow
**Goal**: End-to-end profile update test

**Flow:**
1. [ ] User edits profile in UI
2. [ ] Update sent to API
3. [ ] API updates Supabase
4. [ ] Auth metadata updated (if display_name)
5. [ ] Realtime subscription fires
6. [ ] UI updates immediately
7. [ ] Other devices/users see update

**Test**: Update profile and verify sync

---

### Step 6.3: Verify Children CRUD Flow
**Goal**: End-to-end children operations

**Flow:**
1. [ ] Parent adds child → Saved to Supabase
2. [ ] Child appears in list immediately
3. [ ] Edit child → Updates Supabase
4. [ ] Delete child → Removed from Supabase
5. [ ] Realtime sync works

**Test**: Full CRUD cycle for children

---

## 📋 Phase 7: Error Handling & Edge Cases

### Step 7.1: Verify Network Error Handling
**Goal**: Ensure graceful degradation

**Scenarios:**
- [ ] API unavailable → Falls back to Supabase direct
- [ ] Supabase unavailable → Shows error message
- [ ] Partial network failure → Retry logic works
- [ ] Timeout handling

**Files to check:**
- `src/services/user-api.service.ts`
- `src/services/session-manager.service.ts`
- `src/utils/errorHandler.ts`

---

### Step 7.2: Verify Validation & Constraints
**Goal**: Ensure data integrity

**Scenarios:**
- [ ] Duplicate email → Error shown
- [ ] Invalid role → Error shown
- [ ] Missing required fields → Validation error
- [ ] Foreign key violations → Error handled

---

### Step 7.3: Verify RLS Edge Cases
**Goal**: Ensure security policies work

**Scenarios:**
- [ ] User tries to access another user's data → Blocked
- [ ] Parent tries to access another parent's children → Blocked
- [ ] Sitter tries to access unrelated sessions → Blocked
- [ ] Unauthenticated requests → Blocked

---

## 📋 Phase 8: Storage Integration

### Step 8.1: Verify Profile Image Upload
**Goal**: Ensure image uploads work

**Check:**
- [ ] Image picker works
- [ ] Upload to Supabase Storage succeeds
- [ ] URL saved to `users.photo_url`
- [ ] Image displays in UI
- [ ] RLS policies allow upload

**Files to check:**
- `src/services/storage.service.ts`
- `SUPABASE_STORAGE_SETUP.md`

---

### Step 8.2: Verify Child Image Upload
**Goal**: Ensure child images work

**Check:**
- [ ] Upload to `child-images` bucket
- [ ] URL saved to `children.photo_url`
- [ ] Image displays correctly

---

## 📋 Phase 9: Performance & Optimization

### Step 9.1: Verify Query Performance
**Goal**: Ensure queries are optimized

**Check:**
- [ ] Indexes are used
- [ ] No N+1 queries
- [ ] Pagination works (if implemented)
- [ ] Query timeouts handled

---

### Step 9.2: Verify Realtime Performance
**Goal**: Ensure realtime doesn't cause issues

**Check:**
- [ ] Subscriptions cleaned up on unmount
- [ ] No memory leaks
- [ ] Realtime updates don't block UI
- [ ] Multiple subscriptions work correctly

---

## 📋 Phase 10: Documentation & Testing

### Step 10.1: Verify Test Scripts
**Goal**: Ensure test scripts work

**Scripts to verify:**
- [ ] `scripts/verify-database-sync-complete.py`
- [ ] `scripts/test-database-crud.py`
- [ ] `scripts/test-user-registration.py`

**Action**: Run each script and verify output

---

### Step 10.2: Update Documentation
**Goal**: Keep docs in sync with implementation

**Docs to update:**
- [ ] `APP_FEATURES_STATUS.md` - Update status
- [ ] `README.md` - Update setup instructions
- [ ] `backend/API_GUIDE.md` - Update API docs
- [ ] SQL scripts - Add comments if needed

---

## 🎯 Execution Order

**Recommended sequence:**
1. **Phase 1** - Schema verification (foundation)
2. **Phase 2** - RLS policies (security)
3. **Phase 3** - Triggers & functions (automation)
4. **Phase 4** - API endpoints (backend)
5. **Phase 5** - UI integration (frontend)
6. **Phase 6** - Data flow (end-to-end)
7. **Phase 7** - Error handling (robustness)
8. **Phase 8** - Storage (files)
9. **Phase 9** - Performance (optimization)
10. **Phase 10** - Documentation (maintenance)

---

## 📝 Notes

- Check each item systematically
- Fix issues as they're found before moving to next phase
- Document any deviations or issues
- Keep this plan updated as we progress

---

## ✅ Quick Start Commands

```bash
# Verify database schema
cd scripts
python3 verify-database-sync-complete.py

# Test database CRUD
python3 test-database-crud.py

# Test user registration
python3 test-user-registration.py

# Check Supabase connection
python3 test-supabase-connection.py
```
