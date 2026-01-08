# Database Architecture

Complete guide to the Carelum database architecture using Supabase (PostgreSQL).

---

## 🏗️ Overview

Carelum uses **Supabase** (PostgreSQL) as the primary database with the following architecture:

- **Primary Storage**: Supabase PostgreSQL (persistent, cloud-hosted)
- **Local Cache**: AsyncStorage (instant UI, offline support)
- **Real-time**: Supabase Realtime subscriptions
- **File Storage**: Supabase Storage

### Data Flow

```
User Action → AsyncStorage (instant UI) → Supabase (background sync)
Supabase Changes → Realtime Subscription → AsyncStorage Update → UI Refresh
```

---

## 📊 Database Schema

### Core Tables

#### 1. `users` - User Profiles

Stores all user information (parents, sitters, admins).

**Columns:**
- `id` (UUID, Primary Key) - Unique user identifier
- `email` (TEXT, Unique) - User email address
- `display_name` (TEXT) - User's display name
- `role` (TEXT) - User role: `'parent'`, `'sitter'`, `'admin'`
- `phone_number` (TEXT) - Contact phone number
- `photo_url` (TEXT) - Profile picture URL
- `address` (TEXT) - Physical address
- `city` (TEXT) - City
- `country` (TEXT) - Country (default: 'Sri Lanka')
- `preferred_language` (TEXT) - Language preference: `'en'`, `'si'`, `'ta'`
- `user_number` (TEXT, Unique) - Readable ID: `p1`, `p2`, `b1`, `b2`, `a1`, etc.
- `theme` (TEXT) - UI theme: `'light'`, `'dark'`, `'auto'`
- `is_verified` (BOOLEAN) - Verification status for sitters
- `verification_status` (TEXT) - `'PENDING'`, `'APPROVED'`, `'REJECTED'`
- `hourly_rate` (DECIMAL) - Sitter's hourly rate
- `bio` (TEXT) - User biography
- `created_at` (TIMESTAMPTZ) - Account creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

**User Numbers:**
- Parents: `p1`, `p2`, `p3`, ...
- Sitters: `b1`, `b2`, `b3`, ...
- Admins: `a1`, `a2`, `a3`, ...

#### 2. `children` - Child Profiles

Stores child information for parents.

**Columns:**
- `id` (UUID, Primary Key) - Unique child identifier
- `parent_id` (UUID, Foreign Key → users.id) - Parent who owns this child
- `name` (TEXT) - Child's name
- `age` (INTEGER) - Child's age
- `date_of_birth` (DATE) - Child's date of birth
- `gender` (TEXT) - Child's gender
- `photo_url` (TEXT) - Child's photo URL
- `child_number` (TEXT, Unique) - Readable ID: `c1`, `c2`, `c3`, ...
- `parent_number` (TEXT) - Parent's user number (for quick reference)
- `sitter_number` (TEXT) - Assigned sitter's user number (if any)
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

**Relationships:**
- `parent_id` → `users.id` (CASCADE DELETE)

#### 3. `child_instructions` - Child Care Instructions

Stores care instructions for each child.

**Columns:**
- `id` (UUID, Primary Key)
- `child_id` (UUID, Foreign Key → children.id) - Child this instruction is for
- `parent_id` (UUID, Foreign Key → users.id) - Parent who created it
- `instruction` (TEXT) - Instruction text
- `priority` (TEXT) - `'low'`, `'medium'`, `'high'`
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Relationships:**
- `child_id` → `children.id` (CASCADE DELETE)
- `parent_id` → `users.id` (CASCADE DELETE)

#### 4. `sessions` - Care Sessions

Stores active and completed care sessions.

**Columns:**
- `id` (UUID, Primary Key)
- `parent_id` (UUID, Foreign Key → users.id)
- `sitter_id` (UUID, Foreign Key → users.id)
- `child_id` (UUID, Foreign Key → children.id)
- `status` (TEXT) - `'requested'`, `'accepted'`, `'active'`, `'completed'`, `'cancelled'`
- `start_time` (TIMESTAMPTZ) - Session start time
- `end_time` (TIMESTAMPTZ) - Session end time
- `duration_minutes` (INTEGER) - Session duration
- `hourly_rate` (DECIMAL) - Rate for this session
- `total_cost` (DECIMAL) - Total cost
- `notes` (TEXT) - Session notes
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Relationships:**
- `parent_id` → `users.id`
- `sitter_id` → `users.id`
- `child_id` → `children.id`

#### 5. `verification_requests` - Sitter Verification

Stores verification requests from sitters.

