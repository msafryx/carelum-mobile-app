/**
 * Monitoring Service
 * Handles audio recording, cry detection, and GPS tracking
 */
import { ServiceResult } from '@/src/types/error.types';
import { predictCry } from './api.service';
import { createCryDetectionAlert } from './alert.service';
import { uploadFile } from './storage.service';
import {
  collection,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/src/config/firebase';
import { handleFirestoreError, retryWithBackoff } from '@/src/utils/errorHandler';

const AUDIO_LOGS_COLLECTION = 'audioLogs';
const GPS_TRACKING_COLLECTION = 'gpsTracking';

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
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload audio file',
        },
      };
    }

    // 2. Call AI prediction endpoint
    const prediction = await predictCry(audioBlob);

    if (!prediction.success || !prediction.data) {
      // Still save the log even if prediction fails
      const audioLog: AudioLog = {
        sessionId,
        childId,
        audioUrl: audioUrl.data,
        duration: audioBlob.size / 16000, // Approximate duration
        recordedAt: new Date(),
        createdAt: new Date(),
      };

      const logRef = doc(collection(firestore!, AUDIO_LOGS_COLLECTION));
      await setDoc(logRef, {
        ...audioLog,
        id: logRef.id,
        recordedAt: Timestamp.fromDate(audioLog.recordedAt),
        createdAt: Timestamp.fromDate(audioLog.createdAt),
      });

      return { success: true, data: { ...audioLog, id: logRef.id } };
    }

    // 3. Save audio log with prediction
    const audioLog: AudioLog = {
      sessionId,
      childId,
      audioUrl: audioUrl.data,
      duration: audioBlob.size / 16000,
      recordedAt: new Date(),
      prediction: {
        label: prediction.data.label,
        confidence: prediction.data.score,
        processedAt: new Date(),
      },
      createdAt: new Date(),
    };

    const logRef = doc(collection(firestore!, AUDIO_LOGS_COLLECTION));
    await setDoc(logRef, {
      ...audioLog,
      id: logRef.id,
      recordedAt: Timestamp.fromDate(audioLog.recordedAt),
      createdAt: Timestamp.fromDate(audioLog.createdAt),
      prediction: audioLog.prediction
        ? {
            ...audioLog.prediction,
            processedAt: Timestamp.fromDate(audioLog.prediction.processedAt),
          }
        : null,
    });

    // 4. If crying detected, create alert
    if (prediction.data.label === 'crying' && prediction.data.score > 0.6) {
      const alertResult = await createCryDetectionAlert(
        sessionId,
        childId,
        parentId,
        sitterId,
        logRef.id,
        prediction.data.score
      );

      if (alertResult.success) {
        // Update audio log with alert info
        await setDoc(
          logRef,
          {
            alertSent: true,
            alertSentAt: Timestamp.now(),
          },
          { merge: true }
        );
      }
    }

    return { success: true, data: { ...audioLog, id: logRef.id } };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
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

    const trackingRef = doc(collection(firestore!, GPS_TRACKING_COLLECTION));
    await retryWithBackoff(async () => {
      await setDoc(trackingRef, {
        ...trackingData,
        id: trackingRef.id,
        timestamp: Timestamp.fromDate(trackingData.timestamp),
        createdAt: Timestamp.fromDate(trackingData.createdAt),
      });
    });

    // Also update session's current location
    const sessionRef = doc(firestore!, 'sessions', sessionId);
    await retryWithBackoff(async () => {
      await setDoc(
        sessionRef,
        {
          currentLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: Timestamp.now(),
          },
          lastLocationUpdate: Timestamp.now(),
        },
        { merge: true }
      );
    });

    return { success: true, data: { ...trackingData, id: trackingRef.id } };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get audio logs for a session
 */
export async function getSessionAudioLogs(
  sessionId: string
): Promise<ServiceResult<AudioLog[]>> {
  try {
    const q = query(
      collection(firestore!, AUDIO_LOGS_COLLECTION),
      where('sessionId', '==', sessionId),
      orderBy('recordedAt', 'desc'),
      limit(100)
    );

    const snapshot = await retryWithBackoff(async () => getDocs(q));
    const logs: AudioLog[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        recordedAt: (data.recordedAt as Timestamp)?.toDate() || new Date(),
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        prediction: data.prediction
          ? {
              ...data.prediction,
              processedAt: (data.prediction.processedAt as Timestamp)?.toDate(),
            }
          : undefined,
        alertSentAt: data.alertSentAt ? (data.alertSentAt as Timestamp)?.toDate() : undefined,
      } as AudioLog);
    });

    return { success: true, data: logs };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get GPS tracking history for a session
 */
export async function getSessionGPSTracking(
  sessionId: string
): Promise<ServiceResult<GPSTracking[]>> {
  try {
    const q = query(
      collection(firestore!, GPS_TRACKING_COLLECTION),
      where('sessionId', '==', sessionId),
      orderBy('timestamp', 'asc')
    );

    const snapshot = await retryWithBackoff(async () => getDocs(q));
    const tracking: GPSTracking[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      tracking.push({
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
      } as GPSTracking);
    });

    return { success: true, data: tracking };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}
