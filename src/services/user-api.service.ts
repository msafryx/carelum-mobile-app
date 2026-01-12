/**
 * User API Service
 * Handles all user/profile API calls to the backend
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { User } from '@/src/types/user.types';
import {
  handleAPIError,
  handleNetworkError,
  handleUnexpectedError,
  retryWithBackoff,
} from '@/src/utils/errorHandler';

// Base API URL - should be configured via environment variable
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authentication token from Supabase
 */
async function getAuthToken(): Promise<string | null> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Generic API request function with authentication
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ServiceResult<T>> {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'No authentication token available',
        },
      };
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const response = await retryWithBackoff(async () => {
      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: handleAPIError(data, response.status),
      };
    }

    return { success: true, data };
  } catch (error: any) {
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        success: false,
        error: handleNetworkError(error),
      };
    }
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Convert API response to User type
 */
function apiResponseToUser(apiUser: any): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    displayName: apiUser.displayName,
    role: apiUser.role === 'sitter' ? 'babysitter' : apiUser.role,
    preferredLanguage: apiUser.preferredLanguage || 'en',
    userNumber: apiUser.userNumber,
    phoneNumber: apiUser.phoneNumber,
    profileImageUrl: apiUser.profileImageUrl,
    createdAt: new Date(apiUser.createdAt),
    updatedAt: new Date(apiUser.updatedAt),
    theme: apiUser.theme || 'auto',
    isVerified: apiUser.isVerified || false,
    verificationStatus: apiUser.verificationStatus,
    hourlyRate: apiUser.hourlyRate,
    bio: apiUser.bio,
    address: apiUser.address,
    city: apiUser.city,
    country: apiUser.country,
  };
}

/**
 * Get current user profile from API
 */
export async function getCurrentUserProfileFromAPI(): Promise<ServiceResult<User>> {
  const result = await apiRequest<any>('/api/users/me');
  
  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: apiResponseToUser(result.data),
  };
}

/**
 * Update auth user metadata (for display_name sync)
 */
async function updateAuthMetadata(displayName?: string): Promise<void> {
  try {
    if (!displayName) return;
    
    if (!isSupabaseConfigured() || !supabase) {
      console.warn('⚠️ Supabase not configured for metadata update');
      return;
    }
    
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    
    if (getUserError) {
      console.warn('⚠️ Failed to get auth user for metadata update:', getUserError);
      return;
    }
    
    if (!user) {
      console.warn('⚠️ No auth user found for metadata update');
      return;
    }

    // Update auth metadata to keep display_name in sync
    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: displayName,
        full_name: displayName, // Also set full_name for compatibility
      },
    });

    if (error) {
      console.warn('⚠️ Failed to update auth metadata:', error);
    } else {
      console.log('✅ Auth metadata updated with display_name:', displayName);
    }
  } catch (error: any) {
    console.warn('⚠️ Exception updating auth metadata:', error);
    // Don't throw - this is a non-critical sync operation
  }
}

/**
 * Ensure user row exists in users table (create if missing)
 */
