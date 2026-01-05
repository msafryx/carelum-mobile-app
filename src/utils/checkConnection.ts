/**
 * Connection Check Utilities
 * Validate Firebase and Local Database connections
 */
import { auth, firestore, isFirebaseConfigured } from '@/src/config/firebase';
import { getDatabase, select } from '@/src/services/local-db.service';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Check Firebase connection
 */
export async function checkFirebaseConnection(): Promise<{
  configured: boolean;
  firestore: boolean;
  auth: boolean;
  error?: string;
}> {
  const result = {
    configured: false,
    firestore: false,
    auth: false,
  };

  if (!isFirebaseConfigured()) {
    return {
      ...result,
      error: 'Firebase not configured. Check your .env file.',
    };
  }

  result.configured = true;

  // Test Firestore
  if (firestore) {
    try {
      const testRef = doc(firestore, '_test', 'connection');
      await getDoc(testRef);
      result.firestore = true;
    } catch (error: any) {
      return {
        ...result,
        error: `Firestore error: ${error.message}`,
      };
    }
  }

  // Test Auth
  if (auth) {
    result.auth = true;
  }

  return result;
}

/**
 * Check Local Database connection
 */
export async function checkLocalDatabase(): Promise<{
  initialized: boolean;
  working: boolean;
  error?: string;
}> {
  const db = getDatabase();
  
  if (!db) {
    return {
      initialized: false,
      working: false,
      error: 'Local database not initialized. Call initDatabase() first.',
    };
  }

  try {
    // Test query
    const result = await select('users', '1 = 1 LIMIT 1');
    
    return {
      initialized: true,
      working: result.success,
      error: result.success ? undefined : 'Database query failed',
    };
  } catch (error: any) {
    return {
      initialized: true,
      working: false,
      error: `Database error: ${error.message}`,
    };
  }
}

/**
 * Check sync status
 */
export async function checkSyncStatus(): Promise<{
  unsyncedSessions: number;
  status: 'synced' | 'pending' | 'error';
  error?: string;
}> {
  try {
    const result = await select('sessions', 'firebaseSynced = 0');
    
    if (!result.success) {
      return {
        unsyncedSessions: 0,
        status: 'error',
        error: 'Failed to check sync status',
      };
    }

    const unsynced = result.data?.length || 0;

    return {
      unsyncedSessions: unsynced,
      status: unsynced === 0 ? 'synced' : 'pending',
    };
  } catch (error: any) {
    return {
      unsyncedSessions: 0,
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Comprehensive connection check
 */
export async function checkAllConnections(): Promise<{
  firebase: Awaited<ReturnType<typeof checkFirebaseConnection>>;
  localDB: Awaited<ReturnType<typeof checkLocalDatabase>>;
  sync: Awaited<ReturnType<typeof checkSyncStatus>>;
}> {
  const [firebase, localDB, sync] = await Promise.all([
    checkFirebaseConnection(),
    checkLocalDatabase(),
    checkSyncStatus(),
  ]);

  return { firebase, localDB, sync };
}
