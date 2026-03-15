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

/** Labels that mean "no crying" – anything else from the AI is treated as crying (allows custom models) */
const NORMAL_LABELS = new Set(['normal', 'no_cry', 'no_crying', 'silence', '']);
function isCryingLabel(raw: string): boolean {
  const s = raw.toLowerCase().trim();
  return s.length > 0 && !NORMAL_LABELS.has(s);
}

/**
 * Upload audio from a file URI for cry detection (avoids Blob from ArrayBuffer in RN).
 * Uses FormData with { uri, type, name } so the native layer reads the file.
 */
export async function predictCryFromUri(
  uri: string,
  mimeType: string,
  filename?: string
): Promise<ServiceResult<PredictResponse>> {
  const name = filename ?? (/m4a|mp4/.test(mimeType) ? 'audio.m4a' : 'audio.wav');
  const formData = new FormData();
  formData.append('file', { uri, type: mimeType, name } as any);

  const url = `${AI_SERVICE_URL}${API_ENDPOINTS.PREDICT}`;
  try {
    const response = await retryWithBackoff(async () => {
      return fetch(url, { method: 'POST', body: formData });
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: handleAPIError(data, response.status) };
    }
    const raw = (data.cry_type ?? data.prediction ?? data.class ?? '').toString().replace(/\s+/g, ' ').trim();
    const rawLower = raw.toLowerCase();
    const isCrying = isCryingLabel(rawLower);
    const confidence = typeof data.confidence_score === 'number' ? data.confidence_score : (isCrying ? 0.85 : 0.3);
    const reasonSuggested = data.reason_suggested !== false;
    const mapped: PredictResponse = isCrying
      ? { label: 'crying', score: confidence, cryType: reasonSuggested ? (raw || undefined) : undefined }
      : { label: 'normal', score: 0.3 };
    return { success: true, data: mapped };
  } catch (error: any) {
    const message = error?.message ?? '';
    if (message.includes('fetch') || message.includes('network') || message.includes('Network request failed')) {
      return {
        success: false,
        error: { ...handleNetworkError(error), message: `${message} (POST ${url})` },
      };
    }
    return { success: false, error: handleUnexpectedError(error) };
  }
}

/**
 * Upload audio file (Blob) for cry detection prediction.
 * Calls ai_service POST /predict (field "file"); ai returns { cry_type: "hungry" | ... }.
 * We map that to { label: 'crying'|'normal', score } for the app.
 */
export async function predictCry(
  audioBlob: Blob
): Promise<ServiceResult<PredictResponse>> {
  try {
    const formData = new FormData();
    const isM4a = /m4a|mp4/.test(audioBlob.type || '');
    formData.append('file', audioBlob, isM4a ? 'audio.m4a' : 'audio.wav');

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

    // Service returns { cry_type, confidence_score?, reason_suggested? }; normalize to app shape
    const raw = (data.cry_type ?? data.prediction ?? data.class ?? '').toString().replace(/\s+/g, ' ').trim();
    const rawLower = raw.toLowerCase();
    const isCrying = isCryingLabel(rawLower);
    const confidence = typeof data.confidence_score === 'number' ? data.confidence_score : (isCrying ? 0.85 : 0.3);
    const reasonSuggested = data.reason_suggested !== false;
    const mapped: PredictResponse = isCrying
      ? { label: 'crying', score: confidence, cryType: reasonSuggested ? (raw || undefined) : undefined }
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
