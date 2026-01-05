import { ServiceResult } from '@/src/types/error.types';
import { Session, SessionStatus } from '@/src/types/session.types';
import { COLLECTIONS, SESSION_STATUS } from '@/src/config/constants';
import {
  getDocument,
  setDocument,
  updateDocument,
  getCollection,
  where,
  orderBy,
  subscribeToDocument,
  subscribeToCollection,
} from './firestore.service';

/**
 * Create a new session request
 */
export async function createSessionRequest(
  parentId: string,
  babysitterId: string
): Promise<ServiceResult<Session>> {
  try {
    const sessionData: Omit<Session, 'id'> = {
      parentId,
      babysitterId,
      status: SESSION_STATUS.REQUESTED,
      createdAt: new Date(),
    };

    // Generate session ID
    const sessionId = `${parentId}_${babysitterId}_${Date.now()}`;
    
    const result = await setDocument(COLLECTIONS.SESSIONS, sessionId, sessionData);
    
    if (!result.success) {
      return result;
    }

    const sessionResult = await getDocument<Session>(COLLECTIONS.SESSIONS, sessionId);
    return sessionResult;
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR' as any,
        message: 'Failed to create session request',
      },
    };
  }
}

/**
 * Accept a session request
 */
export async function acceptSession(sessionId: string): Promise<ServiceResult<void>> {
  return updateDocument(COLLECTIONS.SESSIONS, sessionId, {
    status: SESSION_STATUS.ACTIVE,
    startTime: new Date(),
  });
}

/**
 * Decline a session request
 */
export async function declineSession(sessionId: string): Promise<ServiceResult<void>> {
  return updateDocument(COLLECTIONS.SESSIONS, sessionId, {
    status: SESSION_STATUS.CANCELLED,
  });
}

/**
 * End an active session
 */
export async function endSession(sessionId: string): Promise<ServiceResult<void>> {
  return updateDocument(COLLECTIONS.SESSIONS, sessionId, {
    status: SESSION_STATUS.COMPLETED,
    endTime: new Date(),
  });
}

/**
 * Get sessions for a user
 */
export async function getUserSessions(
  userId: string,
  role: 'parent' | 'babysitter'
): Promise<ServiceResult<Session[]>> {
  const field = role === 'parent' ? 'parentId' : 'babysitterId';
  return getCollection<Session>(COLLECTIONS.SESSIONS, [
    where(field, '==', userId),
    orderBy('createdAt', 'desc'),
  ]);
}

/**
 * Subscribe to session updates
 */
export function subscribeToSession(
  sessionId: string,
  callback: (result: ServiceResult<Session>) => void
): () => void {
  return subscribeToDocument<Session>(COLLECTIONS.SESSIONS, sessionId, callback);
}

/**
 * Subscribe to user sessions
 */
export function subscribeToUserSessions(
  userId: string,
  role: 'parent' | 'babysitter',
  callback: (result: ServiceResult<Session[]>) => void
): () => void {
  const field = role === 'parent' ? 'parentId' : 'babysitterId';
  return subscribeToCollection<Session>(
    COLLECTIONS.SESSIONS,
    [where(field, '==', userId), orderBy('createdAt', 'desc')],
    callback
  );
}
