/**
 * Database Initialization Hook
 * Initializes local storage and sync service on app start
 */
import { isFirebaseConfigured } from '@/src/config/firebase';
import { initializeFirebaseCollections } from '@/src/services/firebase-collections.service';
import { initLocalStorage } from '@/src/services/local-storage.service';
import { initializeStorageSync } from '@/src/services/storage-sync.service';
import { useEffect, useState } from 'react';

interface DatabaseInitState {
  localDbReady: boolean;
  syncReady: boolean;
  firebaseConfigured: boolean;
  error: string | null;
}

export function useDatabaseInit() {
  const [state, setState] = useState<DatabaseInitState>({
    localDbReady: false,
    syncReady: false,
    firebaseConfigured: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        // Check Firebase configuration
        const firebaseReady = isFirebaseConfigured();
        setState(prev => ({ ...prev, firebaseConfigured: firebaseReady }));

        if (!firebaseReady) {
          console.warn('⚠️ Firebase is not configured. Some features may not work.');
        } else {
          console.log('✅ Firebase is configured');
        }

        // Initialize local storage (AsyncStorage - works everywhere)
        const storageResult = await initLocalStorage();
        if (!mounted) return;

        if (storageResult.success) {
          console.log('✅ Local storage initialized');
          setState(prev => ({ ...prev, localDbReady: true }));
        } else {
          console.error('❌ Failed to initialize local storage:', storageResult.error?.message);
          setState(prev => ({
            ...prev,
            error: storageResult.error?.message || 'Storage initialization failed',
          }));
        }

        // Initialize Firebase collections (only if Firebase is configured)
        if (firebaseReady) {
          const collectionsResult = await initializeFirebaseCollections();
          if (!mounted) return;

          if (collectionsResult.success) {
            console.log('✅ Firebase collections initialized');
          } else {
            console.warn('⚠️ Firebase collections initialization failed:', collectionsResult.error?.message);
            // Don't fail - collections are created on first write
          }

          // Initialize sync service
          const syncResult = await initializeStorageSync();
          if (!mounted) return;

          if (syncResult.success) {
            console.log('✅ Sync service initialized');
            setState(prev => ({ ...prev, syncReady: true }));
          } else {
            console.warn('⚠️ Sync service initialization failed:', syncResult.error?.message);
            // Don't set error - sync is optional
          }
        }
      } catch (error: any) {
        if (!mounted) return;
        console.error('❌ Database initialization error:', error);
        setState(prev => ({
          ...prev,
          error: error.message || 'Unknown initialization error',
        }));
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
