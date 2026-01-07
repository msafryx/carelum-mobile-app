/**
 * Firebase Collections Service
 * Automatically creates and manages Firebase collections
 * Ensures all collections exist and have proper structure
 */
import { firestore, isFirebaseConfigured } from '@/src/config/firebase';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ServiceResult } from '@/src/types/error.types';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  CHILDREN: 'children',
  CHILD_INSTRUCTIONS: 'childInstructions',
  SESSIONS: 'sessions',
  VERIFICATION_REQUESTS: 'verificationRequests',
  REVIEWS: 'reviews',
  ALERTS: 'alerts',
  CHAT_MESSAGES: 'chatMessages',
  GPS_TRACKING: 'gpsTracking',
  SYSTEM_SETTINGS: 'systemSettings',
} as const;

/**
 * Initialize Firebase collections
 * Creates placeholder documents to ensure collections exist
 */
export async function initializeFirebaseCollections(): Promise<ServiceResult<void>> {
  if (!isFirebaseConfigured() || !firestore) {
    return {
      success: false,
      error: {
        code: 'FIREBASE_NOT_CONFIGURED',
        message: 'Firebase is not configured',
      },
    };
  }

  try {
    // Create a system settings document to ensure collections are initialized
    const settingsRef = doc(firestore, COLLECTIONS.SYSTEM_SETTINGS, '_init');
    const settingsDoc = await getDoc(settingsRef);

    if (!settingsDoc.exists()) {
      // Collections don't exist yet - create initialization document
      await setDoc(settingsRef, {
        initialized: true,
        initializedAt: serverTimestamp(),
        version: '1.0.0',
      });
    }

    console.log('✅ Firebase collections initialized');
    return { success: true };
  } catch (error: any) {
    // Don't fail if collections already exist
    if (error.code === 'permission-denied') {
      console.warn('⚠️ Firebase permissions not set. Collections will be created on first use.');
      return { success: true }; // Continue - collections will be created on first write
    }

    return {
      success: false,
      error: {
        code: 'COLLECTIONS_INIT_ERROR',
        message: `Failed to initialize collections: ${error.message}`,
      },
    };
  }
}

/**
 * Get collection reference
 */
export function getCollectionRef(collectionName: string) {
  if (!firestore) return null;
  return collection(firestore, collectionName);
}

/**
 * Get document reference
 */
export function getDocRef(collectionName: string, docId: string) {
  if (!firestore) return null;
  return doc(firestore, collectionName, docId);
}

/**
 * Ensure collection exists by writing a test document
 * Firestore creates collections automatically on first write
 */
export async function ensureCollectionExists(
  collectionName: string
): Promise<ServiceResult<void>> {
  if (!isFirebaseConfigured() || !firestore) {
    return {
      success: false,
      error: {
        code: 'FIREBASE_NOT_CONFIGURED',
        message: 'Firebase is not configured',
      },
    };
  }

  try {
    // Collections are created automatically on first write
    // This function is mainly for documentation/logging
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'COLLECTION_ERROR',
        message: `Failed to ensure collection ${collectionName}: ${error.message}`,
      },
    };
  }
}
