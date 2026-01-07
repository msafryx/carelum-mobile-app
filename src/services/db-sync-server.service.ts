/**
 * Database Sync Server Service
 * Syncs AsyncStorage data to local MySQL/MongoDB server for inspection
 * 
 * Usage:
 * 1. Set up local MySQL/MongoDB server
 * 2. Run sync server: cd scripts && npm install && npm start
 * 3. Call syncToLocalDB() from your app
 * 4. Query database from terminal: mysql -u root -p carelum_local
 */

import { ServiceResult } from '@/src/types/error.types';
import { getAll, STORAGE_KEYS } from './local-storage.service';

// Change this to your local server URL
const SYNC_SERVER_URL = __DEV__ 
  ? 'http://localhost:3001'  // Development
  : 'http://your-server.com'; // Production (if needed)

/**
 * Sync all local storage data to local database server
 */
export async function syncToLocalDB(): Promise<ServiceResult<void>> {
  try {
    const collections = [
      { key: STORAGE_KEYS.USERS, name: 'users' },
      { key: STORAGE_KEYS.CHILDREN, name: 'children' },
      { key: STORAGE_KEYS.CHILD_INSTRUCTIONS, name: 'child_instructions' },
      { key: STORAGE_KEYS.SESSIONS, name: 'sessions' },
      { key: STORAGE_KEYS.VERIFICATION_REQUESTS, name: 'verification_requests' },
      { key: STORAGE_KEYS.REVIEWS, name: 'reviews' },
      { key: STORAGE_KEYS.ALERTS, name: 'alerts' },
      { key: STORAGE_KEYS.CHAT_MESSAGES, name: 'chat_messages' },
      { key: STORAGE_KEYS.GPS_TRACKING, name: 'gps_tracking' },
    ];

    let totalSynced = 0;

    for (const collection of collections) {
      const result = await getAll(collection.key as any);
      
      if (result.success && result.data && result.data.length > 0) {
        try {
          const response = await fetch(`${SYNC_SERVER_URL}/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              collection: collection.name,
              data: result.data,
            }),
          });

          const syncResult = await response.json();
          
          if (syncResult.success) {
            totalSynced += syncResult.synced || 0;
            console.log(`✅ Synced ${collection.name}: ${syncResult.synced} items`);
          } else {
            console.warn(`⚠️ Failed to sync ${collection.name}:`, syncResult.error);
          }
        } catch (error: any) {
          console.warn(`⚠️ Sync error for ${collection.name}:`, error.message);
          // Continue with other collections
        }
      }
    }

    console.log(`✅ Total synced: ${totalSynced} items`);
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SYNC_SERVER_ERROR',
        message: `Failed to sync to local database: ${error.message}`,
      },
    };
  }
}

/**
 * Query local database server
 */
export async function queryLocalDB(
  collection: string
): Promise<ServiceResult<any[]>> {
  try {
    const response = await fetch(`${SYNC_SERVER_URL}/query/${collection}`);
    const data = await response.json();
    
    if (data.error) {
      return {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: data.error,
        },
      };
    }

    return { success: true, data };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'QUERY_ERROR',
        message: `Failed to query local database: ${error.message}`,
      },
    };
  }
}

/**
 * Check if sync server is running
 */
export async function checkSyncServer(): Promise<boolean> {
  try {
    const response = await fetch(`${SYNC_SERVER_URL}/query/users`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}