**Columns:**
- `id` (UUID, Primary Key)
- `sitter_id` (UUID, Foreign Key → users.id)
- `status` (TEXT) - `'PENDING'`, `'APPROVED'`, `'REJECTED'`
- `id_document_url` (TEXT) - ID document URL
- `background_check_url` (TEXT) - Background check document URL
- `certification_urls` (TEXT[]) - Array of certification URLs
- `rejection_reason` (TEXT) - Reason if rejected
- `submitted_at` (TIMESTAMPTZ)
- `reviewed_at` (TIMESTAMPTZ)
- `reviewed_by` (UUID, Foreign Key → users.id) - Admin who reviewed

**Relationships:**
- `sitter_id` → `users.id`
- `reviewed_by` → `users.id`

#### 6. `alerts` - System Alerts

Stores alerts (e.g., crying detected).

**Columns:**
- `id` (UUID, Primary Key)
- `session_id` (UUID, Foreign Key → sessions.id)
- `parent_id` (UUID, Foreign Key → users.id)
- `sitter_id` (UUID, Foreign Key → users.id)
- `type` (TEXT) - Alert type: `'CRYING_DETECTED'`, etc.
- `message` (TEXT) - Alert message
- `is_viewed` (BOOLEAN) - Whether parent viewed it
- `is_acknowledged` (BOOLEAN) - Whether parent acknowledged it
- `created_at` (TIMESTAMPTZ)

**Relationships:**
- `session_id` → `sessions.id`
- `parent_id` → `users.id`
- `sitter_id` → `users.id`

#### 7. `chat_messages` - Chat Messages

Stores chat messages between parents and sitters.

**Columns:**
- `id` (UUID, Primary Key)
- `session_id` (UUID, Foreign Key → sessions.id)
- `sender_id` (UUID, Foreign Key → users.id)
- `receiver_id` (UUID, Foreign Key → users.id)
- `message` (TEXT) - Message content
- `is_read` (BOOLEAN) - Read status
- `created_at` (TIMESTAMPTZ)

**Relationships:**
- `session_id` → `sessions.id`
- `sender_id` → `users.id`
- `receiver_id` → `users.id`

#### 8. `gps_tracking` - GPS Location Tracking

Stores GPS coordinates during active sessions.

**Columns:**
- `id` (UUID, Primary Key)
- `session_id` (UUID, Foreign Key → sessions.id)
- `sitter_id` (UUID, Foreign Key → users.id)
- `latitude` (DECIMAL) - GPS latitude
- `longitude` (DECIMAL) - GPS longitude
- `accuracy` (DECIMAL) - GPS accuracy in meters
- `timestamp` (TIMESTAMPTZ) - When location was recorded

**Relationships:**
- `session_id` → `sessions.id`
- `sitter_id` → `users.id`

#### 9. `audio_logs` - Audio Monitoring Logs

Stores audio analysis results (cry detection).

**Columns:**
- `id` (UUID, Primary Key)
- `session_id` (UUID, Foreign Key → sessions.id)
- `audio_url` (TEXT) - Audio file URL
- `crying_probability` (DECIMAL) - Probability of crying (0-1)
- `timestamp` (TIMESTAMPTZ)

**Relationships:**
- `session_id` → `sessions.id`

#### 10. `chatbot_conversations` - Chatbot Interactions

Stores chatbot conversation history.

**Columns:**
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key → users.id)
- `message` (TEXT) - User message
- `response` (TEXT) - Bot response
- `created_at` (TIMESTAMPTZ)

**Relationships:**
- `user_id` → `users.id`

---

## 🔒 Row Level Security (RLS)

All tables have Row Level Security enabled to ensure users can only access their own data.

### RLS Policies

#### Users Table
- **SELECT**: Users can read their own profile
- **INSERT**: Users can insert their own profile (via `create_user_profile` function)
- **UPDATE**: Users can update their own profile

#### Children Table
- **SELECT**: Parents can read their own children
- **INSERT**: Parents can insert children for themselves
- **UPDATE**: Parents can update their own children
- **DELETE**: Parents can delete their own children

#### Sessions Table
- **SELECT**: Parents and sitters can read sessions they're involved in
- **INSERT**: Parents can create sessions
- **UPDATE**: Parents and sitters can update sessions they're involved in

#### Other Tables
- Similar RLS policies based on ownership/participation

### Security Functions

- `create_user_profile()` - SECURITY DEFINER function to bypass RLS during sign-up
- Allows profile creation without violating RLS policies

---

## 📈 Readable Views

For easier data inspection, readable views are created that format timestamps:

