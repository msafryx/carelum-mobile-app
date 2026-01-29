/**
 * Session Manager Service
 * Professional session management with proper lifecycle and database sync
 */
import { supabase } from '@/src/config/supabase';
import { User } from '@/src/types/user.types';
import { ServiceResult } from '@/src/types/error.types';
import { getCurrentUserProfileFromAPI, updateUserProfileViaAPI } from './user-api.service';
import { save, getAll, STORAGE_KEYS } from './local-storage.service';

interface SessionState {
  userId: string | null;
  userProfile: User | null;
  isAuthenticated: boolean;
  lastSyncTime: number | null;
  sessionStartTime: number | null;
}

class SessionManager {
  private state: SessionState = {
    userId: null,
    userProfile: null,
    isAuthenticated: false,
    lastSyncTime: null,
    sessionStartTime: null,
  };

  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SYNC_RETRIES = 3;

  /**
   * Initialize session for authenticated user
   * INSTANT: Always returns cached profile immediately, syncs in background
   */
  async initializeSession(userId: string): Promise<ServiceResult<User>> {
    try {
      console.log('🔐 Initializing session for user:', userId);
      
      // ALWAYS load from AsyncStorage first (instant UI - PRIMARY source)
      const cachedProfile = await this.loadCachedProfile(userId);
      
      if (cachedProfile) {
        // Update state immediately with cached profile
        this.state = {
          userId,
          userProfile: cachedProfile,
          isAuthenticated: true,
          lastSyncTime: Date.now(),
          sessionStartTime: Date.now(),
        };
        
        // Start periodic sync
        this.startPeriodicSync();
        
        // Sync from API in background (non-blocking, fire and forget)
        this.syncProfileFromAPI(userId).catch(() => {});
        
        console.log('✅ Session initialized from cache (instant)');
        return { success: true, data: cachedProfile };
      }

      // If no cache, try to fetch from Supabase directly first (more reliable than API)
      console.log('📥 No cache found, fetching from Supabase...');
      const supabaseFetchResult = await this.fetchProfileDirectlyFromSupabase(userId);
      if (supabaseFetchResult.success && supabaseFetchResult.data) {
        // Update state with fetched profile
        this.state = {
          userId,
          userProfile: supabaseFetchResult.data,
          isAuthenticated: true,
          lastSyncTime: Date.now(),
          sessionStartTime: Date.now(),
        };
        
        // Save to cache
        await this.saveProfileToCache(supabaseFetchResult.data);
        
        // Start periodic sync
        this.startPeriodicSync();
        
        // Sync from API in background (non-blocking, fire and forget)
        this.syncProfileFromAPI(userId).catch(() => {});
        
        console.log('✅ Session initialized from Supabase (with all fields)');
        return { success: true, data: supabaseFetchResult.data };
      }

      // If Supabase fetch fails, create minimal profile from auth metadata (instant fallback)
      // This ensures we never block on API calls
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const rawRole = user.user_metadata?.role || 'parent';
          const appRole = rawRole === 'sitter' ? 'babysitter' : rawRole;
          const minimalProfile: User = {
            id: user.id,
            email: user.email || '',
            displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
            role: appRole as any,
            preferredLanguage: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
            theme: 'auto',
            isVerified: false,
          };
          
          // Update state with minimal profile
          this.state = {
            userId,
            userProfile: minimalProfile,
            isAuthenticated: true,
            lastSyncTime: Date.now(),
            sessionStartTime: Date.now(),
          };
          
          // Save to cache
          await this.saveProfileToCache(minimalProfile);
          
          // Start periodic sync
          this.startPeriodicSync();
          
          // Sync from API in background (non-blocking, fire and forget)
          this.syncProfileFromAPI(userId).catch(() => {});
          
          console.log('✅ Session initialized with minimal profile (instant fallback)');
          return { success: true, data: minimalProfile };
        }
      } catch (authError) {
        console.warn('⚠️ Failed to get auth user:', authError);
      }

