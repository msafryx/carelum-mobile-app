/**
 * Local Storage Service (AsyncStorage)
 * Works in Expo Go - stores data locally as JSON
 * Syncs with Firebase for real-time features
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServiceResult } from '@/src/types/error.types';

// Storage keys
const STORAGE_KEYS = {
  USERS: '@carelum:users',
  CHILDREN: '@carelum:children',
  CHILD_INSTRUCTIONS: '@carelum:child_instructions',
  SESSIONS: '@carelum:sessions',
  VERIFICATION_REQUESTS: '@carelum:verification_requests',
  REVIEWS: '@carelum:reviews',
  ALERTS: '@carelum:alerts',
  CHAT_MESSAGES: '@carelum:chat_messages',
  GPS_TRACKING: '@carelum:gps_tracking',
  SYNC_STATUS: '@carelum:sync_status',
} as const;

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Initialize local storage - creates default structure
 */
export async function initLocalStorage(): Promise<ServiceResult<void>> {
  try {
    // Initialize all collections with empty arrays if they don't exist
    const keys = Object.values(STORAGE_KEYS);
    
    for (const key of keys) {
      const existing = await AsyncStorage.getItem(key);
      if (!existing) {
        await AsyncStorage.setItem(key, JSON.stringify([]));
      }
    }

    // Initialize sync status
    const syncStatus = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
    if (!syncStatus) {
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify({
        lastSync: null,
        pendingSyncs: [],
        initialized: true,
      }));
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'STORAGE_INIT_ERROR',
        message: `Failed to initialize local storage: ${error.message}`,
      },
    };
  }
}

/**
 * Get all items from a collection
 */
export async function getAll<T>(collection: StorageKey): Promise<ServiceResult<T[]>> {
  try {
    const data = await AsyncStorage.getItem(collection);
    if (!data) {
      return { success: true, data: [] };
    }
    return { success: true, data: JSON.parse(data) as T[] };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'STORAGE_GET_ERROR',
        message: `Failed to get from ${collection}: ${error.message}`,
      },
    };
  }
}

/**
 * Get a single item by ID
 */
export async function getById<T extends { id: string }>(
  collection: StorageKey,
  id: string
): Promise<ServiceResult<T | null>> {
  try {
    const result = await getAll<T>(collection);
    if (!result.success) return result;

    const item = result.data?.find((item: T) => item.id === id) || null;
    return { success: true, data: item };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'STORAGE_GET_ERROR',
        message: `Failed to get item from ${collection}: ${error.message}`,
      },
    };
  }
}

/**
 * Get items by a condition
 */
export async function getWhere<T>(
  collection: StorageKey,
  predicate: (item: T) => boolean
): Promise<ServiceResult<T[]>> {
  try {
    const result = await getAll<T>(collection);
    if (!result.success) return result;

    const filtered = result.data?.filter(predicate) || [];
    return { success: true, data: filtered };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'STORAGE_QUERY_ERROR',
        message: `Failed to query ${collection}: ${error.message}`,
      },
    };
  }
}

/**
 * Insert or update an item
 */
export async function save<T extends { id: string }>(
  collection: StorageKey,
  item: T
): Promise<ServiceResult<T>> {
  try {
    const result = await getAll<T>(collection);
    if (!result.success) return result;

    const items = result.data || [];
    const index = items.findIndex((i: T) => i.id === item.id);

    if (index >= 0) {
      // Update existing
      items[index] = { ...items[index], ...item, updatedAt: Date.now() };
    } else {
      // Insert new
      items.push({ ...item, createdAt: Date.now(), updatedAt: Date.now() });
    }

    await AsyncStorage.setItem(collection, JSON.stringify(items));
    return { success: true, data: item };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'STORAGE_SAVE_ERROR',
        message: `Failed to save to ${collection}: ${error.message}`,
      },
    };
  }
}

/**
 * Save multiple items
 */
export async function saveMany<T extends { id: string }>(
  collection: StorageKey,
  items: T[]
): Promise<ServiceResult<T[]>> {
  try {
    const result = await getAll<T>(collection);
    if (!result.success) return result;

    const existing = result.data || [];
    const existingMap = new Map(existing.map((item: T) => [item.id, item]));

    // Merge with new items
    items.forEach(item => {
      const existingItem = existingMap.get(item.id);
      if (existingItem) {
        existingMap.set(item.id, { ...existingItem, ...item, updatedAt: Date.now() });
      } else {
        existingMap.set(item.id, { ...item, createdAt: Date.now(), updatedAt: Date.now() });
      }
    });

    const merged = Array.from(existingMap.values());
    await AsyncStorage.setItem(collection, JSON.stringify(merged));
    return { success: true, data: items };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'STORAGE_SAVE_ERROR',
        message: `Failed to save multiple items to ${collection}: ${error.message}`,
      },
    };
  }
}

/**
 * Delete an item
 */
export async function remove(
  collection: StorageKey,
  id: string
): Promise<ServiceResult<void>> {
  try {
    const result = await getAll<any>(collection);
    if (!result.success) return result;

    const items = result.data?.filter((item: any) => item.id !== id) || [];
    await AsyncStorage.setItem(collection, JSON.stringify(items));
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'STORAGE_DELETE_ERROR',
        message: `Failed to delete from ${collection}: ${error.message}`,
      },
    };
  }
}

/**
 * Clear a collection
 */
export async function clear(collection: StorageKey): Promise<ServiceResult<void>> {
  try {
    await AsyncStorage.setItem(collection, JSON.stringify([]));
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'STORAGE_CLEAR_ERROR',
        message: `Failed to clear ${collection}: ${error.message}`,
      },
    };
  }
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<ServiceResult<{
  lastSync: number | null;
  pendingSyncs: string[];
  initialized: boolean;
}>> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
    if (!data) {
      return {
        success: true,
        data: { lastSync: null, pendingSyncs: [], initialized: false },
      };
    }
    return { success: true, data: JSON.parse(data) };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SYNC_STATUS_ERROR',
        message: `Failed to get sync status: ${error.message}`,
      },
    };
  }
}

/**
 * Update sync status
 */
export async function updateSyncStatus(updates: {
  lastSync?: number | null;
  pendingSyncs?: string[];
}): Promise<ServiceResult<void>> {
  try {
    const current = await getSyncStatus();
    if (!current.success) return current;

    const updated = {
      ...current.data!,
      ...updates,
    };

    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(updated));
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SYNC_STATUS_ERROR',
        message: `Failed to update sync status: ${error.message}`,
      },
    };
  }
}

/**
 * Export storage keys for use in other services
 */
export { STORAGE_KEYS };
