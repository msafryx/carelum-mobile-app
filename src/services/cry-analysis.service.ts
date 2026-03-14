/**
 * Baby Cry Analysis Service — STEP 9 Mobile App Flow
 *
 * Flow:
 * 1. Parent records baby cry audio
 * 2. Audio uploaded to backend (POST /api/analyze-cry)
 * 3. Backend calls AI microservice
 * 4. AI returns cry type
 * 5. Result stored in database
 * 6. Parent receives explanation and suggested action
 *
 * UI message example (STEP 9):
 *   Possible reason: Hungry
 *   Suggested action: Feed the baby or check feeding schedule.
 */

/** Copy for cry analysis result screen */
export const CRY_ANALYSIS_UI = {
  title: 'Cry analysis',
  possibleReason: 'Possible reason',
  suggestedAction: 'Suggested action',
  tryAgain: 'Try again',
  recordPrompt: 'Record baby cry to get a possible reason.',
} as const;

import { API_ENDPOINTS } from '@/src/config/constants';
import { ServiceResult } from '@/src/types/error.types';
import { getAuthToken } from './api-base.service';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export interface AnalyzeCryResponse {
  success: boolean;
  cry_type: string;
  analysis_id?: string;
  session_id?: string;
  suggested_action?: string;
}

/** Human-readable label for cry type (e.g. "hungry" -> "Hungry") */
export function formatCryTypeLabel(cryType: string): string {
  if (!cryType) return '';
  return cryType.charAt(0).toUpperCase() + cryType.slice(1).toLowerCase();
}

/** Default suggested action if backend does not return one */
export function getDefaultSuggestedAction(cryType: string): string {
  const actions: Record<string, string> = {
    'belly pain': 'Comfort the baby, try gentle tummy massage or consult a doctor if it persists.',
    burping: 'Hold the baby upright and gently pat or rub their back to help them burp.',
    discomfort: 'Check diaper, clothing, temperature, or position. Adjust and comfort the baby.',
    hungry: 'Feed the baby or check feeding schedule.',
    tired: 'Create a calm environment, try rocking or a nap. Avoid overstimulation.',
  };
  return actions[cryType?.toLowerCase()] ?? 'Comfort the baby and check for obvious causes.';
}

/**
 * Upload baby cry audio from a Blob (e.g. from recording buffer).
 * Backend analyzes, saves to DB, and creates an alert for parent + sitter when session_id is set.
 */
export async function analyzeCryFromBlob(
  audioBlob: Blob,
  sessionId?: string | null
): Promise<ServiceResult<AnalyzeCryResponse>> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to use cry analysis.' },
      };
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    const url = `${API_BASE_URL}${API_ENDPOINTS.ANALYZE_CRY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }
    }

    if (!response.ok) {
      const err = data?.error || data?.detail?.error || data?.detail;
      const message =
        (typeof err === 'object' && err?.message) || data?.detail?.message || text || 'Analysis failed.';
      const code = (typeof err === 'object' && err?.code) || 'ANALYZE_CRY_FAILED';
      return { success: false, error: { code, message } };
    }

    return { success: true, data: data as AnalyzeCryResponse };
  } catch (e: any) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: e?.message || 'Could not reach server. Please try again.' },
    };
  }
}

/**
 * Upload baby cry audio and get AI prediction (from file URI).
 * Uses multipart/form-data; do not set Content-Type so fetch sets boundary.
 */
export async function analyzeCryAudio(
  audioUri: string,
  filename: string = 'recording.wav',
  sessionId?: string | null
): Promise<ServiceResult<AnalyzeCryResponse>> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to use cry analysis.' },
      };
    }

    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      name: filename,
      type: 'audio/wav',
    } as any);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    const url = `${API_BASE_URL}${API_ENDPOINTS.ANALYZE_CRY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Do not set Content-Type; let fetch set multipart boundary
      },
      body: formData,
    });

    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }
    }

    if (!response.ok) {
      const err = data?.error || data?.detail?.error || data?.detail;
      const message =
        (typeof err === 'object' && err?.message) || data?.detail?.message || text || 'Analysis failed.';
      const code = (typeof err === 'object' && err?.code) || 'ANALYZE_CRY_FAILED';
      return {
        success: false,
        error: { code, message },
      };
    }

    return {
      success: true,
      data: data as AnalyzeCryResponse,
    };
  } catch (e: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: e?.message || 'Could not reach server. Please try again.',
      },
    };
  }
}
