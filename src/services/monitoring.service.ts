/**
 * Monitoring Service - Supabase
 * Handles audio recording, cry detection, and GPS tracking
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { predictCry, predictCryFromUri } from './api.service';
import { createCryDetectionAlert } from './alert.service';

/** Cry types that warrant an alert. Other baby sounds (e.g. burping) go to history only. */
const DISTRESS_CRY_TYPES = new Set([
  'hungry', 'tired', 'discomfort', 'belly_pain', 'belly pain',
  'cold_hot', 'cold hot', 'lonely', 'scared',
]);
export function isDistressCryType(cryType: string | undefined): boolean {
  if (!cryType || typeof cryType !== 'string') return false;
  const n = cryType.toLowerCase().trim().replace(/\s+/g, '_');
  return DISTRESS_CRY_TYPES.has(n);
}
import { uploadFile, uploadFileFromUri } from './storage.service';
import { executeWrite } from './supabase-write.service';

export interface AudioLog {
  id?: string;
  sessionId: string;
  childId: string;
  audioUrl: string;
  duration: number; // in seconds
  recordedAt: Date;
  prediction?: {
    label: 'crying' | 'normal';
    confidence: number;
    processedAt: Date;
    /** AI cry reason when crying: hungry, tired, discomfort, belly pain, burping */
    cryType?: string;
  };
  alertSent?: boolean;
  alertSentAt?: Date;
  createdAt: Date;
}

export interface GPSTracking {
  id?: string;
  sessionId: string;
  sitterId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
  };
  timestamp: Date;
  batteryLevel?: number;
  isMoving?: boolean;
  speed?: number;
  createdAt: Date;
}

/** Audio input: Blob (web) or file URI (React Native – avoids Blob from ArrayBuffer) */
export type CryDetectionAudioInput = Blob | { uri: string; mimeType: string };

/**
 * Record audio and detect crying.
 * Accepts Blob or { uri, mimeType } so RN can send from file URI without creating a Blob from bytes.
 * When createAlert is false (e.g. monitoring was stopped), prediction still runs but no parent alert is created.
 */
