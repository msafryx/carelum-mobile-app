/**
 * Authentication Service - Supabase
 * Handles user authentication and profile management
 */
import { Language, LANGUAGES, UserRole } from '@/src/config/constants';
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { User } from '@/src/types/user.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  preferredLanguage?: Language;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user
 */
export async function signUp(data: SignUpData): Promise<ServiceResult<any>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'Supabase is not configured',
        },
      };
    }

    // Create auth user
    // Note: Supabase requires email confirmation by default
    // To disable: Supabase Dashboard → Authentication → Settings → Disable "Enable email confirmations"
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: undefined, // Optional: set redirect URL after email confirmation
      },
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        return {
          success: false,
          error: {
            code: ErrorCode.EMAIL_ALREADY_EXISTS,
            message: 'An account with this email already exists. Please sign in instead.',
          },
        };
      }
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: authError.message,
        },
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'Failed to create user',
        },
      };
    }

    // Generate user number (use local fallback to avoid RLS recursion during sign-up)
    // During sign-up, we can't query users table due to RLS, so use local generation
    const userNumber = await (await import('./user-number.service')).getNextUserNumberFromLocal(data.role);

    // Normalize role: 'babysitter' -> 'sitter' for database compatibility
    const dbRole = data.role === 'babysitter' ? 'sitter' : data.role;

    // ============================================
    // FIREBASE/MYSQL PATTERN: AsyncStorage FIRST
    // ============================================
    // Save to AsyncStorage IMMEDIATELY for instant UI (PRIMARY data source)
    // This is the PRIMARY data source - instant, no network delays
    const { save, STORAGE_KEYS } = await import('./local-storage.service');
    const userData = {
      id: authData.user.id,
      userNumber: userNumber,
      email: data.email,
      displayName: data.displayName,
      role: data.role, // Keep original role (babysitter, not sitter)
      preferredLanguage: data.preferredLanguage || LANGUAGES.ENGLISH,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      phoneNumber: null,
      profileImageUrl: null,
      theme: 'auto',
      isVerified: false,
      verificationStatus: null,
      hourlyRate: null,
      bio: null,
    };
    
    // Save IMMEDIATELY - don't wait (non-blocking)
    save(STORAGE_KEYS.USERS, userData).catch(err => {
      console.warn('⚠️ AsyncStorage save failed (non-blocking):', err);
    });
    console.log('✅ User profile saved to AsyncStorage (instant UI)');

    // Return success IMMEDIATELY - don't wait for Supabase
    // Profile creation happens in BACKGROUND (IIFE - runs async, doesn't block)
    
    // ============================================
    // BACKGROUND SYNC: Supabase SECONDARY
    // ============================================
    // Create profile in Supabase in BACKGROUND (IIFE - runs async, never blocks)
    (async () => {
      try {
        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('users')
          .select('id')
          .eq('id', authData.user!.id)
          .single();
        
        if (existingProfile) {
          console.log('✅ User profile already exists in Supabase');
          return;
        }

        // Try to create profile (non-blocking, errors are non-critical)
        const { error: rpcError } = await supabase.rpc('create_user_profile', {
          p_id: authData.user!.id,
          p_email: data.email,
          p_display_name: data.displayName,
          p_role: dbRole,
          p_preferred_language: data.preferredLanguage || LANGUAGES.ENGLISH,
          p_user_number: userNumber,
          p_phone_number: null,
          p_photo_url: null,
          p_theme: 'auto',
          p_is_verified: false,
          p_verification_status: null,
          p_hourly_rate: null,
          p_bio: null,
        });

        if (rpcError) {
          // Try upsert as fallback (non-blocking)
          Promise.resolve(supabase
            .from('users')
            .upsert({
              id: authData.user!.id,
              email: data.email,
              display_name: data.displayName,
              role: dbRole,
              preferred_language: data.preferredLanguage || LANGUAGES.ENGLISH,
              user_number: userNumber,
              phone_number: null,
              photo_url: null,
              theme: 'auto',
              is_verified: false,
              verification_status: null,
              hourly_rate: null,
              bio: null,
            }, { onConflict: 'id' }))
            .then(() => {
              console.log('✅ Profile created in Supabase (background)');
            })
            .catch((err: any) => {
              // Ignore errors - profile will sync later via useRealtimeSync
              console.warn('⚠️ Background profile creation failed (non-critical):', err.message);
            });
        } else {
          console.log('✅ Profile created in Supabase (background)');
        }
      } catch (error) {
        // Ignore all errors - profile will sync later via useRealtimeSync
        console.warn('⚠️ Background profile sync failed (non-critical):', error);
      }
    })(); // IIFE - runs in background, doesn't block

    // Return success IMMEDIATELY - AsyncStorage has the data, UI can update instantly
    return { success: true, data: authData.user };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Sign in existing user
 */
