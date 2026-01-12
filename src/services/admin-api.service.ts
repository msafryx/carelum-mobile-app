/**
 * Admin API Service
 * Handles all admin API calls to the backend
 */
import { ServiceResult } from '@/src/types/error.types';
import { User } from '@/src/types/user.types';
import {
  handleAPIError,
  handleNetworkError,
  handleUnexpectedError,
  retryWithBackoff,
} from '@/src/utils/errorHandler';
import { supabase } from '@/src/config/supabase';

// Base API URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authentication token from Supabase
 */
async function getAuthToken(): Promise<string | null> {
  try {
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
          code: 'UNAUTHORIZED',
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
    address: apiUser.address,
    city: apiUser.city,
    country: apiUser.country,
    createdAt: new Date(apiUser.createdAt),
    updatedAt: new Date(apiUser.updatedAt),
    theme: apiUser.theme || 'auto',
    isVerified: apiUser.isVerified || false,
    verificationStatus: apiUser.verificationStatus,
    hourlyRate: apiUser.hourlyRate,
    bio: apiUser.bio,
  };
}

/**
 * Get all users (admin only)
 */
export async function getAllUsersFromAPI(
  role?: 'parent' | 'babysitter' | 'admin',
  limit: number = 100
): Promise<ServiceResult<User[]>> {
  let endpoint = `/api/admin/users?limit=${limit}`;
  if (role) {
    endpoint += `&role=${role}`;
  }

  const result = await apiRequest<any[]>(endpoint);

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: result.data.map(apiResponseToUser),
  };
}

/**
 * Get user by ID (admin only)
 */
export async function getUserByIdFromAPI(userId: string): Promise<ServiceResult<User>> {
  const result = await apiRequest<any>(`/api/admin/users/${userId}`);

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: apiResponseToUser(result.data),
  };
}

/**
 * Update user (admin only)
 */
export async function updateUserViaAPI(
  userId: string,
  updates: Partial<User>
): Promise<ServiceResult<User>> {
  // Convert User type to API request format
  const apiUpdates: any = {};
  if (updates.displayName !== undefined) apiUpdates.displayName = updates.displayName;
  if (updates.role !== undefined) apiUpdates.role = updates.role;
  if (updates.phoneNumber !== undefined) apiUpdates.phoneNumber = updates.phoneNumber;
  if (updates.profileImageUrl !== undefined) apiUpdates.profileImageUrl = updates.profileImageUrl;
  if (updates.preferredLanguage !== undefined) apiUpdates.preferredLanguage = updates.preferredLanguage;
  if (updates.theme !== undefined) apiUpdates.theme = updates.theme;
  if (updates.isVerified !== undefined) apiUpdates.isVerified = updates.isVerified;
  if (updates.verificationStatus !== undefined) apiUpdates.verificationStatus = updates.verificationStatus;
  if (updates.hourlyRate !== undefined) apiUpdates.hourlyRate = updates.hourlyRate;
  if (updates.bio !== undefined) apiUpdates.bio = updates.bio;

  const result = await apiRequest<any>(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(apiUpdates),
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: apiResponseToUser(result.data),
  };
}

/**
 * Delete user (admin only)
 */
export async function deleteUserViaAPI(userId: string): Promise<ServiceResult<void>> {
  const result = await apiRequest<void>(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  });

  return result;
}

/**
 * Get admin statistics
 */
export async function getAdminStatsFromAPI(): Promise<ServiceResult<{
  totalUsers: number;
  totalParents: number;
  totalSitters: number;
  totalAdmins: number;
  pendingVerifications: number;
  activeSessions: number;
}>> {
  const result = await apiRequest<any>('/api/admin/stats');

  return result;
}