export async function recordAndDetectCry(
  sessionId: string,
  childId: string,
  parentId: string,
  sitterId: string,
  audio: CryDetectionAudioInput,
  options?: { createAlert?: boolean }
): Promise<ServiceResult<AudioLog>> {
  const createAlert = options?.createAlert !== false;
  const isUri = typeof audio === 'object' && 'uri' in audio && typeof (audio as { uri: string }).uri === 'string';
  const uri = isUri ? (audio as { uri: string; mimeType: string }).uri : null;
  const mimeType = isUri ? (audio as { uri: string; mimeType: string }).mimeType : 'audio/wav';

  try {
    // 1. Upload audio to Storage (need a Blob; for URI we try fetch(uri).blob() to avoid new Blob([bytes]))
    let audioUrl: Awaited<ReturnType<typeof uploadFile>>;
    let durationSec = 5; // default chunk length when we don't have blob size

    if (isUri && uri) {
      const storagePath = `audio/sessions/${sessionId}/${Date.now()}.${/m4a|mp4/.test(mimeType) ? 'm4a' : 'wav'}`;
      audioUrl = await uploadFileFromUri(storagePath, uri, mimeType);
      if (audioUrl.success) durationSec = 5;
    } else {
      const blob = audio as Blob;
      durationSec = blob.size / 16000;
      try {
        audioUrl = await uploadFile(
          `audio/sessions/${sessionId}/${Date.now()}.wav`,
          blob,
          'audio/wav'
        );
      } catch (e: any) {
        return {
          success: false,
          error: {
            code: ErrorCode.UPLOAD_FAILED,
            message: `Upload failed: ${e?.message ?? 'Network or storage error'}`,
          },
        };
      }
    }

    if (!audioUrl.success || !audioUrl.data) {
      // When using URI, we may skip storage and still run prediction
      if (isUri && uri) {
        // Continue with prediction; audioUrl will be empty
      } else {
        return {
          success: false,
          error: {
            code: ErrorCode.UPLOAD_FAILED,
            message: audioUrl.error?.message ?? 'Failed to upload audio file',
          },
        };
      }
    }

    // 2. Call AI prediction endpoint (from URI or Blob)
    let prediction: Awaited<ReturnType<typeof predictCry>>;
    try {
      if (isUri && uri) {
        prediction = await predictCryFromUri(uri, mimeType);
      } else {
        prediction = await predictCry(audio as Blob);
      }
    } catch (e: any) {
      return {
        success: false,
        error: {
          code: ErrorCode.UPLOAD_FAILED,
          message: `Prediction request failed: ${e?.message ?? 'Network request failed'}`,
        },
      };
    }

    if (!prediction.success || !prediction.data) {
      return {
        success: false,
        error: {
          code: ErrorCode.UPLOAD_FAILED,
          message: prediction.error?.message ?? 'AI did not return a result. Check EXPO_PUBLIC_AI_SERVICE_URL (use your computer IP on phone).',
        },
      };
    }

    const audioLog: AudioLog = {
      sessionId,
      childId,
      audioUrl: audioUrl.success && audioUrl.data ? audioUrl.data : '',
      duration: durationSec,
      recordedAt: new Date(),
      createdAt: new Date(),
    };

    if (prediction.data) {
      audioLog.prediction = {
        label: prediction.data.label,
        confidence: prediction.data.score,
        processedAt: new Date(),
        cryType: prediction.data.cryType,
      };

      // 3. Only create alert for distress cry types when monitoring is active (createAlert true).
      if (
        createAlert &&
        prediction.data.label === 'crying' &&
        prediction.data.score > 0.6 &&
        isDistressCryType(prediction.data.cryType)
      ) {
        const alertResult = await createCryDetectionAlert(
          sessionId,
          childId,
          parentId,
          sitterId,
          'audio-log-id', // Placeholder until audio_log table is used
          prediction.data.score,
          prediction.data.cryType
        );

        if (alertResult.success && alertResult.data) {
          audioLog.alertSent = true;
          audioLog.alertSentAt = new Date();
        } else if (!alertResult.success && alertResult.error) {
          console.warn('[Cry detection] Alert could not be saved:', alertResult.error.message);
        }
      }
    }

    // Note: Audio logs can be stored in a separate table if needed
    // For now, we'll just use the alert system
    return { success: true, data: audioLog };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Update GPS location during active session
 */
export async function updateGPSLocation(
  sessionId: string,
  sitterId: string,
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
  },
  metadata?: {
    batteryLevel?: number;
    isMoving?: boolean;
    speed?: number;
  }
): Promise<ServiceResult<GPSTracking>> {
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

    const trackingData: GPSTracking = {
      sessionId,
      sitterId,
      location,
      timestamp: new Date(),
      batteryLevel: metadata?.batteryLevel,
      isMoving: metadata?.isMoving,
      speed: metadata?.speed,
      createdAt: new Date(),
    };

    // Save GPS tracking
    const insertRes = await executeWrite(() => supabase
      .from('gps_tracking')
      .insert({
        session_id: sessionId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || null,
        speed: metadata?.speed || null,
        heading: null, // Can be calculated from previous location
      })
      .select()
      .single(), 'gps_tracking_insert');

    const data = insertRes.data;
    const error = insertRes.error;

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to save GPS tracking: ${error.message || JSON.stringify(error)}`,
        },
      };
    }

    return { success: true, data: { ...trackingData, id: data.id } };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get audio logs for a session
 */
export async function getSessionAudioLogs(
  sessionId: string
): Promise<ServiceResult<AudioLog[]>> {
  // Audio logs are stored via alerts for now
  // Can be extended to use a dedicated table if needed
  return { success: true, data: [] };
}

/**
 * Get GPS tracking history for a session
 */
export async function getSessionGPSTracking(
  sessionId: string
): Promise<ServiceResult<GPSTracking[]>> {
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
      .from('gps_tracking')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch GPS tracking: ${error.message}`,
        },
      };
    }

    const tracking: GPSTracking[] = (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      sitterId: '', // Not stored in gps_tracking table
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy || undefined,
      },
      timestamp: new Date(row.created_at),
      speed: row.speed || undefined,
      createdAt: new Date(row.created_at),
    }));

    return { success: true, data: tracking };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Subscribe to GPS updates for a session (real-time)
 */
export function subscribeToGPSUpdates(
  sessionId: string,
  callback: (location: { latitude: number; longitude: number; timestamp: Date; accuracy?: number }) => void
): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('⚠️ Supabase not configured, cannot subscribe to GPS updates');
    return () => {};
  }

  const channel = supabase
    .channel(`gps-tracking-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'gps_tracking',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: any) => {
        const newLocation = payload.new;
        callback({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          timestamp: new Date(newLocation.created_at),
          accuracy: newLocation.accuracy || undefined,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