export async function signIn(
  data: SignInData
): Promise<ServiceResult<any>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'Supabase is not configured',
        },
      };
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      // Check for email confirmation error
      if (authError.message.includes('Email not confirmed') || authError.message.includes('email not confirmed')) {
        return {
          success: false,
          error: {
            code: ErrorCode.AUTH_ERROR,
            message: 'Please check your email and confirm your account before signing in. If you didn\'t receive the email, check your spam folder or contact support.',
          },
        };
      }
      if (authError.message.includes('Invalid login credentials') || authError.message.includes('wrong password')) {
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_PASSWORD,
            message: 'Invalid email or password',
          },
        };
      }
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: authError.message,
        },
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'Failed to sign in',
        },
      };
    }

    // Check if email is confirmed
    if (!authData.user.email_confirmed_at) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'Please confirm your email address before signing in. Check your inbox for the confirmation email.',
        },
      };
    }

    return { success: true, data: authData.user };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<ServiceResult<void>> {
  try {
    // Clear AsyncStorage FIRST (local data)
    try {
      const { clear, STORAGE_KEYS } = await import('./local-storage.service');
      await clear(STORAGE_KEYS.USERS);
      await clear(STORAGE_KEYS.CHILDREN);
      console.log('✅ Cleared AsyncStorage');
    } catch (clearError: any) {
      console.warn('⚠️ Failed to clear AsyncStorage:', clearError.message);
      // Continue anyway - Supabase signOut is more important
    }

    // Sign out from Supabase
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return {
          success: false,
          error: {
            code: ErrorCode.AUTH_ERROR,
            message: error.message,
          },
        };
      }
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get current user profile - AsyncStorage FIRST (Firebase/MySQL pattern)
 */
export async function getCurrentUserProfile(): Promise<ServiceResult<User>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'Supabase is not configured',
        },
      };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'No user is currently signed in',
        },
      };
    }

    // ============================================
    // FIREBASE/MYSQL PATTERN: AsyncStorage FIRST
    // ============================================
    // Try AsyncStorage FIRST - instant, no network delays
    try {
      const { getAll, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getAll(STORAGE_KEYS.USERS);
      if (result.success && result.data) {
        const localUser = result.data.find((u: any) => u.id === user.id) as any;
        if (localUser) {
          // Normalize role: 'sitter' -> 'babysitter' for app compatibility
          const appRole = localUser.role === 'sitter' ? 'babysitter' : localUser.role;
          const userProfile: User = {
            ...localUser,
            role: appRole as any,
            createdAt: new Date(localUser.createdAt || Date.now()),
            updatedAt: localUser.updatedAt ? new Date(localUser.updatedAt) : new Date(),
          };
          console.log('✅ User profile loaded from AsyncStorage (instant)', userProfile.role);
          
          // Sync from Supabase in BACKGROUND (non-blocking, don't wait)
          syncProfileFromSupabase(user.id).catch(() => {});
          
          // Return IMMEDIATELY - don't wait for Supabase
          return { success: true, data: userProfile };
        }
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to load from AsyncStorage:', localError.message);
    }
    
    // If not in AsyncStorage, create minimal profile from auth user (instant)
    // Don't wait for Supabase - return immediately
    console.log('⚠️ Profile not in AsyncStorage, creating minimal profile (instant)');
    // Normalize role: 'sitter' -> 'babysitter' for app compatibility
    const rawRole = user.user_metadata?.role || 'parent';
    const appRole = rawRole === 'sitter' ? 'babysitter' : rawRole;
    const minimalProfile: User = {
      id: user.id,
      email: user.email || '',
      displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
      role: appRole as any, // Normalized role
      preferredLanguage: 'en',
      userNumber: undefined,
      phoneNumber: undefined,
      profileImageUrl: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      theme: 'auto',
      isVerified: false,
      verificationStatus: undefined,
      hourlyRate: undefined,
      bio: undefined,
    };
    
    // Save minimal profile to AsyncStorage (non-blocking)
    try {
      const { save, STORAGE_KEYS } = await import('./local-storage.service');
      save(STORAGE_KEYS.USERS, {
        ...minimalProfile,
        createdAt: minimalProfile.createdAt.getTime(),
        updatedAt: (minimalProfile.updatedAt || new Date()).getTime(),
      }).catch(() => {});
    } catch (saveError) {
      // Ignore save errors
    }
    
    // Sync from Supabase in BACKGROUND (non-blocking, don't wait)
    syncProfileFromSupabase(user.id).catch(() => {});
    
    // Return minimal profile IMMEDIATELY - don't wait for Supabase
    return { success: true, data: minimalProfile };
  } catch (error: any) {
    // Even on error, return minimal profile for instant UI
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Normalize role: 'sitter' -> 'babysitter' for app compatibility
          const rawRole = user.user_metadata?.role || 'parent';
          const appRole = rawRole === 'sitter' ? 'babysitter' : rawRole;
          const minimalProfile: User = {
            id: user.id,
            email: user.email || '',
            displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
            role: appRole as any, // Normalized role
            preferredLanguage: 'en',
            userNumber: undefined,
            phoneNumber: undefined,
            profileImageUrl: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            theme: 'auto',
            isVerified: false,
            verificationStatus: undefined,
            hourlyRate: undefined,
            bio: undefined,
          };
          return { success: true, data: minimalProfile };
        }
      }
    } catch (fallbackError) {
      // Ignore fallback errors
    }
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Helper: Sync profile from Supabase in background
 */
