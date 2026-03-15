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

// AI service URL (can differ from main API when AI runs on e.g. 8001)
const AI_SERVICE_URL = process.env.EXPO_PUBLIC_AI_SERVICE_URL || API_BASE_URL;

/** Known cry-type labels from baby-cry-classification model (any of these = crying) */
const CRY_TYPES = new Set(['hungry', 'tired', 'discomfort', 'belly pain', 'burping', 'belly_pain']);

/**
 * Upload audio file for cry detection prediction.
 * Calls ai_service POST /predict (field "file"); ai returns { cry_type: "hungry" | ... }.
 * We map that to { label: 'crying'|'normal', score } for the app.
 */
export async function predictCry(
  audioBlob: Blob
): Promise<ServiceResult<PredictResponse>> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');

    const url = `${AI_SERVICE_URL}${API_ENDPOINTS.PREDICT}`;
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

    // ai_service returns { cry_type: "hungry" } or { prediction, class }; normalize to app shape
    const raw = (data.cry_type ?? data.prediction ?? data.class ?? '').toString().toLowerCase().replace(/\s+/g, ' ');
    const isCrying = raw && (CRY_TYPES.has(raw) || CRY_TYPES.has(raw.replace(' ', '_')));
    const mapped: PredictResponse = isCrying
      ? { label: 'crying', score: 0.85 }
      : { label: 'normal', score: 0.3 };

    return { success: true, data: mapped };
  } catch (error: any) {
    const message = error?.message ?? '';
    if (message.includes('fetch') || message.includes('network') || message.includes('Network request failed')) {
      const url = `${AI_SERVICE_URL}${API_ENDPOINTS.PREDICT}`;
      return {
        success: false,
        error: {
          ...handleNetworkError(error),
          message: `${message} (POST ${url})`,
        },
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
