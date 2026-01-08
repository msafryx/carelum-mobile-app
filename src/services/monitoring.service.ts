/**
 * Monitoring Service - Supabase
 * Handles audio recording, cry detection, and GPS tracking
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { predictCry } from './api.service';
import { createCryDetectionAlert } from './alert.service';
import { uploadFile } from './storage.service';

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

/**
 * Record audio and detect crying
 */
export async function recordAndDetectCry(
  sessionId: string,
  childId: string,
  parentId: string,
  sitterId: string,
  audioBlob: Blob
): Promise<ServiceResult<AudioLog>> {
  try {
    // 1. Upload audio to Storage
    const audioUrl = await uploadFile(
      `audio/sessions/${sessionId}/${Date.now()}.wav`,
      audioBlob,
      'audio/wav'
    );

    if (!audioUrl.success || !audioUrl.data) {
      return {
        success: false,
        error: {
          code: ErrorCode.UPLOAD_FAILED,
          message: 'Failed to upload audio file',
        },
      };
    }

    // 2. Call AI prediction endpoint
    const prediction = await predictCry(audioBlob);

    const audioLog: AudioLog = {
      sessionId,
      childId,
      audioUrl: audioUrl.data,
      duration: audioBlob.size / 16000, // Approximate duration
      recordedAt: new Date(),
      createdAt: new Date(),
    };

    if (prediction.success && prediction.data) {
      audioLog.prediction = {
        label: prediction.data.label,
        confidence: prediction.data.score,
        processedAt: new Date(),
      };

      // 3. If crying detected, create alert
      if (prediction.data.label === 'crying' && prediction.data.score > 0.6) {
        const alertResult = await createCryDetectionAlert(
          sessionId,
          childId,
          parentId,
          sitterId,
          'audio-log-id', // Will be updated after log is saved
          prediction.data.score
        );

        if (alertResult.success && alertResult.data) {
          audioLog.alertSent = true;
          audioLog.alertSentAt = new Date();
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
    const { data, error } = await supabase
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
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to save GPS tracking: ${error.message}`,
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
