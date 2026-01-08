/**
 * Database Initialization Hook - Supabase
 * Initializes local storage on app start
 */
import { isSupabaseConfigured } from '@/src/config/supabase';
import { initLocalStorage } from '@/src/services/local-storage.service';
import { useEffect, useState } from 'react';

interface DatabaseInitState {
  localDbReady: boolean;
  supabaseConfigured: boolean;
  error: string | null;
}

export function useDatabaseInit() {
  const [state, setState] = useState<DatabaseInitState>({
    localDbReady: false,
    supabaseConfigured: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        // Check Supabase configuration
        const supabaseReady = isSupabaseConfigured();
        setState(prev => ({ ...prev, supabaseConfigured: supabaseReady }));

        if (!supabaseReady) {
          console.warn('⚠️ Supabase is not configured. Some features may not work.');
        } else {
          console.log('✅ Supabase is configured');
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
