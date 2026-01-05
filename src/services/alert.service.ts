/**
 * Alert Service
 * Handles alert creation and management
 */
import { ServiceResult } from '@/src/types/error.types';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/src/config/firebase';
import { handleFirestoreError, retryWithBackoff } from '@/src/utils/errorHandler';

const COLLECTION_NAME = 'alerts';

export interface Alert {
  id?: string;
  sessionId?: string;
  childId?: string;
  parentId: string;
  sitterId?: string;
  type: 'cry_detection' | 'emergency' | 'gps_anomaly' | 'session_reminder';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  status: 'new' | 'viewed' | 'acknowledged' | 'resolved';
  audioLogId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  viewedAt?: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

/**
 * Create a new alert
 */
export async function createAlert(alertData: Omit<Alert, 'id' | 'createdAt'>): Promise<ServiceResult<Alert>> {
  try {
    const alertRef = doc(collection(firestore!, COLLECTION_NAME));
    const newAlert: Alert = {
      id: alertRef.id,
      ...alertData,
      createdAt: new Date(),
    };

    await retryWithBackoff(async () => {
      await setDoc(alertRef, {
        ...newAlert,
        createdAt: Timestamp.fromDate(newAlert.createdAt),
        viewedAt: newAlert.viewedAt ? Timestamp.fromDate(newAlert.viewedAt) : null,
        acknowledgedAt: newAlert.acknowledgedAt ? Timestamp.fromDate(newAlert.acknowledgedAt) : null,
        resolvedAt: newAlert.resolvedAt ? Timestamp.fromDate(newAlert.resolvedAt) : null,
      });
    });

    return { success: true, data: newAlert };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Create cry detection alert
 */
export async function createCryDetectionAlert(
  sessionId: string,
  childId: string,
  parentId: string,
  sitterId: string,
  audioLogId: string,
  confidence: number
): Promise<ServiceResult<Alert>> {
  const severity = confidence > 0.8 ? 'critical' : confidence > 0.6 ? 'high' : 'medium';

  return createAlert({
    sessionId,
    childId,
    parentId,
    sitterId,
    type: 'cry_detection',
    severity,
    title: 'Cry Detected',
    message: `Baby crying detected with ${(confidence * 100).toFixed(0)}% confidence`,
    status: 'new',
    audioLogId,
  });
}

/**
 * Get alerts for a user
 */
export async function getUserAlerts(
  userId: string,
  status?: Alert['status']
): Promise<ServiceResult<Alert[]>> {
  try {
    let q = query(
      collection(firestore!, COLLECTION_NAME),
      where('parentId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const snapshot = await retryWithBackoff(async () => getDocs(q));
    const alerts: Alert[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      alerts.push({
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        viewedAt: data.viewedAt ? (data.viewedAt as Timestamp)?.toDate() : undefined,
        acknowledgedAt: data.acknowledgedAt
          ? (data.acknowledgedAt as Timestamp)?.toDate()
          : undefined,
        resolvedAt: data.resolvedAt ? (data.resolvedAt as Timestamp)?.toDate() : undefined,
      } as Alert);
    });

    return { success: true, data: alerts };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Mark alert as viewed
 */
export async function markAlertAsViewed(alertId: string): Promise<ServiceResult<void>> {
  try {
    const alertRef = doc(firestore!, COLLECTION_NAME, alertId);
    await retryWithBackoff(async () => {
      await updateDoc(alertRef, {
        status: 'viewed',
        viewedAt: Timestamp.now(),
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Acknowledge alert
 */
export async function acknowledgeAlert(alertId: string): Promise<ServiceResult<void>> {
  try {
    const alertRef = doc(firestore!, COLLECTION_NAME, alertId);
    await retryWithBackoff(async () => {
      await updateDoc(alertRef, {
        status: 'acknowledged',
        acknowledgedAt: Timestamp.now(),
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}
