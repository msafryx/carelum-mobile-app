/**
 * Local Storage Inspection Utilities
 * Helper functions to check and inspect local storage data
 */
import { getAll, STORAGE_KEYS } from '@/src/services/local-storage.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get all data from local storage
 */
export async function inspectLocalStorage(): Promise<{
  [key: string]: any;
}> {
  const data: { [key: string]: any } = {};

  try {
    // Get all storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    
    // Filter for Carelum keys
    const carelumKeys = allKeys.filter(key => key.startsWith('@carelum:'));
    
    // Get all data
    for (const key of carelumKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }

    return data;
  } catch (error) {
    console.error('Error inspecting local storage:', error);
    return {};
  }
}

/**
 * Get count of items in each collection
 */
export async function getStorageStats(): Promise<{
  [collection: string]: number;
}> {
  const stats: { [collection: string]: number } = {};

  try {
    const collections = [
      { key: STORAGE_KEYS.USERS, name: 'Users' },
      { key: STORAGE_KEYS.CHILDREN, name: 'Children' },
      { key: STORAGE_KEYS.CHILD_INSTRUCTIONS, name: 'Child Instructions' },
      { key: STORAGE_KEYS.SESSIONS, name: 'Sessions' },
      { key: STORAGE_KEYS.VERIFICATION_REQUESTS, name: 'Verification Requests' },
      { key: STORAGE_KEYS.REVIEWS, name: 'Reviews' },
      { key: STORAGE_KEYS.ALERTS, name: 'Alerts' },
      { key: STORAGE_KEYS.CHAT_MESSAGES, name: 'Chat Messages' },
      { key: STORAGE_KEYS.GPS_TRACKING, name: 'GPS Tracking' },
    ];

    for (const collection of collections) {
      const result = await getAll(collection.key as any);
      if (result.success && result.data) {
        stats[collection.name] = result.data.length;
      } else {
        stats[collection.name] = 0;
      }
    }

    return stats;
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return {};
  }
}

/**
 * Clear all local storage data
 */
export async function clearAllLocalStorage(): Promise<boolean> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const carelumKeys = allKeys.filter(key => key.startsWith('@carelum:'));
    await AsyncStorage.multiRemove(carelumKeys);
    return true;
  } catch (error) {
    console.error('Error clearing local storage:', error);
    return false;
  }
}

/**
 * Export local storage data as JSON
 */
export async function exportLocalStorage(): Promise<string> {
  const data = await inspectLocalStorage();
  return JSON.stringify(data, null, 2);
}

/**
 * Print storage stats to console (for debugging)
 */
export async function printStorageStats(): Promise<void> {
  const stats = await getStorageStats();
  console.log('\n📊 Local Storage Statistics:');
  console.log('==============================');
  Object.entries(stats).forEach(([name, count]) => {
    console.log(`${name}: ${count} items`);
  });
  console.log('==============================\n');
}
