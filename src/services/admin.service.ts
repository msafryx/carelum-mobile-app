/**
 * Admin Service - Supabase
 * Handles admin-specific operations
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { User } from '@/src/types/user.types';

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

    if (role) {
      query = query.eq('role', role);
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
      role: row.role,
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
      role: data.role,
      preferredLanguage: data.preferred_language,
      userNumber: data.user_number,
      phoneNumber: data.phone_number,
      profileImageUrl: data.photo_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      theme: data.theme || 'auto',
      isVerified: data.is_verified || false,
      verificationStatus: data.verification_status,
      hourlyRate: data.hourly_rate,
      bio: data.bio,
    };

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
    if (updates.role !== undefined) supabaseUpdates.role = updates.role;
    if (updates.preferredLanguage !== undefined) supabaseUpdates.preferred_language = updates.preferredLanguage;
    if (updates.phoneNumber !== undefined) supabaseUpdates.phone_number = updates.phoneNumber;
    if (updates.profileImageUrl !== undefined) supabaseUpdates.photo_url = updates.profileImageUrl;
    if (updates.theme !== undefined) supabaseUpdates.theme = updates.theme;
    if (updates.isVerified !== undefined) supabaseUpdates.is_verified = updates.isVerified;
    if (updates.verificationStatus !== undefined) supabaseUpdates.verification_status = updates.verificationStatus;
    if (updates.hourlyRate !== undefined) supabaseUpdates.hourly_rate = updates.hourlyRate;
    if (updates.bio !== undefined) supabaseUpdates.bio = updates.bio;

    const { error } = await supabase
      .from('users')
      .update(supabaseUpdates)
      .eq('id', userId);

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to update user: ${error.message}`,
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
 * Change user role (admin only)
 */
export async function changeUserRole(
  userId: string,
  newRole: 'parent' | 'babysitter' | 'admin'
): Promise<ServiceResult<void>> {
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

    // Get user counts
    const [allUsersResult, parentsResult, sittersResult, adminsResult, pendingVerificationsResult, activeSessionsResult] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'babysitter'),
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
