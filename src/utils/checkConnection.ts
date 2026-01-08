/**
 * Connection Check Utilities - Supabase
 * Validate Supabase connection
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';

/**
 * Check Supabase connection
 */
export async function checkSupabaseConnection(): Promise<{
  configured: boolean;
  database: boolean;
  auth: boolean;
  error?: string;
}> {
  const result = {
    configured: false,
    database: false,
    auth: false,
  };

  if (!isSupabaseConfigured()) {
    return {
      ...result,
      error: 'Supabase not configured. Check your .env file.',
    };
  }

  result.configured = true;

  // Test Database
  if (supabase) {
    try {
      // Simple query to test connection
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine for a connection test
        return {
          ...result,
          error: `Database error: ${error.message}`,
        };
      }
      result.database = true;
    } catch (error: any) {
      return {
        ...result,
        error: `Database error: ${error.message}`,
      };
    }
  }

  // Test Auth
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      result.auth = true;
    } catch (error: any) {
      return {
        ...result,
        error: `Auth error: ${error.message}`,
      };
    }
  }

  return result;
}

/**
 * Check Local Database connection (deprecated - using Supabase now)
 */
export async function checkLocalDatabase(): Promise<{
  initialized: boolean;
  working: boolean;
  error?: string;
}> {
  return {
    initialized: false,
    working: false,
    error: 'Local database is deprecated. Using Supabase instead.',
  };
}

/**
 * Check sync status (deprecated - Supabase handles real-time automatically)
 */
export async function checkSyncStatus(): Promise<{
  status: 'synced' | 'pending' | 'error';
  error?: string;
}> {
  return {
    status: 'synced',
  };
}

/**
 * Comprehensive connection check
 */
export async function checkAllConnections(): Promise<{
  supabase: Awaited<ReturnType<typeof checkSupabaseConnection>>;
}> {
  const supabaseCheck = await checkSupabaseConnection();

  return { supabase: supabaseCheck };
}

// Legacy Firebase function (for backward compatibility)
export async function checkFirebaseConnection(): Promise<{
  configured: boolean;
  firestore: boolean;
  auth: boolean;
  error?: string;
}> {
  return {
    configured: false,
    firestore: false,
    auth: false,
    error: 'Firebase is deprecated. Using Supabase instead.',
  };
}
