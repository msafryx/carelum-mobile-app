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
    
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    
    let response: Response;
    try {
      response = await retryWithBackoff(async () => {
        return fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
          },
        });
      });
    } catch (fetchError: any) {
      console.error('❌ Fetch error:', fetchError);
      throw new Error(`Network request failed: ${fetchError?.message || 'Unable to connect to server'}`);
    }

    let data: any;
    try {
      const text = await response.text();
      if (!text) {
        data = {};
      } else {
        data = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse response:', parseError);
      throw new Error('Invalid response from server');
    }

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