export async function ensureUserRowExists(userId: string, email: string, displayName?: string): Promise<ServiceResult<void>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }
    
    // Check if user exists in users table (use maybeSingle() to avoid errors when not found)
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('id', userId)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors

    // Check for real errors (not "not found")
    if (fetchError) {
      const isNotFoundError = 
        fetchError.code === 'PGRST116' || 
        fetchError.code === 'PGRST301' ||
        fetchError.message?.includes('No rows') ||
        fetchError.message?.includes('not found');
      
      if (!isNotFoundError) {
        console.warn('⚠️ Error checking user existence:', fetchError);
        // Continue anyway - might be a transient error
      }
    }

    if (existingUser) {
      // User exists - check if display_name needs updating
      if (displayName && (!existingUser.display_name || existingUser.display_name !== displayName)) {
        console.log('📝 Updating display_name for existing user...');
        const { error: updateError } = await supabase
          .from('users')
          .update({
            display_name: displayName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        
        if (updateError) {
          console.warn('⚠️ Failed to update display_name:', updateError);
        } else {
          console.log('✅ Display name updated for existing user');
        }
      }
      return { success: true };
    }

    // User doesn't exist, create it using the RPC function
    console.log('📝 User row missing, creating via RPC...');
    let rpcError = null;
    let rpcResult = await supabase.rpc('create_user_profile', {
      p_id: userId,
      p_email: email,
      p_display_name: displayName || email.split('@')[0],
      p_role: 'parent', // Default, will be updated if needed
      p_preferred_language: 'en',
      p_user_number: null, // Let DB generate or set later to avoid conflicts
      p_phone_number: null,
      p_photo_url: null,
      p_theme: 'auto',
      p_is_verified: false,
      p_verification_status: null,
      p_hourly_rate: null,
      p_bio: null,
    });

    rpcError = rpcResult.error;

    // If RPC fails due to duplicate user_number or other conflict, try direct insert/update
    if (rpcError) {
      console.warn('⚠️ RPC failed, trying direct insert/update:', rpcError.message);
      
      // Check if row exists (might have been created by trigger) - use maybeSingle()
      const { data: existingRow, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle() to avoid errors
      
      // Check if it's a real error (not "not found")
      if (checkError) {
        const isNotFoundError = 
          checkError.code === 'PGRST116' || 
          checkError.code === 'PGRST301' ||
          checkError.message?.includes('No rows') ||
          checkError.message?.includes('not found');
        
        if (!isNotFoundError) {
          console.warn('⚠️ Error checking if row exists after RPC failure:', checkError);
        }
      }
      
      if (existingRow) {
        // Row exists, just update display_name
        const { error: updateError } = await supabase
          .from('users')
          .update({
            display_name: displayName || email.split('@')[0],
            email: email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        
        if (updateError) {
          console.error('❌ Failed to update user row:', updateError);
          return {
            success: false,
            error: {
              code: ErrorCode.DB_UPDATE_ERROR,
              message: `Failed to update user row: ${updateError.message}`,
            },
          };
        }
        console.log('✅ User row updated with display_name');
        return { success: true };
      } else {
        // Row doesn't exist, try insert without user_number
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: email,
            display_name: displayName || email.split('@')[0],
            role: 'parent',
            preferred_language: 'en',
            user_number: null, // Skip to avoid conflicts
            theme: 'auto',
            is_verified: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        
        if (insertError) {
          // Check if it's a duplicate key error (row was created between checks)
          const isDuplicateError = 
            insertError.code === '23505' || // PostgreSQL unique violation
            insertError.message?.includes('duplicate') ||
            insertError.message?.includes('unique constraint');
          
          if (isDuplicateError) {
            console.log('⚠️ Insert failed due to duplicate (row created by trigger), updating instead...');
            // Row was created by trigger, just update display_name
            const { error: updateError } = await supabase
              .from('users')
              .update({
                display_name: displayName || email.split('@')[0],
                email: email,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId);
            
            if (updateError) {
              console.error('❌ Failed to update user row after duplicate error:', updateError);
              return {
                success: false,
                error: {
                  code: ErrorCode.DB_UPDATE_ERROR,
                  message: `Failed to update user row: ${updateError.message}`,
                },
              };
            }
            console.log('✅ User row updated after duplicate error');
            return { success: true };
          }
          
          console.error('❌ Failed to insert user row:', insertError);
          return {
            success: false,
            error: {
              code: ErrorCode.DB_INSERT_ERROR,
              message: `Failed to create user row: ${insertError.message}`,
            },
          };
        }
        console.log('✅ User row created with display_name');
        return { success: true };
      }
    }

    console.log('✅ User row created successfully via RPC');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Exception ensuring user row exists:', error);
    return {
      success: false,
      error: {
        code: ErrorCode.DB_EXECUTE_ERROR,
        message: `Failed to ensure user row exists: ${error.message}`,
      },
    };
  }
}

/**
 * Update current user profile via API
 */
export async function updateUserProfileViaAPI(
  updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ServiceResult<User>> {
  // Convert User type to API request format
  const apiUpdates: any = {};
  if (updates.displayName !== undefined) apiUpdates.displayName = updates.displayName;
  if (updates.phoneNumber !== undefined) apiUpdates.phoneNumber = updates.phoneNumber;
  if (updates.profileImageUrl !== undefined) apiUpdates.profileImageUrl = updates.profileImageUrl;
  if (updates.preferredLanguage !== undefined) apiUpdates.preferredLanguage = updates.preferredLanguage;
  if (updates.theme !== undefined) apiUpdates.theme = updates.theme;
  if (updates.bio !== undefined) apiUpdates.bio = updates.bio;
  if (updates.hourlyRate !== undefined) apiUpdates.hourlyRate = updates.hourlyRate;
  // Include address, city, country - use 'in' operator to allow null values to be sent
  if ('address' in updates) apiUpdates.address = updates.address;
  if ('city' in updates) apiUpdates.city = updates.city;
  if ('country' in updates) apiUpdates.country = updates.country;

  console.log('📤 Sending profile update to API:', JSON.stringify(apiUpdates, null, 2));

  const result = await apiRequest<any>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(apiUpdates),
  });

  console.log('📥 API response:', result);

  if (!result.success) {
    // Don't log as error - this is expected when API is down, fallback will handle it
    console.warn('⚠️ API update failed (fallback will handle):', result.error?.code || 'UNKNOWN_ERROR');
    return result;
  }

  console.log('✅ API update successful, converting response...');
  
  // Sync display_name to auth metadata if it was updated
  if (updates.displayName !== undefined) {
    await updateAuthMetadata(updates.displayName);
  }

  return {
    success: true,
    data: apiResponseToUser(result.data),
  };
}
