/**
 * Authentication Service - Supabase
 * Handles user authentication and profile management
 */
import { Language, LANGUAGES, UserRole } from '@/src/config/constants';
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { User } from '@/src/types/user.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { sessionManager } from './session-manager.service';
import { executeWrite } from './supabase-write.service';

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  preferredLanguage?: Language;
  phoneNumber?: string;
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

    // Create auth user with display_name in metadata
    // Note: Supabase requires email confirmation by default
    // To disable: Supabase Dashboard → Authentication → Settings → Disable "Enable email confirmations"
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: undefined, // Optional: set redirect URL after email confirmation
        data: {
          display_name: data.displayName.trim(), // Set display_name in auth metadata immediately
          full_name: data.displayName.trim(), // Also set full_name for compatibility
          role: data.role === 'babysitter' ? 'sitter' : data.role,
        },
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
      displayName: data.displayName.trim(),
      role: data.role, // Keep original role (babysitter, not sitter)
      preferredLanguage: data.preferredLanguage || LANGUAGES.ENGLISH,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      phoneNumber: data.phoneNumber && data.phoneNumber.trim() ? data.phoneNumber.trim() : null,
      profileImageUrl: null,
      theme: 'auto',
      isVerified: false,
      verificationStatus: null,
      hourlyRate: null,
      bio: null,
      address: null,
      city: null,
      country: 'Sri Lanka',
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
        // Always call create_user_profile to ensure display_name and all fields are set
        // Even if profile exists (from trigger), we need to update it with the actual display_name
        const rpcParams = {
          p_id: authData.user!.id,
          p_email: data.email,
          p_display_name: data.displayName.trim(), // Always set display_name from user input
          p_role: dbRole,
          p_preferred_language: data.preferredLanguage || LANGUAGES.ENGLISH,
          p_user_number: userNumber, // Always set user number
          p_phone_number: data.phoneNumber && data.phoneNumber.trim() ? data.phoneNumber.trim() : null,
          p_photo_url: null,
          p_theme: 'auto',
          p_is_verified: false,
          p_verification_status: null,
          p_hourly_rate: null,
          p_bio: null,
        };
        
        console.log('📤 Calling create_user_profile with:', {
          ...rpcParams,
          p_display_name: rpcParams.p_display_name,
          p_user_number: rpcParams.p_user_number,
          p_phone_number: rpcParams.p_phone_number,
        });
        
        const rpcRes = await executeWrite(() => supabase.rpc('create_user_profile', rpcParams), 'create_user_profile');
        const rpcData = rpcRes.data;
        const rpcError = rpcRes.error;

        if (rpcError) {
          console.error('❌ RPC create_user_profile failed:', rpcError);
          console.error('❌ Error details:', JSON.stringify(rpcError, null, 2));
          
          // Check if error is due to duplicate user_number
          const isDuplicateUserNumber = rpcError.code === '23505' && 
            (rpcError.message?.includes('user_number') || rpcError.message?.includes('users_user_number_key'));
          
          if (isDuplicateUserNumber) {
            console.warn('⚠️ Duplicate user_number detected, trying update without user_number...');
            
            // Try to update existing row with display_name (user_number conflict, but row might exist from trigger)
            // First, check if row exists
            const { data: existingUser } = await supabase
              .from('users')
              .select('id, user_number')
              .eq('id', authData.user!.id)
              .single();
            
            if (existingUser) {
              // Row exists, just update display_name and other fields (preserve existing user_number)
              const updateData: any = {
                email: data.email,
                display_name: data.displayName.trim(), // CRITICAL: Save display_name
                role: dbRole,
                preferred_language: data.preferredLanguage || LANGUAGES.ENGLISH,
                phone_number: data.phoneNumber && data.phoneNumber.trim() ? data.phoneNumber.trim() : null,
                theme: 'auto',
                updated_at: new Date().toISOString(),
              };
              
              const updateRes = await executeWrite(() => supabase
                .from('users')
                .update(updateData)
                .eq('id', authData.user!.id), 'users_update_display_name');
              
              if (updateRes.error) {
                console.error('❌ Update display_name failed:', updateRes.error);
              } else {
                console.log('✅ Display name saved via update (user_number conflict handled)');
              }
            } else {
              // Row doesn't exist, try insert without user_number (let DB handle it or set later)
              const insertData = {
                id: authData.user!.id,
                email: data.email,
                display_name: data.displayName.trim(), // CRITICAL: Save display_name
                role: dbRole,
                preferred_language: data.preferredLanguage || LANGUAGES.ENGLISH,
                user_number: null, // Skip user_number to avoid conflict
                phone_number: data.phoneNumber && data.phoneNumber.trim() ? data.phoneNumber.trim() : null,
                photo_url: null,
                theme: 'auto',
                is_verified: false,
                verification_status: null,
                hourly_rate: null,
                bio: null,
                address: null,
                city: null,
                country: 'Sri Lanka',
              };
              
              const insertRes = await executeWrite(() => supabase
                .from('users')
                .insert(insertData), 'users_insert_no_user_number');
              
              if (insertRes.error) {
                console.error('❌ Insert without user_number failed:', insertRes.error);
              } else {
                console.log('✅ Profile created without user_number (will be set later)');
              }
            }
          } else {
            // Other error, try upsert as fallback
            const upsertData = {
              id: authData.user!.id,
              email: data.email,
              display_name: data.displayName.trim(), // CRITICAL: Save display_name
              role: dbRole,
              preferred_language: data.preferredLanguage || LANGUAGES.ENGLISH,
              user_number: userNumber,
              phone_number: data.phoneNumber && data.phoneNumber.trim() ? data.phoneNumber.trim() : null,
              photo_url: null,
              theme: 'auto',
              is_verified: false,
              verification_status: null,
              hourly_rate: null,
              bio: null,
              address: null,
              city: null,
              country: 'Sri Lanka',
            };
            
            console.log('📤 Trying upsert fallback with:', {
              ...upsertData,
              display_name: upsertData.display_name,
              user_number: upsertData.user_number,
            });
            
            const upsertRes = await executeWrite(() => supabase
              .from('users')
              .upsert(upsertData, { onConflict: 'id' }), 'users_upsert');

            const upsertError = upsertRes.error;
            if (upsertError) {
              console.error('❌ Upsert fallback also failed:', upsertError);
              console.error('❌ Upsert error details:', JSON.stringify(upsertError, null, 2));
              
              // Last resort: Try update if row exists (might have been created by trigger)
              if (upsertError.code === '23505' && upsertError.message?.includes('user_number')) {
                console.log('🔄 Last resort: Updating existing row with display_name...');
                const { error: updateError } = await supabase
                  .from('users')
                  .update({
                    display_name: data.displayName.trim(), // CRITICAL: Save display_name
                    email: data.email,
                    role: dbRole,
                    preferred_language: data.preferredLanguage || LANGUAGES.ENGLISH,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', authData.user!.id);
                
                if (updateError) {
                  console.error('❌ Last resort update also failed:', updateError);
                } else {
                  console.log('✅ Display name saved via last resort update');
                }
              }
            } else {
              console.log('✅ Profile created in Supabase via upsert fallback');
            }
          }
        } else {
          console.log('✅ Profile created in Supabase via RPC');
          if (rpcData) {
            console.log('📥 RPC returned data:', rpcData);
          }
        }
      } catch (error: any) {
        // Log error but don't block - profile will sync later via useRealtimeSync
        console.error('❌ Background profile sync exception:', error);
        console.error('❌ Exception details:', error.message, error.stack);
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
    // Clear session manager FIRST
    try {
      sessionManager.clearSession();
      console.log('✅ Session cleared');
    } catch (sessionError: any) {
      console.warn('⚠️ Failed to clear session:', sessionError.message);
    }

    // Clear AsyncStorage (local data)
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
 * Get current user profile - Professional session management with REST API
 * Uses SessionManager for proper lifecycle and database sync
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

    // Use SessionManager for professional session handling
    // Check if session is already initialized
    const sessionState = sessionManager.getSessionState();
    if (sessionState.userId === user.id && sessionState.userProfile) {
      // Return cached profile (instant UI)
      console.log('✅ User profile from session manager (instant)');
      return { success: true, data: sessionState.userProfile };
    }

    // Initialize or refresh session
    const result = await sessionManager.initializeSession(user.id);
    
    if (result.success && result.data) {
      return result;
    }

    // Fallback: create minimal profile if API fails
    const rawRole = user.user_metadata?.role || 'parent';
    const appRole = rawRole === 'sitter' ? 'babysitter' : rawRole;
    const minimalProfile: User = {
      id: user.id,
      email: user.email || '',
      displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
      role: appRole as any,
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
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Helper: Sync profile from REST API in background
 * Now uses SessionManager for professional session handling
 */
async function syncProfileFromSupabase(userId: string): Promise<void> {
  try {
    await sessionManager.syncProfileFromAPI(userId);
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
    await executeWrite(() => supabase.from('users').upsert({
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
    }), 'create_profile_upsert');
    console.log('✅ Profile created in Supabase');
  } catch (error) {
    console.warn('⚠️ Failed to create profile in Supabase:', error);
  }
}

/**
 * Update user profile - updates Supabase and AsyncStorage
 */
/**
 * Update user profile - Professional method with REST API sync
 * Uses SessionManager for proper database synchronization
 */
export async function updateUserProfile(
  updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ServiceResult<User>> {
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

    // Use SessionManager for professional profile update with API sync
    // Ensure session is initialized
    if (!sessionManager.isSessionActive()) {
      await sessionManager.initializeSession(user.id);
    }

    // Update profile via SessionManager (handles API sync and caching)
    const result = await sessionManager.updateProfile(updates);
    
    if (result.success && result.data) {
      return result;
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