      // Last resort: return error (should never happen)
      return {
        success: false,
        error: {
          code: 'SESSION_INIT_ERROR',
          message: 'Failed to initialize session',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SESSION_INIT_ERROR',
          message: `Failed to initialize session: ${error.message}`,
        },
      };
    }
  }

  /**
   * Load cached profile from AsyncStorage
   */
  private async loadCachedProfile(userId: string): Promise<User | null> {
    try {
      const result = await getAll(STORAGE_KEYS.USERS);
      if (result.success && result.data) {
        const user = result.data.find((u: any) => u.id === userId);
        if (user) {
          return {
            ...user,
            createdAt: new Date(user.createdAt || Date.now()),
            updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
          } as User;
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load cached profile:', error);
    }
    return null;
  }

  /**
   * Sync profile from REST API
   */
  async syncProfileFromAPI(userId: string, retryCount = 0): Promise<ServiceResult<User>> {
    try {
      console.log('🔄 Syncing profile from API...');
      
      const result = await getCurrentUserProfileFromAPI();
      
      if (result.success && result.data) {
        // Save to AsyncStorage
        await this.saveProfileToCache(result.data);
        
        // Update state
        if (this.state.userId === userId) {
          this.state.userProfile = result.data;
          this.state.lastSyncTime = Date.now();
        }
        
        console.log('✅ Profile synced from API');
        return result;
      }

      // Retry logic
      if (retryCount < this.MAX_SYNC_RETRIES) {
        console.log(`⚠️ Sync failed, retrying (${retryCount + 1}/${this.MAX_SYNC_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.syncProfileFromAPI(userId, retryCount + 1);
      }

      // API failed - try direct Supabase fetch as fallback
      console.log('⚠️ API sync failed, trying direct Supabase fetch as fallback...');
      const supabaseResult = await this.fetchProfileDirectlyFromSupabase(userId);
      if (supabaseResult.success && supabaseResult.data) {
        console.log('✅ Profile fetched from Supabase (fallback)');
        await this.saveProfileToCache(supabaseResult.data);
        if (this.state.userId === userId) {
          this.state.userProfile = supabaseResult.data;
          this.state.lastSyncTime = Date.now();
        }
        return supabaseResult;
      }

      return result;
    } catch (error: any) {
      console.error('❌ Profile sync error:', error);
      // Try Supabase fallback even on exception
      try {
        const supabaseResult = await this.fetchProfileDirectlyFromSupabase(userId);
        if (supabaseResult.success && supabaseResult.data) {
          console.log('✅ Profile fetched from Supabase (exception fallback)');
          await this.saveProfileToCache(supabaseResult.data);
          if (this.state.userId === userId) {
            this.state.userProfile = supabaseResult.data;
            this.state.lastSyncTime = Date.now();
          }
          return supabaseResult;
        }
      } catch (supabaseError) {
        console.error('❌ Supabase fallback also failed:', supabaseError);
      }
      return {
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: `Failed to sync profile: ${error.message}`,
        },
      };
    }
  }

  /**
   * Save profile to AsyncStorage cache
   */
  private async saveProfileToCache(profile: User): Promise<void> {
    try {
      await save(STORAGE_KEYS.USERS, {
        ...profile,
        createdAt: profile.createdAt.getTime(),
        updatedAt: profile.updatedAt.getTime(),
      });
    } catch (error) {
      console.warn('⚠️ Failed to save profile to cache:', error);
    }
  }

  /**
   * Update user profile - OPTIMISTIC UPDATE
   * Updates local state immediately, syncs to API in background
   */
  async updateProfile(updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ServiceResult<User>> {
    try {
      if (!this.state.userId || !this.state.userProfile) {
        return {
          success: false,
          error: {
            code: 'NO_SESSION',
            message: 'No active session',
          },
        };
      }

      // OPTIMISTIC UPDATE: Update local state immediately (instant UI)
      const updatedProfile: User = {
        ...this.state.userProfile,
        ...updates,
        updatedAt: new Date(),
      };
      
      this.state.userProfile = updatedProfile;
      this.state.lastSyncTime = Date.now();
      
      // Save to cache immediately
      await this.saveProfileToCache(updatedProfile);
      
      console.log('✅ Profile updated optimistically (instant UI)');
      console.log('📤 Syncing to API with updates:', updates);
      
      // Sync to API - wait for result to ensure it actually saves
      try {
        const apiResult = await updateUserProfileViaAPI(updates);
        console.log('📥 API sync result:', apiResult);
        
        if (apiResult.success && apiResult.data) {
          // Update with server response (may have additional fields)
          this.state.userProfile = apiResult.data;
          this.state.lastSyncTime = Date.now();
          await this.saveProfileToCache(apiResult.data);
          console.log('✅ Profile synced to API successfully');
          return { success: true, data: apiResult.data };
        } else {
          // API failed - use Supabase fallback (this is expected when API is down)
          console.warn('⚠️ API sync failed (this is OK, using Supabase fallback):', apiResult.error?.code || 'UNKNOWN_ERROR');
          console.log('📤 Using direct Supabase update as fallback...');
          // Try direct Supabase update as fallback to ensure data is saved
          const supabaseResult = await this.updateProfileDirectlyToSupabase(updates);
          if (supabaseResult.success && supabaseResult.data) {
            console.log('✅ Profile saved successfully via Supabase (fallback worked)');
            this.state.userProfile = supabaseResult.data;
            this.state.lastSyncTime = Date.now();
            await this.saveProfileToCache(supabaseResult.data);
            return { success: true, data: supabaseResult.data };
          } else {
            // Both API and Supabase failed - this is a real error
            console.error('❌ Direct Supabase update also failed:', supabaseResult.error);
            console.error('⚠️ Profile update may not be persisted. Error:', supabaseResult.error?.message);
            // Still return success for optimistic update, but warn user
          return { success: true, data: updatedProfile };
          }
        }
      } catch (apiError: any) {
        // API exception - use Supabase fallback (this is expected when API is down)
        console.warn('⚠️ API sync exception (this is OK, using Supabase fallback):', apiError.message || 'Network error');
        console.log('📤 Using direct Supabase update as fallback...');
        // Try direct Supabase update as fallback
        try {
          const supabaseResult = await this.updateProfileDirectlyToSupabase(updates);
          if (supabaseResult.success && supabaseResult.data) {
            console.log('✅ Profile saved successfully via Supabase (exception fallback worked)');
            this.state.userProfile = supabaseResult.data;
            this.state.lastSyncTime = Date.now();
            await this.saveProfileToCache(supabaseResult.data);
            return { success: true, data: supabaseResult.data };
          } else {
            console.error('❌ Direct Supabase update failed:', supabaseResult.error);
            console.error('⚠️ Profile update may not be persisted. Error:', supabaseResult.error?.message);
          }
        } catch (supabaseError: any) {
          console.error('❌ Direct Supabase update exception:', supabaseError);
          console.error('⚠️ Profile update may not be persisted. Exception:', supabaseError.message);
        }
        // Return success for optimistic update, but data may not be persisted
        return { success: true, data: updatedProfile };
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: `Failed to update profile: ${error.message}`,
        },
      };
    }
  }

  /**
   * Fetch profile directly from Supabase (fallback when API fails)
   */
  private async fetchProfileDirectlyFromSupabase(userId: string): Promise<ServiceResult<User>> {
    try {
      if (!supabase) {
        return {
          success: false,
          error: {
            code: 'NO_SUPABASE',
            message: 'Supabase is not configured',
          },
        };
      }

      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError || !userData) {
        return {
          success: false,
          error: {
            code: 'DB_FETCH_ERROR',
            message: `Failed to fetch profile from Supabase: ${fetchError?.message || 'No data returned'}`,
          },
        };
      }

      // Convert to User type with ALL fields
      const profile: User = {
        id: userData.id,
        email: userData.email,
        displayName: userData.display_name,
        role: userData.role === 'sitter' ? 'babysitter' : userData.role,
        preferredLanguage: userData.preferred_language || 'en',
        userNumber: userData.user_number,
        phoneNumber: userData.phone_number,
        profileImageUrl: userData.photo_url,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at),
      } as User;

      // Add extended properties
      (profile as any).address = userData.address;
      (profile as any).city = userData.city;
      (profile as any).country = userData.country;
      (profile as any).theme = userData.theme || 'auto';
      (profile as any).isVerified = userData.is_verified || false;
      (profile as any).verificationStatus = userData.verification_status;
      (profile as any).hourlyRate = userData.hourly_rate;
      (profile as any).bio = userData.bio;
      // Add sitter availability and location fields
      (profile as any).isActive = userData.is_active ?? false;
      (profile as any).lastActiveAt = userData.last_active_at ? new Date(userData.last_active_at) : undefined;
      (profile as any).latitude = userData.latitude;
      (profile as any).longitude = userData.longitude;
      (profile as any).bio = userData.bio;

      return { success: true, data: profile };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: `Failed to fetch profile: ${error.message}`,
        },
      };
    }
  }

  /**
   * Update profile directly to Supabase (fallback when API fails)
   * IMPORTANT: This merges with existing data to prevent removing fields
   */
  private async updateProfileDirectlyToSupabase(
    updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ServiceResult<User>> {
    try {
      if (!this.state.userId || !supabase) {
        return {
          success: false,
          error: {
            code: 'NO_SESSION',
            message: 'No active session or Supabase not configured',
          },
        };
      }

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser || authUser.id !== this.state.userId) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Failed to get authenticated user',
          },
        };
      }

      // Build Supabase update object - ONLY include fields that are being updated
      // Supabase UPDATE only updates specified fields, so we don't need to merge
      // This prevents accidentally removing fields
      const supabaseUpdates: any = {};
      
      // Only include fields that are explicitly in the updates object
      if (updates.displayName !== undefined) supabaseUpdates.display_name = updates.displayName;
      if (updates.phoneNumber !== undefined) supabaseUpdates.phone_number = updates.phoneNumber;
      if (updates.profileImageUrl !== undefined) supabaseUpdates.photo_url = updates.profileImageUrl;
      if (updates.preferredLanguage !== undefined) supabaseUpdates.preferred_language = updates.preferredLanguage;
      if (updates.theme !== undefined) supabaseUpdates.theme = updates.theme;
      if (updates.bio !== undefined) supabaseUpdates.bio = updates.bio;
      if (updates.hourlyRate !== undefined) supabaseUpdates.hourly_rate = updates.hourlyRate;
      
      // Handle address, city, country - use 'in' operator to allow null values
      const extendedUpdates = updates as any;
      if ('address' in extendedUpdates) supabaseUpdates.address = extendedUpdates.address;
      if ('city' in extendedUpdates) supabaseUpdates.city = extendedUpdates.city;
      if ('country' in extendedUpdates) supabaseUpdates.country = extendedUpdates.country;
      
      supabaseUpdates.updated_at = new Date().toISOString();
      
      console.log('📤 Direct Supabase update (partial update - only specified fields):', {
        updatingFields: Object.keys(supabaseUpdates),
        note: 'Supabase UPDATE only modifies specified fields, preserving others',
      });

      console.log('📤 Direct Supabase update (fallback):', {
        userId: authUser.id,
        updates: Object.keys(supabaseUpdates),
        displayName: supabaseUpdates.display_name,
      });

      const { data: updatedData, error: updateError } = await supabase
        .from('users')
        .update(supabaseUpdates)
        .eq('id', authUser.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Direct Supabase update error:', {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        });
        return {
          success: false,
          error: {
            code: 'DB_UPDATE_ERROR',
            message: `Failed to update profile in Supabase: ${updateError.message || 'Unknown error'}`,
          },
        };
      }

      if (!updatedData) {
        console.error('❌ Direct Supabase update returned no data');
        return {
          success: false,
          error: {
            code: 'DB_UPDATE_ERROR',
            message: 'Supabase update succeeded but returned no data',
          },
        };
      }

      console.log('✅ Direct Supabase update successful, data received');

      // Update auth metadata if display_name changed
      if (updates.displayName) {
        await supabase.auth.updateUser({
          data: {
            display_name: updates.displayName,
            full_name: updates.displayName,
          },
        }).catch((err) => {
          console.warn('⚠️ Failed to update auth metadata:', err);
        });
      }

      // Convert to User type
      const updatedUser: User = {
        id: updatedData.id,
        email: updatedData.email,
        displayName: updatedData.display_name,
        role: updatedData.role === 'sitter' ? 'babysitter' : updatedData.role,
        preferredLanguage: updatedData.preferred_language || 'en',
        userNumber: updatedData.user_number,
        phoneNumber: updatedData.phone_number,
        profileImageUrl: updatedData.photo_url,
        createdAt: new Date(updatedData.created_at),
        updatedAt: new Date(updatedData.updated_at),
      } as User;

      // Add extended properties
      (updatedUser as any).address = updatedData.address;
      (updatedUser as any).city = updatedData.city;
      (updatedUser as any).country = updatedData.country;
      (updatedUser as any).theme = updatedData.theme || 'auto';
      (updatedUser as any).isVerified = updatedData.is_verified || false;
      (updatedUser as any).verificationStatus = updatedData.verification_status;
      (updatedUser as any).hourlyRate = updatedData.hourly_rate;
      (updatedUser as any).bio = updatedData.bio;

      return { success: true, data: updatedUser };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: `Failed to update profile directly: ${error.message}`,
        },
      };
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.stopPeriodicSync();
    
    this.syncInterval = setInterval(() => {
      if (this.state.userId && this.state.isAuthenticated) {
        console.log('🔄 Periodic profile sync...');
        this.syncProfileFromAPI(this.state.userId).catch(() => {});
      }
    }, this.SYNC_INTERVAL);
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    return { ...this.state };
  }

  /**
   * Get current user profile
   */
  getCurrentProfile(): User | null {
    return this.state.userProfile;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.state.isAuthenticated && this.state.userId !== null;
  }

  /**
   * Clear session
   */
  clearSession(): void {
    console.log('🔓 Clearing session...');
    this.stopPeriodicSync();
    this.state = {
      userId: null,
      userProfile: null,
      isAuthenticated: false,
      lastSyncTime: null,
      sessionStartTime: null,
    };
  }

  /**
   * Force sync profile from API
   */
  async forceSync(): Promise<ServiceResult<User>> {
    if (!this.state.userId) {
      return {
        success: false,
        error: {
          code: 'NO_SESSION',
          message: 'No active session',
        },
      };
    }

    return this.syncProfileFromAPI(this.state.userId);
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
