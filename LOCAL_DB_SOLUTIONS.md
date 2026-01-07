# 🗄️ Local Database Solutions - MySQL/MongoDB Alternatives

## Why Not MySQL/MongoDB Directly?

**MySQL and MongoDB are server-side databases**, not mobile databases. Here's why:

- ❌ **Mobile apps run on devices** - Not servers
- ❌ **No direct database connection** - Mobile apps can't directly connect to MySQL/MongoDB
- ❌ **Network required** - Would need constant internet connection
- ❌ **Security issues** - Exposing database credentials in mobile app is dangerous

## ✅ Better Solutions

### Option 1: Local Server Proxy (Recommended for Inspection)

**Create a local server that syncs AsyncStorage to MySQL/MongoDB for easy inspection.**

This gives you:
- ✅ Real database (MySQL/MongoDB) you can query
- ✅ Easy terminal/console access
- ✅ SQL queries, MongoDB queries
- ✅ Database tools (phpMyAdmin, MongoDB Compass)

---

## 🚀 Solution: Local Database Proxy Server

### Setup Local MySQL/MongoDB Server

#### For MySQL:

1. **Install MySQL locally:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mysql-server
   
   # macOS
   brew install mysql
   
   # Start MySQL
   sudo systemctl start mysql  # Linux
   brew services start mysql   # macOS
   ```

2. **Create database:**
   ```bash
   mysql -u root -p
   CREATE DATABASE carelum_local;
   USE carelum_local;
   ```

3. **Create tables:**
   ```sql
   CREATE TABLE users (
     id VARCHAR(255) PRIMARY KEY,
     email VARCHAR(255) UNIQUE,
     displayName VARCHAR(255),
     role VARCHAR(50),
     createdAt BIGINT,
     updatedAt BIGINT
   );
   
   CREATE TABLE children (
     id VARCHAR(255) PRIMARY KEY,
     parentId VARCHAR(255),
     name VARCHAR(255),
     age INT,
     createdAt BIGINT,
     updatedAt BIGINT
   );
   
   CREATE TABLE sessions (
     id VARCHAR(255) PRIMARY KEY,
     parentId VARCHAR(255),
     sitterId VARCHAR(255),
     status VARCHAR(50),
     createdAt BIGINT,
     updatedAt BIGINT
   );
   ```

#### For MongoDB:

1. **Install MongoDB:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb
   
   # macOS
   brew install mongodb-community
   
   # Start MongoDB
   sudo systemctl start mongod  # Linux
   brew services start mongodb-community  # macOS
   ```

2. **Connect:**
   ```bash
   mongosh
   use carelum_local
   ```

---

### Create Sync Server

Create a Node.js server that syncs AsyncStorage data to your local database.

**File: `scripts/sync-to-db-server.js`**

```javascript
const express = require('express');
const mysql = require('mysql2/promise'); // or use mongodb driver
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'carelum_local'
});

// Endpoint to receive data from app
app.post('/sync', async (req, res) => {
  const { collection, data } = req.body;
  
  try {
    // Insert or update data
    for (const item of data) {
      await db.query(
        `INSERT INTO ${collection} SET ? ON DUPLICATE KEY UPDATE ?`,
        [item, item]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Sync server running on http://localhost:3001');
});
```

---

### Sync from App to Server

**File: `src/services/db-sync-server.service.ts`**

```typescript
/**
 * Sync AsyncStorage data to local MySQL/MongoDB server
 * For development/inspection purposes
 */
import { getAll, STORAGE_KEYS } from './local-storage.service';

const SYNC_SERVER_URL = 'http://localhost:3001'; // Your local server

export async function syncToLocalDB(): Promise<void> {
  try {
    // Get all collections
    const collections = [
      { key: STORAGE_KEYS.USERS, name: 'users' },
      { key: STORAGE_KEYS.CHILDREN, name: 'children' },
      { key: STORAGE_KEYS.SESSIONS, name: 'sessions' },
      // Add more...
    ];

    for (const collection of collections) {
      const result = await getAll(collection.key as any);
      if (result.success && result.data) {
        // Send to local server
        await fetch(`${SYNC_SERVER_URL}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collection: collection.name,
            data: result.data,
          }),
        });
      }
    }

    console.log('✅ Synced to local database');
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}
```

---

## 🔍 Option 2: Better SQLite Inspection (Works in Dev Build)

If you create a development build, SQLite works and you can inspect it:

### Install SQLite Browser

```bash
# Ubuntu/Debian
sudo apt-get install sqlitebrowser

# macOS
brew install --cask db-browser-for-sqlite
```

### Access Database File

The database file is located at:
- **Android**: `/data/data/com.yourapp/databases/carelum.db`
- **iOS**: In app's Documents directory

### Query from Terminal

```bash
# Connect to database
sqlite3 carelum.db

# Query
SELECT * FROM users;
SELECT COUNT(*) FROM sessions;
```

---

## 🔍 Option 3: Enhanced AsyncStorage Inspection

We already created utilities, but here's a better terminal-friendly version:

**File: `scripts/inspect-storage.js`**

```javascript
// Run this script to inspect AsyncStorage
// Note: This requires the app to export data

// In your app, add this endpoint or function:
// export async function exportStorage() {
//   const data = await inspectLocalStorage();
//   return data;
// }

// Then run:
// node scripts/inspect-storage.js
```

---

## 🎯 Recommended Approach

### For Development/Inspection:

1. **Set up local MySQL/MongoDB server**
2. **Create sync server** (Node.js)
3. **Sync from app** when needed
4. **Query database** from terminal

### For Production:

- Use AsyncStorage (already set up)
- Sync to Firebase (already set up)
- No local MySQL/MongoDB needed

---

## 📝 Quick Setup Script

I can create a complete setup script that:
1. Sets up local MySQL/MongoDB
2. Creates sync server
3. Adds sync function to app
4. Provides query utilities

Would you like me to create this?

---

## 🔧 Alternative: Use WatermelonDB

**WatermelonDB** is a better local database for React Native:
- ✅ SQL-like queries
- ✅ Better performance
- ✅ Observable queries
- ✅ Can export to SQLite file for inspection

But it also requires a development build.

---

## 💡 Best Solution for Your Needs

**For easy terminal/console inspection:**

1. **Keep AsyncStorage** (works everywhere)
2. **Add local MySQL/MongoDB sync** (for inspection)
3. **Create sync script** (syncs when you run it)
4. **Query from terminal** (mysql/mongosh commands)

This gives you:
- ✅ Works in Expo Go (AsyncStorage)
- ✅ Easy inspection (MySQL/MongoDB)
- ✅ Terminal access
- ✅ Database tools

Would you like me to create the complete setup?
