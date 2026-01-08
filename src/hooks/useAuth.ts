/**
 * Authentication Hook - Supabase
 * Manages authentication state and user profile
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { getCurrentUserProfile } from '@/src/services/auth.service';
import { User } from '@/src/types/user.types';
import { useEffect, useState } from 'react';

interface AuthState {
  user: any | null; // Supabase User
  userProfile: User | null;
  loading: boolean;
  initialized: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userProfile: null,
    loading: true,
    initialized: false,
  });

  useEffect(() => {
    // If Supabase is not configured, mark as initialized without user
    if (!isSupabaseConfigured() || !supabase) {
      setAuthState({
        user: null,
        userProfile: null,
        loading: false,
        initialized: true,
      });
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setAuthState({
          user: null,
          userProfile: null,
          loading: false,
          initialized: true,
        });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        console.log('📥 Loading user profile for:', session.user.email);
        await loadUserProfile(session.user);
      } else {
        console.log('👤 No user session');
        setAuthState({
          user: null,
          userProfile: null,
          loading: false,
          initialized: true,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (user: any) => {
    try {
      console.log('🔍 Loading user profile...');
      
      // Get profile (will return minimal profile if fetch fails - instant UI)
      const result = await getCurrentUserProfile();
      
      if (result.success && result.data) {
        console.log('✅ User profile loaded:', result.data.email, result.data.role);
      } else {
        console.warn('⚠️ User profile load failed, using minimal profile');
      }
      
      // Always set state - getCurrentUserProfile now always returns a profile
      setAuthState({
        user,
        userProfile: result.success ? result.data || null : null,
        loading: false,
        initialized: true,
      });
    } catch (error) {
      console.error('❌ Failed to load user profile:', error);
      // Still set state - user is authenticated
      setAuthState({
        user,
        userProfile: null,
        loading: false,
        initialized: true,
      });
    }
  };

  const refreshProfile = async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await loadUserProfile(user);
    }
  };

  return {
    ...authState,
    isAuthenticated: !!authState.user,
    refreshProfile,
  };
}
