# 🗄️ Complete Database Setup Guide

Complete guide to set up MySQL local database and sync server for inspecting app data.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install MySQL](#install-mysql)
3. [Create Database and Tables](#create-database-and-tables)
4. [Setup Sync Server](#setup-sync-server)
5. [Sync Data from App](#sync-data-from-app)
6. [Query Database](#query-database)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- MySQL installed (MySQL 8.0+ recommended)
- Node.js (v18 or higher)
- npm or yarn

---

## Install MySQL

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

### macOS

```bash
brew install mysql
brew services start mysql
```

### Windows

Download MySQL from https://dev.mysql.com/downloads/mysql/

### Verify Installation

```bash
mysql --version
```

---

## Create Database and Tables

### Step 1: Start MySQL (if not running)

```bash
# Check status
sudo systemctl status mysql

# Start if needed
sudo systemctl start mysql
```

### Step 2: Create Database and Tables

**Option A: With Password Prompt (Recommended)**

```bash
cd "/home/muhammed_safry/My Projects/Carelum/frontend"
mysql -u root -p < scripts/create-mysql-tables.sql
```

You'll be prompted to enter your MySQL root password.

**Option B: With Password in Command**

```bash
mysql -u root -pYOUR_PASSWORD < scripts/create-mysql-tables.sql
```

Replace `YOUR_PASSWORD` with your actual MySQL root password.

**Option C: Without Password (Ubuntu default with auth_socket)**

```bash
sudo mysql < scripts/create-mysql-tables.sql
```

**Option D: Using Setup Script**

```bash
bash scripts/setup-with-password.sh
```

Or with password as argument:

```bash
bash scripts/setup-with-password.sh your_password
```

### Step 3: Verify Tables

```bash
mysql -u root -p carelum_local -e "SHOW TABLES;"
```

You should see 9 tables:
- `users`
- `children`
- `child_instructions`
- `sessions`
- `verification_requests`
- `reviews`
- `alerts`
- `chat_messages`
- `gps_tracking`

---

## Setup Sync Server

### Step 1: Install Dependencies

```bash
cd "/home/muhammed_safry/My Projects/Carelum/frontend/scripts"
npm install
```

This installs:
- `express` - Web server
- `cors` - CORS middleware
- `mysql2` - MySQL client

### Step 2: Start Sync Server

**Option A: With Password Prompt**

```bash
bash scripts/start-sync-server.sh
```

Enter your MySQL password when prompted.

**Option B: With Password as Argument**

```bash
bash scripts/start-sync-server.sh your_password
```

**Option C: With Environment Variable**

```bash
cd scripts
DB_PASSWORD=your_password node db-sync-server.js
```

**Option D: Without Password**

```bash
cd scripts
node db-sync-server.js
```

### Step 3: Verify Server is Running

```bash
curl http://localhost:3001/health
```

Should return:
```json
{"status":"ok","database":"mysql"}
```

The server runs on `http://localhost:3001` and provides:
- `POST /sync` - Sync data from app
- `GET /query/:collection` - Query database
- `GET /health` - Health check

---

## Sync Data from App

### Why MySQL Might Be Empty?

MySQL is empty because **data sync is manual** - you need to:
1. ✅ Start the sync server (see Step 2 above)
2. ✅ Call `syncToLocalDB()` from your app
3. ✅ Data will then appear in MySQL

**Note**: Data must exist in AsyncStorage first. If you just registered, your user data is in Firebase. The app automatically syncs from Firebase to AsyncStorage when you log in, then you can sync to MySQL.

### In Your React Native App

**Option A: Automatic Sync (Already Implemented)**

The Parent Home screen automatically syncs when you open it. Just make sure you're logged in.

**Option B: Manual Sync**

```typescript
import { syncToLocalDB } from '@/src/services/db-sync-server.service';

// Sync all local storage data to MySQL
await syncToLocalDB();
```

This syncs all collections:
- Users
- Children
- Child Instructions
- Sessions
- Verification Requests
- Reviews
- Alerts
- Chat Messages
- GPS Tracking

**Option C: Sync Button**

A green sync button is available on the Parent Home screen. Tap it to manually sync.

### Sync Server URL

The sync server URL is configured in `src/services/db-sync-server.service.ts`:

```typescript
const SYNC_SERVER_URL = __DEV__ 
  ? 'http://localhost:3001'  // Development
  : 'http://your-server.com'; // Production
```

**Important**: For mobile devices, use your computer's local IP address instead of `localhost`:

```typescript
const SYNC_SERVER_URL = 'http://192.168.1.100:3001'; // Your computer's IP
```

Find your IP:
- Linux: `hostname -I`
- macOS: `ipconfig getifaddr en0`
- Windows: `ipconfig`

### Sync Flow

```
┌─────────────────┐
│  React Native   │
│      App        │
│                 │
│  AsyncStorage   │ ──┐
│  (Local Data)   │   │
└─────────────────┘   │
                      │
                      │ syncToLocalDB()
                      │
                      ▼
┌─────────────────┐
│  Sync Server    │
│  localhost:3001 │
│                 │
│  POST /sync     │ ──┐
└─────────────────┘   │
                      │
                      │ INSERT INTO
                      │
                      ▼
┌─────────────────┐
│     MySQL       │
│ carelum_local   │
│                 │
│  users table   │
│  sessions table │
│  etc.           │
└─────────────────┘
```

### Troubleshooting Sync

**"Total synced: 0 items"**

This means AsyncStorage is empty. To fix:
1. Make sure you're logged in
2. The app automatically syncs from Firebase to AsyncStorage when you log in
3. Check console logs: `📊 Users in AsyncStorage: 1`
4. Then sync to MySQL

**"Connection refused" error?**

- Sync server is not running
- Start it: `cd scripts && node db-sync-server.js`

**"Network request failed"?**

- For mobile devices, use your computer's IP instead of `localhost`
- Update `SYNC_SERVER_URL` in `db-sync-server.service.ts`

---

## Query Database

### From Terminal

```bash
# Connect to MySQL
mysql -u root -p carelum_local

# Or with password
mysql -u root -pYOUR_PASSWORD carelum_local
```

### Useful Queries

```sql
-- See all users
SELECT * FROM users;

-- Count users by role
SELECT role, COUNT(*) as count FROM users GROUP BY role;

-- See all sessions
SELECT * FROM sessions;

-- Count sessions by status
SELECT `status`, COUNT(*) as count FROM sessions GROUP BY `status`;

-- See recent sessions
SELECT * FROM sessions ORDER BY createdAt DESC LIMIT 10;

-- See children
SELECT * FROM children;

-- See chat messages
SELECT * FROM chat_messages ORDER BY createdAt DESC LIMIT 20;

-- Exit
exit;
```

### From HTTP API

```bash
# Get all users
curl http://localhost:3001/query/users

# Get all sessions
curl http://localhost:3001/query/sessions

# Get all children
curl http://localhost:3001/query/children
```

---

## Troubleshooting

### MySQL Connection Issues

**"Access denied for user 'root'@'localhost'"**

- Try with `sudo`: `sudo mysql`
- Or reset password (see below)
- Or use password: `mysql -u root -p`

**"Can't connect to local MySQL server"**

- Check MySQL is running: `sudo systemctl status mysql`
- Start MySQL: `sudo systemctl start mysql`
- Check socket: `ls -la /var/run/mysqld/mysqld.sock`

**Reset MySQL Root Password**

```bash
# Stop MySQL
sudo systemctl stop mysql

# Start in safe mode
sudo mysqld_safe --skip-grant-tables --skip-networking &

# Connect (no password)
mysql -u root

# In MySQL console:
USE mysql;
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'new_password';
FLUSH PRIVILEGES;
exit;

# Kill safe mode
sudo pkill mysqld

# Restart MySQL
sudo systemctl restart mysql
```

### SQL Syntax Errors

**"Error in your SQL syntax near 'read'"**

- Fixed in latest version - reserved keywords are now escaped with backticks
- Make sure you're using the updated `create-mysql-tables.sql`
- Reserved keywords that are escaped: `read`, `status`, `type`, `timestamp`

### Sync Server Issues

**"Error: Callback function is not available"**

- Fixed in latest version - make sure you're using the updated `db-sync-server.js`
- The server now uses async/await instead of callbacks

**"MySQL connection error"**

- Check MySQL is running
- Verify database exists: `mysql -u root -p -e "SHOW DATABASES;"`
- Check password is correct
- Set `DB_PASSWORD` environment variable if MySQL has a password

**"Table doesn't exist"**

- Run table creation script: `mysql -u root -p < scripts/create-mysql-tables.sql`
- Verify tables: `mysql -u root -p carelum_local -e "SHOW TABLES;"`

### App Sync Issues

**"Failed to sync" or network errors**

- Check sync server is running: `curl http://localhost:3001/health`
- For mobile devices, use your computer's IP instead of `localhost`
- Check firewall allows connections on port 3001
- Verify `SYNC_SERVER_URL` in `db-sync-server.service.ts` is correct

**"No data synced"**

- Check local storage has data: Use `LOCAL_DATABASE_GUIDE.md` to inspect AsyncStorage
- Verify sync server is receiving requests (check server logs)
- Check MySQL connection in sync server logs

---

## Quick Reference

### Start MySQL
```bash
sudo systemctl start mysql
```

### Create Database
```bash
mysql -u root -p < scripts/create-mysql-tables.sql
```

### Start Sync Server
```bash
cd scripts
DB_PASSWORD=your_password node db-sync-server.js
```

### Query Database
```bash
mysql -u root -p carelum_local
```

### Sync from App
```typescript
await syncToLocalDB();
```

### Health Check
```bash
curl http://localhost:3001/health
```

---

## Next Steps

1. ✅ Database is set up
2. ✅ Sync server is running
3. ✅ Sync data from app: `await syncToLocalDB()`
4. ✅ Query from terminal: `mysql -u root -p carelum_local`

**You can now inspect your database from terminal!** 🎉

---

## Related Documentation

- **[LOCAL_DATABASE_GUIDE.md](./LOCAL_DATABASE_GUIDE.md)** - How to check AsyncStorage (local storage)
- **[LOCAL_DB_SOLUTIONS.md](./LOCAL_DB_SOLUTIONS.md)** - Alternative solutions for database inspection
- **[APP_FEATURES_STATUS.md](./APP_FEATURES_STATUS.md)** - Complete app features and status
- **[README.md](./README.md)** - Project overview and quick start

---

## 📝 Changelog & Updates

### Latest Updates

1. **MySQL Database Setup**
   - Complete SQL schema with 9 tables
   - Fixed reserved keyword issues (`read`, `status`, `type`, `timestamp`)
   - Added password support for MySQL connections
   - Created automated setup scripts

2. **Sync Server**
   - Node.js sync server with async/await
   - Column name escaping for reserved keywords
   - Password support via environment variables
   - Automatic sync from Firebase to AsyncStorage on login

3. **Fixes Applied**
   - SQL syntax errors (reserved keywords)
   - Sync server callback issues (replaced with async/await)
   - MySQL connection methods (sudo, password, no password)
   - Auto-sync from Firebase to AsyncStorage
