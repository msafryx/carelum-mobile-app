# Database Guide - How It Works

## 🎯 Quick Overview

**Two Database Options:**
1. **Firebase Only** - All data in Firestore (simple, but costs more)
2. **Hybrid** - Local SQLite + Firebase for real-time (cost-effective, offline-first)

---

## 📊 Option 1: Firebase Only (Current Setup)

### How It Works
- All data stored in Firestore
- Real-time updates via listeners
- Works online only
- Higher costs at scale

### Collections Structure
```
users/              → User accounts
children/           → Child profiles
childInstructions/  → Care instructions
sessions/           → All sessions
alerts/             → Real-time alerts
chatMessages/       → Real-time messages
gpsTracking/        → Real-time location
```

### How to Use

#### 1. Initialize Firebase
```typescript
// Already done in src/config/firebase.ts
// Just add your credentials to .env
```

#### 2. Use Services
```typescript
import { createSessionRequest } from '@/src/services/session.service';
import { getParentChildren } from '@/src/services/child.service';

// Create session
const result = await createSessionRequest({
  parentId: 'user123',
  sitterId: 'sitter456',
  childId: 'child789',
  startTime: new Date(),
  status: 'requested',
  // ... other fields
});

// Get children
const children = await getParentChildren('user123');
```

#### 3. Real-time Listeners
```typescript
import { subscribeToSession } from '@/src/services/session.service';

// Listen to session updates
const unsubscribe = subscribeToSession('sessionId', (session) => {
  console.log('Session updated:', session);
});

// Cleanup
unsubscribe();
```

### Validate Connection
```typescript
import { firestore, auth, isFirebaseConfigured } from '@/src/config/firebase';

// Check if configured
if (isFirebaseConfigured()) {
  console.log('✅ Firebase connected');
} else {
  console.log('❌ Firebase not configured');
}

// Test connection
try {
  const testDoc = await getDoc(doc(firestore!, 'test', 'connection'));
  console.log('✅ Firestore accessible');
} catch (error) {
  console.log('❌ Firestore error:', error);
}
```

---

## 📊 Option 2: Hybrid (Local SQLite + Firebase)

### How It Works
- **Local SQLite**: Stores all data (users, children, sessions, etc.)
- **Firebase**: Only for real-time features (active sessions, GPS, chat, alerts)
- **Sync Service**: Keeps them in sync

### Architecture
```
┌─────────────────┐
│  Local SQLite   │  ← Primary storage (offline, fast, free)
│  - Users        │
│  - Children     │
│  - Sessions     │
│  - Instructions │
└────────┬────────┘
         │
         │ Sync Service
         │
┌────────▼────────┐
│    Firebase      │  ← Real-time only (active sessions, GPS, chat)
│  - Active sessions│
│  - GPS tracking  │
│  - Chat messages │
│  - Alerts        │
└─────────────────┘
```

### How to Use

#### 1. Initialize Local Database
```typescript
// In app/_layout.tsx or app/index.tsx
import { initDatabase } from '@/src/services/local-db.service';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Initialize SQLite on app start
    initDatabase().then(result => {
      if (result.success) {
        console.log('✅ Local database initialized');
      }
    });
  }, []);
  
  // ... rest of app
}
```

#### 2. Use Local Database
```typescript
import { insert, select, update, remove } from '@/src/services/local-db.service';

// Save to local DB
await insert('users', {
  id: 'user123',
  email: 'user@example.com',
  displayName: 'John Doe',
  role: 'parent',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Read from local DB
const result = await select('users', 'id = ?', ['user123']);

// Update
await update('users', 'user123', { displayName: 'Jane Doe' });

// Delete
await remove('users', 'user123');
```

#### 3. Sync to Firebase (for active sessions only)
```typescript
import { syncSessionToFirebase } from '@/src/services/sync.service';

// When session becomes active, sync to Firebase
await syncSessionToFirebase('sessionId');
```

#### 4. Real-time Updates from Firebase
```typescript
import { subscribeToActiveSession } from '@/src/services/sync.service';

// Listen to Firebase updates (updates local DB automatically)
const unsubscribe = subscribeToActiveSession('sessionId', (session) => {
  console.log('Session updated from Firebase:', session);
  // Local DB is automatically updated
});
```

### Data Flow Example

