# Professional Session & Profile Management

## Overview

The Carelum app now uses a professional session management system that ensures proper user session lifecycle, database synchronization, and profile management through the REST API.

## Architecture

### Session Manager Service

The `SessionManager` (`src/services/session-manager.service.ts`) is a singleton service that manages:

1. **Session Lifecycle**: Initialization, maintenance, and cleanup
2. **Profile Caching**: AsyncStorage for instant UI
3. **Database Sync**: Periodic and on-demand sync with REST API
4. **State Management**: Centralized session state

### Data Flow

```
User Login
  ↓
SessionManager.initializeSession()
  ↓
Load from AsyncStorage (instant UI)
  ↓
Sync from REST API (background)
  ↓
Update AsyncStorage cache
  ↓
Periodic sync every 5 minutes
```

## Key Features

### 1. Instant UI with Background Sync

- Profile loads instantly from AsyncStorage
- Background sync ensures data is up-to-date
- No blocking network calls during profile load

### 2. Professional Session Lifecycle

```typescript
// Initialize session on login
await sessionManager.initializeSession(userId);

// Get current profile (instant from cache)
const profile = sessionManager.getCurrentProfile();

// Update profile (syncs to database via API)
await sessionManager.updateProfile(updates);

// Force sync from API
await sessionManager.forceSync();

// Clear session on logout
sessionManager.clearSession();
```

### 3. Automatic Periodic Sync

- Syncs profile from API every 5 minutes
- Ensures data consistency
- Handles network failures gracefully

### 4. Database Synchronization

All profile updates go through the REST API:

```typescript
// Profile update flow:
updateUserProfile(updates)
  ↓
SessionManager.updateProfile()
  ↓
REST API: PUT /api/users/me
  ↓
Database updated
  ↓
AsyncStorage cache updated
  ↓
UI refreshed
```

## Implementation Details

### Session Manager Methods

#### `initializeSession(userId: string)`
- Loads profile from AsyncStorage (instant)
- Syncs from REST API in background
- Starts periodic sync
- Returns cached profile immediately

#### `syncProfileFromAPI(userId: string)`
- Fetches profile from REST API
- Updates AsyncStorage cache
- Handles retries (up to 3 attempts)
- Returns latest profile data

#### `updateProfile(updates: Partial<User>)`
- Updates profile via REST API
- Updates local state immediately
- Updates AsyncStorage cache
- Ensures database sync

#### `forceSync()`
- Forces immediate sync from API
- Useful for refresh actions
- Returns latest profile data

#### `clearSession()`
- Stops periodic sync
- Clears session state
- Called on logout

### Integration with useAuth Hook

The `useAuth` hook now uses SessionManager:

```typescript
// On auth state change
if (session?.user) {
  await sessionManager.initializeSession(user.id);
}

// Refresh profile
const refreshProfile = async () => {
  await sessionManager.forceSync();
};
```

### Profile Update Flow

1. **User updates profile** (e.g., changes name)
2. **`updateUserProfile()` called** (from profile screen)
3. **SessionManager.updateProfile()** called
4. **REST API: PUT /api/users/me** (database updated)
5. **AsyncStorage updated** (local cache)
6. **Session state updated** (UI refreshed)
7. **`refreshProfile()` called** (ensures consistency)

## Benefits

### 1. Professional Architecture
- Centralized session management
- Clear separation of concerns
- Singleton pattern for global state

### 2. Database Consistency
- All updates go through REST API
- Single source of truth (database)
- Automatic sync ensures consistency

### 3. Performance
- Instant UI from AsyncStorage
- Background sync doesn't block UI
- Periodic sync keeps data fresh

### 4. Reliability
- Retry logic for failed syncs
- Graceful error handling
- Fallback to cached data

### 5. User Experience
- No loading delays
- Always shows latest data
- Seamless updates

## Session State

The SessionManager maintains:

```typescript
{
  userId: string | null;
  userProfile: User | null;
  isAuthenticated: boolean;
  lastSyncTime: number | null;
  sessionStartTime: number | null;
}
```

## Sync Strategy

### Initial Load
1. Check AsyncStorage cache
2. Return cached data immediately
3. Sync from API in background
4. Update cache when sync completes

### Profile Update
1. Update via REST API
2. Update local state
3. Update AsyncStorage cache
4. Return updated profile

### Periodic Sync
- Every 5 minutes
- Background process
- Updates cache silently
- No UI disruption

## Error Handling

### Network Failures
- Retry up to 3 times
- Exponential backoff
- Falls back to cached data
- Logs errors for debugging

### API Errors
- Returns error in ServiceResult
- UI can handle errors gracefully
- Cached data remains available

## Best Practices

### 1. Always Use SessionManager
```typescript
// ✅ Good
const { sessionManager } = await import('./session-manager.service');
await sessionManager.updateProfile(updates);

// ❌ Bad
await supabase.from('users').update(...);
```

### 2. Use refreshProfile() After Updates
```typescript
await updateUserProfile(updates);
await refreshProfile(); // Ensures UI is updated
```

### 3. Clear Session on Logout
```typescript
await signOut(); // Already clears session
```

### 4. Handle Errors Gracefully
```typescript
const result = await updateUserProfile(updates);
if (!result.success) {
  Alert.alert('Error', result.error?.message);
}
```

## Migration Notes

### Before (Direct Supabase)
```typescript
// Direct Supabase call
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

### After (REST API via SessionManager)
```typescript
// Professional session management
const result = await sessionManager.syncProfileFromAPI(userId);
```

## Testing

### Manual Testing
1. Login as user
2. Check profile loads instantly
3. Update profile
4. Verify database is updated
5. Refresh app
5. Verify profile persists

### Automated Testing
- Test SessionManager methods
- Test sync retry logic
- Test error handling
- Test session cleanup

## Monitoring

### Logs to Watch
- `🔐 Initializing session for user:`
- `✅ Profile synced from API`
- `🔄 Periodic profile sync...`
- `🔓 Clearing session...`

### Metrics to Track
- Session initialization time
- Sync success rate
- API response times
- Cache hit rate

## Troubleshooting

### Profile Not Updating
1. Check API is running
2. Check authentication token
3. Check network connection
4. Check SessionManager state

### Sync Failures
1. Check API endpoint
2. Check authentication
3. Check error logs
4. Try force sync

### Stale Data
1. Call `forceSync()`
2. Check `lastSyncTime`
3. Verify periodic sync is running
4. Check network connectivity
