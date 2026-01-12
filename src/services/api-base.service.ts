/**
 * API Base Service
 * Shared utilities for making authenticated API requests
 */
import { ServiceResult } from '@/src/types/error.types';
import {
  handleAPIError,
  handleNetworkError,
  handleUnexpectedError,
  retryWithBackoff,
} from '@/src/utils/errorHandler';
import { supabase } from '@/src/config/supabase';

// Base API URL - should be configured via environment variable
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authentication token from Supabase
 */
export async function getAuthToken(): Promise<string | null> {
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
export async function apiRequest<T>(
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
