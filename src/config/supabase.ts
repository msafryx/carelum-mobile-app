import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Supabase configuration from environment variables
const supabaseUrl = 
  Constants.expoConfig?.extra?.supabaseUrl || 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  Constants.expoConfig?.extra?.supabaseAnonKey || 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  '';

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl &&
    supabaseUrl !== '' &&
    supabaseUrl !== 'YOUR_SUPABASE_URL' &&
    supabaseAnonKey &&
    supabaseAnonKey !== '' &&
    supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY'
  );
};

// Initialize Supabase client
let supabase: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        // Ensure fetch is available for Storage API
        fetch: global.fetch,
      },
    });
    console.log('✅ Supabase initialized successfully');
    console.log(`🔗 Supabase URL: ${supabaseUrl.substring(0, 40)}...`);
  } catch (error) {
    console.error('❌ Supabase initialization error:', error);
    console.warn('⚠️ Supabase is not configured. Please update src/config/supabase.ts with your Supabase credentials.');
  }
} else {
  console.warn('⚠️ Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export { supabase, supabaseUrl, supabaseAnonKey };
export default supabase;