- `users_readable` - Users with formatted timestamps
- `children_readable` - Children with formatted timestamps
- `sessions_readable` - Sessions with formatted timestamps
- `alerts_readable` - Alerts with formatted timestamps

**Example:**
```sql
SELECT * FROM users_readable;
-- Shows created_at and updated_at as readable strings
```

---

## 🔄 Real-time Subscriptions

Supabase Realtime is enabled for:
- `users` - User profile updates
- `children` - Child profile updates
- `child_instructions` - Instruction updates
- `sessions` - Session status changes
- `alerts` - New alerts
- `chat_messages` - New messages
- `gps_tracking` - Location updates

**How it works:**
1. App subscribes to table changes via `useRealtimeSync` hook
2. When data changes in Supabase, subscription fires
3. App updates AsyncStorage with new data
4. UI automatically refreshes

---

## 🗄️ Indexes

Indexes are created on frequently queried columns:

- `users.email` - Unique index for fast lookups
- `users.user_number` - Unique index
- `children.parent_id` - Index for parent's children queries
- `sessions.parent_id` - Index for parent's sessions
- `sessions.sitter_id` - Index for sitter's sessions
- `sessions.status` - Index for status filtering
- `alerts.parent_id` - Index for parent's alerts
- `chat_messages.session_id` - Index for session messages

---

## 📝 Migration Scripts

### Main Schema
- `create-supabase-schema.sql` - **Main schema file** - Run this first!

### Migration Scripts (for existing databases)
- `add-missing-user-columns.sql` - Adds missing columns to users table
- `add-user-number-column.sql` - Adds user_number column
- `FIX_RLS_*.sql` - Fixes Row Level Security issues

### When to Use Migration Scripts

1. **New Database**: Run `create-supabase-schema.sql` only
2. **Existing Database**: 
   - If missing columns → Run `add-missing-user-columns.sql`
   - If RLS issues → Run `FIX_RLS_FINAL.sql`
   - Otherwise, schema is already up to date

---

## 🚀 Setup Instructions

### Initial Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note your project URL and anon key

2. **Run Schema**
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste `scripts/create-supabase-schema.sql`
   - Run the script

3. **Enable Realtime**
   - Go to Database → Replication
   - Enable replication for: `users`, `children`, `sessions`, `alerts`, `chat_messages`, `gps_tracking`

4. **Configure App**
   - Add Supabase URL and anon key to `.env` or `app.config.js`
   - Restart app

### Troubleshooting

**RLS Issues:**
- Run `scripts/FIX_RLS_FINAL.sql` in SQL Editor

**Missing Columns:**
- Run `scripts/add-missing-user-columns.sql`

**Role Constraint Errors:**
- Run `scripts/FIX_RLS_FINAL.sql` (includes role constraint fix)

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│   User      │
│   Action    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  AsyncStorage   │ ← Instant UI Update
│  (Local Cache)  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│    Supabase     │ ← Background Sync
│  (PostgreSQL)   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   Realtime      │ ← Push Updates
│  Subscription   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  AsyncStorage   │ ← Update Cache
│  (Local Cache)  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│      UI         │ ← Refresh
│   Update        │
└─────────────────┘
```

---

## 🔍 Querying the Database

### Via Supabase Dashboard

1. Go to **Table Editor** → Select table
2. View, edit, or filter data
3. Use **SQL Editor** for custom queries

### Via App Code

```typescript
import { supabase } from '@/src/config/supabase';

// Query users
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('role', 'parent');

// Insert child
const { data, error } = await supabase
  .from('children')
  .insert({
    parent_id: userId,
    name: 'John',
    age: 5,
  });
```

---

## 📚 Related Documentation

- **[README_SUPABASE.md](./README_SUPABASE.md)** - Complete Supabase setup guide
- **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** - Admin user management
- **[APP_FEATURES_STATUS.md](./APP_FEATURES_STATUS.md)** - Feature implementation status

---

## 🛠️ Maintenance

### Backup

Supabase automatically backs up your database. For manual backups:
- Go to Database → Backups
- Download backup file

### Monitoring

- **Database Size**: Dashboard → Settings → Database
- **Query Performance**: Dashboard → Database → Query Performance
- **API Usage**: Dashboard → Settings → API

---

## ⚠️ Important Notes

1. **Never disable RLS** - It's critical for security
2. **Use migrations** - Don't modify schema directly in production
3. **Test queries** - Always test in development first
4. **Monitor usage** - Watch API usage and database size
5. **Backup regularly** - Even with automatic backups

---

For questions or issues, refer to the troubleshooting section in `README_SUPABASE.md`.
