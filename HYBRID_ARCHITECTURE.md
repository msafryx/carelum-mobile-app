# Hybrid Database Architecture

> **Note**: See `DATABASE_GUIDE.md` for how to use and connect databases.

## Overview
This architecture uses **local database (SQLite)** for primary data storage and **Firebase** only for real-time features, reducing costs and improving offline capabilities.

## 🎯 Architecture Strategy

### Local Database (SQLite) - Primary Storage
**Use for:**
- User profiles
- Child profiles
- Child instructions
- Session history (cached)
- Verification requests
- Reviews
- Settings & preferences

**Benefits:**
- ✅ Fast local reads (no network latency)
- ✅ Works offline
- ✅ Lower Firebase costs
- ✅ Better performance
- ✅ Data privacy (stays on device)

### Firebase - Real-time Features Only
**Use for:**
- Real-time session status updates
- Live GPS tracking during active sessions
- Real-time chat messages
- Push notifications
- Live alerts (cry detection)
- Active session monitoring

**Benefits:**
- ✅ Real-time synchronization
- ✅ Cross-device updates
- ✅ Push notifications
- ✅ Live collaboration

---

## 📊 Data Storage Strategy

### Local Database (SQLite) Collections

#### 1. Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  displayName TEXT,
  role TEXT NOT NULL, -- 'parent' | 'babysitter' | 'admin'
  phoneNumber TEXT,
  profileImageUrl TEXT,
  preferredLanguage TEXT,
  theme TEXT,
  isVerified INTEGER DEFAULT 0,
  verificationStatus TEXT,
  hourlyRate REAL,
  bio TEXT,
  createdAt INTEGER,
  updatedAt INTEGER,
  lastLoginAt INTEGER
);
```

#### 2. Children Table
```sql
CREATE TABLE children (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  dateOfBirth INTEGER,
  gender TEXT,
  photoUrl TEXT,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (parentId) REFERENCES users(id)
);
```

#### 3. Child Instructions Table
```sql
CREATE TABLE child_instructions (
  id TEXT PRIMARY KEY,
  childId TEXT NOT NULL,
  parentId TEXT NOT NULL,
  feedingSchedule TEXT,
  napSchedule TEXT,
  bedtime TEXT,
  dietaryRestrictions TEXT,
  allergies TEXT, -- JSON array
  medications TEXT, -- JSON array
  favoriteActivities TEXT, -- JSON array
  comfortItems TEXT, -- JSON array
  routines TEXT,
  specialNeeds TEXT,
  emergencyContacts TEXT, -- JSON array
  doctorInfo TEXT, -- JSON object
  additionalNotes TEXT,
  instructionText TEXT, -- Full text for RAG
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (childId) REFERENCES children(id),
  FOREIGN KEY (parentId) REFERENCES users(id)
);
```

#### 4. Sessions Table (Cached)
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL,
  sitterId TEXT NOT NULL,
  childId TEXT NOT NULL,
  status TEXT NOT NULL,
  startTime INTEGER,
  endTime INTEGER,
  duration REAL,
  locationAddress TEXT,
  locationLatitude REAL,
  locationLongitude REAL,
  hourlyRate REAL,
  totalAmount REAL,
  paymentStatus TEXT,
  instructions TEXT,
  specialNotes TEXT,
  gpsTrackingEnabled INTEGER DEFAULT 0,
  monitoringEnabled INTEGER DEFAULT 0,
  cryDetectionEnabled INTEGER DEFAULT 0,
  completedAt INTEGER,
  parentRating INTEGER,
  parentReview TEXT,
  sitterRating INTEGER,
  sitterReview TEXT,
  cancelledAt INTEGER,
  cancelledBy TEXT,
  cancellationReason TEXT,
  firebaseSynced INTEGER DEFAULT 0, -- Track sync status
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (parentId) REFERENCES users(id),
  FOREIGN KEY (sitterId) REFERENCES users(id),
  FOREIGN KEY (childId) REFERENCES children(id)
);
```

#### 5. Verification Requests Table
```sql
CREATE TABLE verification_requests (
  id TEXT PRIMARY KEY,
  sitterId TEXT NOT NULL,
  fullName TEXT,
  dateOfBirth INTEGER,
  idNumber TEXT,
  idDocumentUrl TEXT,
  backgroundCheckUrl TEXT,
  certifications TEXT, -- JSON array
  status TEXT,
  submittedAt INTEGER,
  reviewedAt INTEGER,
  reviewedBy TEXT,
  rejectionReason TEXT,
  bio TEXT,
  qualifications TEXT, -- JSON array
  hourlyRate REAL,
  firebaseSynced INTEGER DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (sitterId) REFERENCES users(id)
);
```

#### 6. Reviews Table
```sql
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  reviewerId TEXT NOT NULL,
  revieweeId TEXT NOT NULL,
  reviewerRole TEXT,
  rating INTEGER,
  review TEXT,
  categories TEXT, -- JSON object
  firebaseSynced INTEGER DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER,
  FOREIGN KEY (sessionId) REFERENCES sessions(id)
);
```

### Firebase Collections (Real-time Only)

#### 1. `sessions` - Active Sessions Only
```typescript
// Only store ACTIVE sessions in Firebase for real-time updates
sessions/{sessionId}
{
  parentId: string
  sitterId: string
  childId: string
  status: 'active' // Only active sessions
  currentLocation?: { latitude, longitude, timestamp }
  lastLocationUpdate?: Timestamp
  lastCryDetection?: Timestamp
  cryAlertsCount?: number
}
```