```typescript
// 1. Create session locally
await insert('sessions', {
  id: 'session123',
  parentId: 'parent1',
  sitterId: 'sitter1',
  status: 'requested',
  // ...
});

// 2. When sitter accepts, update locally
await update('sessions', 'session123', { status: 'accepted' });

// 3. When session starts, sync to Firebase for real-time
await update('sessions', 'session123', { status: 'active' });
await syncSessionToFirebase('session123');

// 4. Subscribe to real-time updates
subscribeToActiveSession('session123', (session) => {
  // Updates automatically saved to local DB
  console.log('Real-time update:', session);
});

// 5. When session ends, remove from Firebase (keep in local)
await update('sessions', 'session123', { status: 'completed' });
// Firebase sync will stop automatically
```

---

## 🔍 How to Validate & Check

### Check Firebase Connection
```typescript
// src/utils/checkConnection.ts
import { firestore, auth, isFirebaseConfigured } from '@/src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function checkFirebaseConnection(): Promise<boolean> {
  if (!isFirebaseConfigured()) {
    console.log('❌ Firebase not configured');
    return false;
  }

  try {
    // Test Firestore
    if (firestore) {
      const testRef = doc(firestore, '_test', 'connection');
      await getDoc(testRef);
      console.log('✅ Firestore connected');
    }

    // Test Auth
    if (auth) {
      console.log('✅ Auth initialized');
    }

    return true;
  } catch (error) {
    console.log('❌ Firebase connection failed:', error);
    return false;
  }
}
```

### Check Local Database
```typescript
// src/utils/checkLocalDB.ts
import { getDatabase, select } from '@/src/services/local-db.service';

export async function checkLocalDatabase(): Promise<boolean> {
  try {
    const db = getDatabase();
    if (!db) {
      console.log('❌ Local database not initialized');
      return false;
    }

    // Test query
    const result = await select('users', '1 = 1 LIMIT 1');
    if (result.success) {
      console.log('✅ Local database working');
      return true;
    }

    return false;
  } catch (error) {
    console.log('❌ Local database error:', error);
    return false;
  }
}
```

### Check Sync Status
```typescript
// src/utils/checkSync.ts
import { select } from '@/src/services/local-db.service';

export async function checkSyncStatus(): Promise<void> {
  // Check unsynced sessions
  const result = await select('sessions', 'firebaseSynced = 0');
  
  if (result.success && result.data) {
    console.log(`📊 Unsynced sessions: ${result.data.length}`);
    
    if (result.data.length > 0) {
      console.log('⚠️ Some sessions need syncing');
    } else {
      console.log('✅ All sessions synced');
    }
  }
}
```

---

## 🔌 How to Connect

### Step 1: Firebase Setup

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create new project
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Enable Storage

2. **Get Credentials**
   ```bash
   # Add to .env file
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

3. **Verify Connection**
   ```typescript
   import { checkFirebaseConnection } from '@/src/utils/checkConnection';
   
   useEffect(() => {
     checkFirebaseConnection();
   }, []);
   ```

### Step 2: Local Database Setup (Hybrid Only)

1. **Initialize on App Start**
   ```typescript
   // app/_layout.tsx
   import { initDatabase } from '@/src/services/local-db.service';
   
   useEffect(() => {
     initDatabase();
   }, []);
   ```

2. **Verify Setup**
   ```typescript
   import { checkLocalDatabase } from '@/src/utils/checkLocalDB';
   
   useEffect(() => {
     checkLocalDatabase();
   }, []);
   ```

### Step 3: Choose Your Approach

**Firebase Only:**
- Use services directly (already set up)
- All data goes to Firestore
- Real-time listeners work automatically

**Hybrid:**
- Initialize local DB first
- Use local DB for reads/writes
- Sync active sessions to Firebase
- Use Firebase listeners for real-time updates

---

## 📝 Quick Reference

### Firebase Only
```typescript
// Read
const result = await getSessionById('session123');

// Write
await createSessionRequest(sessionData);

// Real-time
subscribeToSession('session123', callback);
```

### Hybrid
```typescript
// Read (from local)
const result = await select('sessions', 'id = ?', ['session123']);

// Write (to local)
await insert('sessions', sessionData);

// Sync to Firebase (for active sessions)
await syncSessionToFirebase('session123');

// Real-time (from Firebase, updates local)
subscribeToActiveSession('session123', callback);
```

---

## ⚠️ Important Notes

1. **Firebase Only**: Simple, but costs increase with usage
2. **Hybrid**: More setup, but 80-90% cost reduction
3. **Always validate** connections before using
4. **Sync only active sessions** to Firebase in hybrid mode
5. **Local DB is primary** in hybrid mode - Firebase is just for real-time

---

## 🚀 Recommended Approach

**Start with Firebase Only** for development, then **migrate to Hybrid** when you need:
- Offline support
- Cost optimization
- Better performance
- Large datasets

The services are already set up to support both approaches!
