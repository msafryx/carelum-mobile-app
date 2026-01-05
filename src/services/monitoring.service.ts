import { ServiceResult } from '@/src/types/error.types';
import { predictCry } from './api.service';
import { setDocument, getCollection, where, orderBy } from './firestore.service';
import { COLLECTIONS, AUDIO_CHUNK_DURATION, CRYING_THRESHOLD } from '@/src/config/constants';

export interface AudioLog {
  id?: string;
  sessionId: string;
  timestamp: Date;
  label: 'crying' | 'normal';
  score: number;
  threshold: number;
}

/**
 * Record audio chunk and get prediction
 */
export async function recordAndPredict(
  audioBlob: Blob,
  sessionId: string
): Promise<ServiceResult<AudioLog>> {
  try {
    // Send to FastAPI for prediction
    const predictionResult = await predictCry(audioBlob);
    
    if (!predictionResult.success || !predictionResult.data) {
      return {
        success: false,
        error: predictionResult.error,
      };
    }

    const { label, score } = predictionResult.data;

    // Create audio log
    const audioLog: Omit<AudioLog, 'id'> = {
      sessionId,
      timestamp: new Date(),
      label,
      score,
      threshold: CRYING_THRESHOLD,
    };

    // Store in Firestore
    const logId = `${sessionId}_${Date.now()}`;
    const storeResult = await setDocument(COLLECTIONS.AUDIO_LOGS, logId, audioLog);

    if (!storeResult.success) {
      return storeResult;
    }

    return {
      success: true,
      data: { ...audioLog, id: logId },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'AUDIO_ERROR' as any,
        message: 'Failed to record and predict audio',
      },
    };
  }
}

/**
 * Get audio logs for a session
 */
export async function getSessionAudioLogs(
  sessionId: string
): Promise<ServiceResult<AudioLog[]>> {
  return getCollection<AudioLog>(COLLECTIONS.AUDIO_LOGS, [
    where('sessionId', '==', sessionId),
    orderBy('timestamp', 'desc'),
  ]);
}
