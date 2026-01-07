# 🔍 How to Check Local Database (AsyncStorage)

Complete guide to inspect, debug, and manage your local storage data.

---

## 📋 Quick Methods

### Method 1: Using Console (Easiest)

Add this to any screen to check storage:

```typescript
import { printStorageStats, inspectLocalStorage } from '@/src/utils/checkLocalStorage';

// Print stats to console
await printStorageStats();

// Get all data
const allData = await inspectLocalStorage();
console.log('All Local Storage:', allData);
```

### Method 2: React Native Debugger

1. Open React Native Debugger
2. Go to AsyncStorage tab
3. Filter by `@carelum:`
4. View all stored data

### Method 3: Expo DevTools

1. Open Expo DevTools (usually at http://localhost:19002)
2. Check AsyncStorage section
3. View stored keys and values

---

## 🛠️ Available Functions

### Get Storage Statistics

```typescript
import { getStorageStats } from '@/src/utils/checkLocalStorage';

const stats = await getStorageStats();
console.log(stats);
// Output:
// {
//   Users: 5,
//   Children: 3,
//   Sessions: 12,
//   ...
// }
```

### Inspect All Data

```typescript
import { inspectLocalStorage } from '@/src/utils/checkLocalStorage';

const allData = await inspectLocalStorage();
console.log('All Storage:', allData);
```

### Export Data

```typescript
import { exportLocalStorage } from '@/src/utils/checkLocalStorage';

const jsonData = await exportLocalStorage();
console.log(jsonData); // JSON string
```

### Clear All Data

```typescript
import { clearAllLocalStorage } from '@/src/utils/checkLocalStorage';

const cleared = await clearAllLocalStorage();
if (cleared) {
  console.log('All local storage cleared');
}
```

---

## 📱 Using in Your App

### Add Debug Screen (Optional)

Create a debug screen to check storage:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Button } from 'react-native';
import { getStorageStats, inspectLocalStorage, clearAllLocalStorage } from '@/src/utils/checkLocalStorage';

export default function DebugScreen() {
  const [stats, setStats] = useState<any>({});
  const [data, setData] = useState<any>({});

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const storageStats = await getStorageStats();
    const allData = await inspectLocalStorage();
    setStats(storageStats);
    setData(allData);
  };

  const handleClear = async () => {
    await clearAllLocalStorage();
    await loadStats();
  };

  return (
    <ScrollView>
      <Text>Storage Statistics:</Text>
      {Object.entries(stats).map(([key, value]) => (
        <Text key={key}>{key}: {value}</Text>
      ))}
      
      <Button title="Refresh" onPress={loadStats} />
      <Button title="Clear All" onPress={handleClear} />
    </ScrollView>
  );
}
```

---

## 🔍 Check Specific Collections

### Using Storage Service

```typescript
import { getAll, getById, getWhere } from '@/src/services/local-storage.service';
import { STORAGE_KEYS } from '@/src/services/local-storage.service';

// Get all users
const users = await getAll(STORAGE_KEYS.USERS);
console.log('Users:', users.data);

// Get user by ID
const user = await getById(STORAGE_KEYS.USERS, 'user123');
console.log('User:', user.data);

// Get users by condition
const parents = await getWhere(STORAGE_KEYS.USERS, (user) => user.role === 'parent');
console.log('Parents:', parents.data);
```

---

## 📊 Storage Keys Reference

All data is stored with these keys:

- `@carelum:users` - User accounts
- `@carelum:children` - Child profiles
- `@carelum:child_instructions` - Care instructions
- `@carelum:sessions` - All sessions
- `@carelum:verification_requests` - Verification requests
- `@carelum:reviews` - Reviews
- `@carelum:alerts` - Alerts
- `@carelum:chat_messages` - Chat messages
- `@carelum:gps_tracking` - GPS tracking
- `@carelum:sync_status` - Sync status

---

## 🐛 Debugging Tips

### Check if Data Exists

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/src/services/local-storage.service';

const data = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
if (data) {
  console.log('Users exist:', JSON.parse(data));
} else {
  console.log('No users found');
}
```

### Check Storage Size

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const allKeys = await AsyncStorage.getAllKeys();
const carelumKeys = allKeys.filter(key => key.startsWith('@carelum:'));
console.log(`Total Carelum keys: ${carelumKeys.length}`);
```

### Monitor Changes

```typescript
// Add this to your app to monitor storage changes
import { useEffect } from 'react';
import { printStorageStats } from '@/src/utils/checkLocalStorage';

useEffect(() => {
  const interval = setInterval(() => {
    printStorageStats();
  }, 10000); // Every 10 seconds

  return () => clearInterval(interval);
}, []);
```

---

## ✅ Quick Check Commands

Add these to your code temporarily:

```typescript
// In any component
import { printStorageStats, inspectLocalStorage } from '@/src/utils/checkLocalStorage';

// On component mount or button press
await printStorageStats();
const allData = await inspectLocalStorage();
console.log('Full Storage:', JSON.stringify(allData, null, 2));
```

---

## 📝 Example: Check After User Registration

```typescript
import { save } from '@/src/services/local-storage.service';
import { STORAGE_KEYS } from '@/src/services/local-storage.service';
import { printStorageStats } from '@/src/utils/checkLocalStorage';

// After saving user
await save(STORAGE_KEYS.USERS, userData);

// Check storage
await printStorageStats();
// Should show: Users: 1
```

---

## 🎯 Common Use Cases

### 1. Verify Data is Saved

```typescript
const result = await save(STORAGE_KEYS.USERS, userData);
if (result.success) {
  const saved = await getById(STORAGE_KEYS.USERS, userData.id);
  console.log('Verified saved:', saved.data);
}
```

### 2. Count Items

```typescript
const stats = await getStorageStats();
console.log(`Total users: ${stats.Users}`);
console.log(`Total sessions: ${stats.Sessions}`);
```

### 3. Export for Backup

```typescript
const json = await exportLocalStorage();
// Save to file or send to server
```

---

**That's it!** Use these functions to check and debug your local storage anytime. 🎉
