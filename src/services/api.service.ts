import { ServiceResult, AppError } from '@/src/types/error.types';
import {
  handleAPIError,
  handleNetworkError,
  handleUnexpectedError,
  retryWithBackoff,
} from '@/src/utils/errorHandler';
import { PredictResponse, BotUpdateRequest, BotAskRequest, BotAskResponse } from '@/src/types/api.types';
import { API_ENDPOINTS } from '@/src/config/constants';

// Base API URL - should be configured via environment variable
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Generic API request function
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ServiceResult<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await retryWithBackoff(async () => {
      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
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
 * Upload audio file for cry detection prediction
 */
export async function predictCry(
  audioBlob: Blob
): Promise<ServiceResult<PredictResponse>> {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');

    const url = `${API_BASE_URL}${API_ENDPOINTS.PREDICT}`;
    const response = await retryWithBackoff(async () => {
      return fetch(url, {
        method: 'POST',
        body: formData,
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
 * Update child care instructions
 */
export async function updateInstructions(
  data: BotUpdateRequest
): Promise<ServiceResult<void>> {
  return apiRequest<void>(API_ENDPOINTS.BOT_UPDATE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Ask chatbot a question
 */
export async function askBot(
  data: BotAskRequest
): Promise<ServiceResult<BotAskResponse>> {
  return apiRequest<BotAskResponse>(API_ENDPOINTS.BOT_ASK, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