async function syncProfileFromSupabase(userId: string): Promise<void> {
  try {
    if (!supabase) return;
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userData) {
      const { save, STORAGE_KEYS } = await import('./local-storage.service');
      const appRole = userData.role === 'sitter' ? 'babysitter' : userData.role;
      const userProfile: User = {
        id: userData.id,
        email: userData.email,
        displayName: userData.display_name,
        role: appRole as any,
        preferredLanguage: userData.preferred_language || 'en',
        userNumber: userData.user_number,
        phoneNumber: userData.phone_number ?? undefined,
        profileImageUrl: userData.photo_url ?? undefined,
        createdAt: new Date(userData.created_at),
        updatedAt: userData.updated_at ? new Date(userData.updated_at) : new Date(),
        theme: userData.theme || 'auto',
        isVerified: userData.is_verified || false,
        verificationStatus: userData.verification_status ?? undefined,
        hourlyRate: userData.hourly_rate ?? undefined,
        bio: userData.bio ?? undefined,
      };
      await save(STORAGE_KEYS.USERS, {
        ...userProfile,
        createdAt: userProfile.createdAt.getTime(),
        updatedAt: (userProfile.updatedAt || new Date()).getTime(),
      });
      console.log('✅ Profile synced from Supabase to AsyncStorage');
    }
  } catch (error) {
    console.warn('⚠️ Background sync failed:', error);
  }
}

/**
 * Helper: Create profile in Supabase in background
 */
async function createProfileInSupabase(profile: User): Promise<void> {
  try {
    if (!supabase) return;
    const dbRole = profile.role === 'babysitter' ? 'sitter' : profile.role;
    await supabase.from('users').upsert({
      id: profile.id,
      email: profile.email,
      display_name: profile.displayName,
      role: dbRole,
      preferred_language: profile.preferredLanguage,
      user_number: profile.userNumber,
      phone_number: profile.phoneNumber ?? null,
      photo_url: profile.profileImageUrl ?? null,
      theme: profile.theme ?? 'auto',
      is_verified: profile.isVerified ?? false,
      verification_status: profile.verificationStatus ?? null,
      hourly_rate: profile.hourlyRate ?? null,
      bio: profile.bio ?? null,
    });
    console.log('✅ Profile created in Supabase');
  } catch (error) {
    console.warn('⚠️ Failed to create profile in Supabase:', error);
  }
}

/**
 * Update user profile - updates Supabase and AsyncStorage
 */
export async function updateUserProfile(
  updates: Partial<Omit<User, 'id' | 'createdAt'>>
): Promise<ServiceResult<void>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'Supabase is not configured',
        },
      };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'No user is currently signed in',
        },
      };
    }

    // Convert User type to Supabase format
    const supabaseUpdates: any = {};
    if (updates.displayName !== undefined) supabaseUpdates.display_name = updates.displayName;
    if (updates.role !== undefined) supabaseUpdates.role = updates.role;
    if (updates.preferredLanguage !== undefined) supabaseUpdates.preferred_language = updates.preferredLanguage;
    if (updates.userNumber !== undefined) supabaseUpdates.user_number = updates.userNumber;
    if (updates.profileImageUrl !== undefined) supabaseUpdates.photo_url = updates.profileImageUrl;
    // Handle extended UserProfile properties
    const extendedUpdates = updates as any;
    if (extendedUpdates.phoneNumber !== undefined) supabaseUpdates.phone_number = extendedUpdates.phoneNumber;
    if (extendedUpdates.theme !== undefined) supabaseUpdates.theme = extendedUpdates.theme;
    if (extendedUpdates.isVerified !== undefined) supabaseUpdates.is_verified = extendedUpdates.isVerified;
    if (extendedUpdates.verificationStatus !== undefined) supabaseUpdates.verification_status = extendedUpdates.verificationStatus;
    if (extendedUpdates.hourlyRate !== undefined) supabaseUpdates.hourly_rate = extendedUpdates.hourlyRate;
    if (extendedUpdates.bio !== undefined) supabaseUpdates.bio = extendedUpdates.bio;

    // Update AsyncStorage FIRST (optimistic UI)
    try {
      const { getAll, save, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getAll(STORAGE_KEYS.USERS);
      if (result.success && result.data) {
        const localUser = (result.data as any[]).find((u: any) => u.id === user.id);
        if (localUser) {
          const updatedUser = {
            ...localUser,
            ...updates,
            id: user.id, // Ensure ID is present
            updatedAt: Date.now(),
          };
          await save(STORAGE_KEYS.USERS, updatedUser);
          console.log('✅ User profile updated in AsyncStorage');
        }
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to update AsyncStorage:', localError.message);
    }

    // Sync to Supabase in background (non-blocking)
    (async () => {
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update(supabaseUpdates)
          .eq('id', user.id);

        if (updateError) {
          console.warn('⚠️ Background Supabase update failed:', updateError.message);
        } else {
          console.log('✅ User profile updated in Supabase');
        }
      } catch (error: any) {
        console.warn('⚠️ Background Supabase update failed:', error.message);
      }
    })(); // IIFE - runs in background

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