#### 2. `gpsTracking` - Live Location Updates
```typescript
// Real-time GPS tracking during active sessions
gpsTracking/{trackingId}
{
  sessionId: string
  sitterId: string
  location: { latitude, longitude }
  timestamp: Timestamp
}
```

#### 3. `chatMessages` - Real-time Messaging
```typescript
// Real-time messages between parent and sitter
chatMessages/{messageId}
{
  sessionId?: string
  parentId: string
  sitterId: string
  senderId: string
  message: string
  read: boolean
  createdAt: Timestamp
}
```

#### 4. `alerts` - Live Alerts
```typescript
// Real-time alerts (cry detection, emergency)
alerts/{alertId}
{
  sessionId?: string
  parentId: string
  sitterId?: string
  type: 'cry_detection' | 'emergency'
  severity: 'high' | 'critical'
  status: 'new'
  createdAt: Timestamp
}
```

#### 5. `notifications` - Push Notifications
```typescript
// Real-time notifications
notifications/{notificationId}
{
  userId: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: Timestamp
}
```

---

## 🔄 Sync Strategy

### Sync Flow

```
Local Database (SQLite)
    ↕️ Sync Service
Firebase (Real-time)
```

### When to Sync

1. **On App Start**: Sync local data with Firebase
2. **After Local Changes**: Push to Firebase
3. **Real-time Updates**: Pull from Firebase to local
4. **Background Sync**: Periodic sync for offline changes

### Sync Service Implementation

```typescript
// src/services/sync.service.ts

export class SyncService {
  // Sync local sessions to Firebase (only active ones)
  async syncActiveSessions() {
    // Get active sessions from local DB
    // Push to Firebase
  }

  // Pull Firebase updates to local
  async syncFromFirebase() {
    // Listen to Firebase changes
    // Update local database
  }

  // Sync pending changes (offline queue)
  async syncPendingChanges() {
    // Check for unsynced records
    // Push to Firebase
  }
}
```

---

## 📱 Implementation Plan

### Phase 1: Set Up Local Database

1. **Install SQLite**
   ```bash
   npm install expo-sqlite
   ```

2. **Create Database Schema**
   - Create tables on app initialization
   - Set up migrations

3. **Create Local Service Layer**
   - `local-db.service.ts` - SQLite operations
   - Wrapper functions for all CRUD operations

### Phase 2: Hybrid Services

1. **Update Existing Services**
   - Read from local DB first
   - Write to local DB
   - Sync to Firebase in background

2. **Real-time Services**
   - Keep Firebase listeners for active sessions
   - Update local DB when Firebase changes

### Phase 3: Sync Mechanism

1. **Background Sync**
   - Sync on app start
   - Sync on network reconnect
   - Periodic sync (every 5 minutes)

2. **Conflict Resolution**
   - Last-write-wins for most data
   - Manual resolution for critical data

---

## 💡 Recommended Approach

### Use Local Database For:
- ✅ User profiles (read-heavy)
- ✅ Child profiles & instructions (read-heavy)
- ✅ Session history (cached, read-heavy)
- ✅ Verification requests (write-once, read-many)
- ✅ Reviews (write-once, read-many)
- ✅ Settings & preferences

### Use Firebase For:
- ✅ Active sessions (real-time status)
- ✅ GPS tracking during active sessions
- ✅ Chat messages (real-time)
- ✅ Alerts (real-time notifications)
- ✅ Push notifications
- ✅ Session requests (real-time for sitter)

---

## 🛠️ Technology Stack

### Local Database
- **expo-sqlite** - SQLite for React Native
- Lightweight, fast, reliable
- Perfect for structured data

### Firebase
- **Firestore** - For real-time collections only
- **Cloud Messaging** - Push notifications
- **Storage** - File uploads (documents, audio, images)

---

## 📋 Migration Strategy

### Step 1: Keep Current Firebase Structure
- Don't break existing code
- Gradually migrate to hybrid

### Step 2: Add Local Database
- Install SQLite
- Create schema
- Create local services

### Step 3: Dual Write
- Write to both local and Firebase
- Read from local first

### Step 4: Optimize
- Remove unnecessary Firebase reads
- Keep only real-time features in Firebase

---

## 💰 Cost Benefits

### Before (Firebase Only)
- Every read = $0.06 per 100k reads
- Every write = $0.18 per 100k writes
- Real-time listeners = continuous reads

### After (Hybrid)
- Local reads = FREE
- Firebase reads = Only for real-time features
- Estimated 80-90% cost reduction

---

## 🔒 Security Considerations

1. **Local Data Encryption**
   - Encrypt sensitive data in SQLite
   - Use expo-secure-store for keys

2. **Firebase Security Rules**
   - Still needed for real-time collections
   - Stricter rules (only active sessions)

3. **Data Validation**
   - Validate before local write
   - Validate before Firebase sync

---

## ✅ Advantages of Hybrid Approach

1. **Cost Effective**: 80-90% reduction in Firebase costs
2. **Offline First**: App works without internet
3. **Fast Performance**: Local reads are instant
4. **Better UX**: No loading spinners for cached data
5. **Privacy**: Sensitive data stays local
6. **Scalable**: Can handle large datasets locally

---

## ⚠️ Considerations

1. **Initial Setup**: More complex than Firebase-only
2. **Sync Logic**: Need to handle conflicts
3. **Storage**: SQLite database size (usually fine)
4. **Backup**: Need backup strategy for local data

---

## 🚀 Quick Start

1. **Install SQLite**
   ```bash
   npx expo install expo-sqlite
   ```

2. **Create Database Service**
   - See implementation example below

3. **Update Services**
   - Read from local first
   - Write to local
   - Sync to Firebase

This hybrid approach gives you the best of both worlds: fast local storage with real-time capabilities where needed!
