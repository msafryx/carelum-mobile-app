import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/src/config/firebase';
import { getCurrentUserProfile } from '@/src/services/auth.service';
import { User } from '@/src/types/user.types';
import { ServiceResult } from '@/src/types/error.types';

interface AuthState {
  user: FirebaseUser | null;
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
    // If Firebase is not configured, mark as initialized without user
    if (!isFirebaseConfigured() || !auth) {
      setAuthState({
        user: null,
        userProfile: null,
        loading: false,
        initialized: true,
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, fetch profile
        const result = await getCurrentUserProfile();
        setAuthState({
          user,
          userProfile: result.success ? result.data || null : null,
          loading: false,
          initialized: true,
        });
      } else {
        // User is signed out
        setAuthState({
          user: null,
          userProfile: null,
          loading: false,
          initialized: true,
        });
      }
    });

    return unsubscribe;
  }, []);

  return {
    ...authState,
    isAuthenticated: !!authState.user,
  };
}
