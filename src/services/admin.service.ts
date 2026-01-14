/**
 * Admin Service - Supabase
 * Handles admin-specific operations
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { User } from '@/src/types/user.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { executeWrite } from './supabase-write.service';

/**
 * Get all users (admin only)
 */
export async function getAllUsers(
  role?: 'parent' | 'babysitter' | 'admin',
  limitCount: number = 100
): Promise<ServiceResult<User[]>> {
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

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limitCount);

    // Map frontend role to database role
    if (role) {
      const dbRole = role === 'babysitter' ? 'sitter' : role;
      query = query.eq('role', dbRole);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch users: ${error.message}`,
        },
      };
    }

    const users: User[] = (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      // Map database role to frontend role
      role: row.role === 'sitter' ? 'babysitter' : row.role,
      preferredLanguage: row.preferred_language,
      userNumber: row.user_number,
      phoneNumber: row.phone_number,
      profileImageUrl: row.photo_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      theme: row.theme || 'auto',
      isVerified: row.is_verified || false,
      verificationStatus: row.verification_status,
      hourlyRate: row.hourly_rate,
      bio: row.bio,
    }));

    return { success: true, data: users };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get user by ID (admin only)
 */
export async function getUserById(userId: string): Promise<ServiceResult<User>> {
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

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: {
          code: ErrorCode.DOCUMENT_NOT_FOUND,
          message: 'User not found',
        },
      };
    }

    const user: User = {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      // Map database role to frontend role
      role: data.role === 'sitter' ? 'babysitter' : data.role,
      preferredLanguage: data.preferred_language,
      userNumber: data.user_number,
      profileImageUrl: data.photo_url,
      createdAt: new Date(data.created_at),
    } as User;
    
    // Add extended properties as any for now (UserProfile extends User)
    (user as any).phoneNumber = data.phone_number;
    (user as any).theme = data.theme || 'auto';
    (user as any).isVerified = data.is_verified || false;
    (user as any).verificationStatus = data.verification_status;
    (user as any).hourlyRate = data.hourly_rate;
    (user as any).bio = data.bio;
    (user as any).updatedAt = new Date(data.updated_at);

    return { success: true, data: user };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Update user (admin only)
 */
export async function updateUser(
  userId: string,
  updates: Partial<User>
): Promise<ServiceResult<void>> {
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

    const supabaseUpdates: any = {};
    if (updates.displayName !== undefined) supabaseUpdates.display_name = updates.displayName;
    // Map frontend role to database role
    if (updates.role !== undefined) {
      supabaseUpdates.role = updates.role === 'babysitter' ? 'sitter' : updates.role;
    }
    if (updates.preferredLanguage !== undefined) supabaseUpdates.preferred_language = updates.preferredLanguage;
    if (updates.profileImageUrl !== undefined) supabaseUpdates.photo_url = updates.profileImageUrl;
    // Handle extended UserProfile properties
    const extendedUpdates = updates as any;
    if (extendedUpdates.phoneNumber !== undefined) supabaseUpdates.phone_number = extendedUpdates.phoneNumber;
    if (extendedUpdates.theme !== undefined) supabaseUpdates.theme = extendedUpdates.theme;
    if (extendedUpdates.isVerified !== undefined) supabaseUpdates.is_verified = extendedUpdates.isVerified;
    if (extendedUpdates.verificationStatus !== undefined) supabaseUpdates.verification_status = extendedUpdates.verificationStatus;
    if (extendedUpdates.hourlyRate !== undefined) supabaseUpdates.hourly_rate = extendedUpdates.hourlyRate;
    if (extendedUpdates.bio !== undefined) supabaseUpdates.bio = extendedUpdates.bio;

    const res = await executeWrite(() => supabase
      .from('users')
      .update(supabaseUpdates)
      .eq('id', userId), 'admin_user_update');

    const error = res.error;
    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to update user: ${error.message || JSON.stringify(error)}`,
        },
      };
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
 * Deactivate user (admin only)
 */
export async function deactivateUser(userId: string): Promise<ServiceResult<void>> {
  return updateUser(userId, { isActive: false } as any);
}

/**
 * Activate user (admin only)
 */
export async function activateUser(userId: string): Promise<ServiceResult<void>> {
  return updateUser(userId, { isActive: true } as any);
}

/**
 * Delete user (admin only)
 * Deletes from both public.users and auth.users
 */
export async function deleteUser(userId: string): Promise<ServiceResult<void>> {
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

    // Delete from AsyncStorage FIRST
    try {
      const { remove, getAll, STORAGE_KEYS } = await import('./local-storage.service');
      
      // Delete user from AsyncStorage
      await remove(STORAGE_KEYS.USERS, userId);
      console.log('✅ User deleted from AsyncStorage');
      
      // Also delete all children for this user
      const childrenResult = await getAll(STORAGE_KEYS.CHILDREN);
      if (childrenResult.success && childrenResult.data) {
        const userChildren = (childrenResult.data as any[]).filter((c: any) => c.parentId === userId);
        for (const child of userChildren) {
          await remove(STORAGE_KEYS.CHILDREN, child.id);
        }
        if (userChildren.length > 0) {
          console.log(`✅ Deleted ${userChildren.length} child(ren) from AsyncStorage`);
        }
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to delete from AsyncStorage:', localError.message);
    }

    // Delete from Supabase IMMEDIATELY
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('❌ Failed to delete user from Supabase:', deleteError);
      return {
        success: false,
        error: {
          code: ErrorCode.DB_DELETE_ERROR,
          message: `Failed to delete user profile: ${deleteError.message}`,
        },
      };
    }

    // Note: Deleting from auth.users requires admin/service role privileges
    // The database trigger (handle_auth_user_deleted) will automatically
    // delete from public.users when auth.users is deleted
    // 
    // To delete from auth.users, you need to:
    // 1. Use Supabase Dashboard → Authentication → Users → Delete
    // 2. Or use the Supabase Admin API with service role key (server-side only)
    // 
    // For now, we only delete from public.users
    // The trigger ensures sync when auth.users is deleted manually
    console.log('✅ User profile deleted from public.users (cascade deletes all related data)');
    console.log('💡 To delete from auth.users, use Supabase Dashboard or Admin API');

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Change user role (admin only)
 */
export async function changeUserRole(
  userId: string,
  newRole: 'parent' | 'babysitter' | 'admin'
): Promise<ServiceResult<void>> {
  // Map frontend role to database role - updateUser will handle the mapping
  return updateUser(userId, { role: newRole } as any);
}

/**
 * Get admin statistics
 */
export async function getAdminStats(): Promise<ServiceResult<{
  totalUsers: number;
  totalParents: number;
  totalSitters: number;
  totalAdmins: number;
  pendingVerifications: number;
  activeSessions: number;
}>> {
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

    // Get user counts - map 'babysitter' to 'sitter' for database query
    const [allUsersResult, parentsResult, sittersResult, adminsResult, pendingVerificationsResult, activeSessionsResult] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'sitter'), // Database uses 'sitter'
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    return {
      success: true,
      data: {
        totalUsers: allUsersResult.count || 0,
        totalParents: parentsResult.count || 0,
        totalSitters: sittersResult.count || 0,
        totalAdmins: adminsResult.count || 0,
        pendingVerifications: pendingVerificationsResult.count || 0,
        activeSessions: activeSessionsResult.count || 0,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
