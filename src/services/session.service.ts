/**
 * Session Service
 * Handles all session-related Firestore operations
 */
import { ServiceResult } from '@/src/types/error.types';
import { Session } from '@/src/types/session.types';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import { firestore } from '@/src/config/firebase';
import { handleFirestoreError, retryWithBackoff } from '@/src/utils/errorHandler';

const COLLECTION_NAME = 'sessions';

/**
 * Create a new session request
 */
export async function createSessionRequest(
  sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ServiceResult<Session>> {
  try {
    const sessionRef = doc(collection(firestore!, COLLECTION_NAME));
    const newSession: Session = {
      id: sessionRef.id,
      ...sessionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await retryWithBackoff(async () => {
      await setDoc(sessionRef, {
        ...newSession,
        createdAt: Timestamp.fromDate(newSession.createdAt),
        updatedAt: Timestamp.fromDate(newSession.updatedAt),
        startTime: Timestamp.fromDate(sessionData.startTime),
        endTime: sessionData.endTime ? Timestamp.fromDate(sessionData.endTime) : null,
      });
    });

    return { success: true, data: newSession };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get session by ID
 */
export async function getSessionById(sessionId: string): Promise<ServiceResult<Session>> {
  try {
    const sessionRef = doc(firestore!, COLLECTION_NAME, sessionId);
    const snapshot = await retryWithBackoff(async () => getDoc(sessionRef));

    if (!snapshot.exists()) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      };
    }

    const data = snapshot.data();
    return {
      success: true,
      data: {
        id: snapshot.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
        startTime: (data.startTime as Timestamp)?.toDate() || new Date(),
        endTime: data.endTime ? (data.endTime as Timestamp)?.toDate() : undefined,
      } as Session,
    };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get sessions for a user (parent or sitter)
 */
export async function getUserSessions(
  userId: string,
  role: 'parent' | 'sitter',
  status?: Session['status']
): Promise<ServiceResult<Session[]>> {
  try {
    const field = role === 'parent' ? 'parentId' : 'sitterId';
    let q = query(
      collection(firestore!, COLLECTION_NAME),
      where(field, '==', userId),
      orderBy('startTime', 'desc'),
      limit(50)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const snapshot = await retryWithBackoff(async () => getDocs(q));
    const sessions: Session[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
        startTime: (data.startTime as Timestamp)?.toDate() || new Date(),
        endTime: data.endTime ? (data.endTime as Timestamp)?.toDate() : undefined,
      } as Session);
    });

    return { success: true, data: sessions };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string,
  status: Session['status'],
  additionalData?: Partial<Session>
): Promise<ServiceResult<void>> {
  try {
    const sessionRef = doc(firestore!, COLLECTION_NAME, sessionId);
    const updateData: any = {
      status,
      updatedAt: Timestamp.now(),
      ...additionalData,
    };

    if (additionalData?.endTime) {
      updateData.endTime = Timestamp.fromDate(additionalData.endTime);
    }

    await retryWithBackoff(async () => {
      await updateDoc(sessionRef, updateData);
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
 * Accept session request (sitter)
 */
export async function acceptSessionRequest(sessionId: string): Promise<ServiceResult<void>> {
  return updateSessionStatus(sessionId, 'accepted');
}

/**
 * Decline session request (sitter)
 */
export async function declineSessionRequest(
  sessionId: string,
  reason?: string
): Promise<ServiceResult<void>> {
  return updateSessionStatus(sessionId, 'cancelled', {
    cancelledBy: 'sitter',
    cancellationReason: reason,
    cancelledAt: new Date(),
  } as any);
}

/**
 * Start session (mark as active)
 */
export async function startSession(sessionId: string): Promise<ServiceResult<void>> {
  return updateSessionStatus(sessionId, 'active');
}

/**
 * Complete session
 */
export async function completeSession(
  sessionId: string,
  rating?: number,
  review?: string
): Promise<ServiceResult<void>> {
  return updateSessionStatus(sessionId, 'completed', {
    completedAt: new Date(),
    endTime: new Date(),
    parentRating: rating,
    parentReview: review,
  } as any);
}

/**
 * Subscribe to session updates (real-time)
 */
export function subscribeToSession(
  sessionId: string,
  callback: (session: Session | null) => void
): () => void {
  const sessionRef = doc(firestore!, COLLECTION_NAME, sessionId);

  const unsubscribe = onSnapshot(
    sessionRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          id: snapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          startTime: (data.startTime as Timestamp)?.toDate() || new Date(),
          endTime: data.endTime ? (data.endTime as Timestamp)?.toDate() : undefined,
        } as Session);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Session subscription error:', error);
      callback(null);
    }
  );

  return unsubscribe;
}

/**
 * Subscribe to user's sessions (real-time)
 */
export function subscribeToUserSessions(
  userId: string,
  role: 'parent' | 'sitter',
  callback: (sessions: Session[]) => void
): () => void {
  const field = role === 'parent' ? 'parentId' : 'sitterId';
  const q = query(
    collection(firestore!, COLLECTION_NAME),
    where(field, '==', userId),
    orderBy('startTime', 'desc'),
    limit(20)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const sessions: Session[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          startTime: (data.startTime as Timestamp)?.toDate() || new Date(),
          endTime: data.endTime ? (data.endTime as Timestamp)?.toDate() : undefined,
        } as Session);
      });
      callback(sessions);
    },
    (error) => {
      console.error('User sessions subscription error:', error);
      callback([]);
    }
  );

  return unsubscribe;
}
