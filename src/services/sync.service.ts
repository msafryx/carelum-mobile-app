/**
 * Sync Service
 * Handles synchronization between local database and Firebase
 */
import { ServiceResult } from '@/src/types/error.types';
import { firestore } from '@/src/config/firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { insert, update, select } from './local-db.service';
import { Session } from '@/src/types/session.types';

/**
 * Sync active session from Firebase to local
 */
export async function syncActiveSessionFromFirebase(
  sessionId: string
): Promise<ServiceResult<void>> {
  try {
    if (!firestore) {
      return {
        success: false,
        error: {
          code: 'FIREBASE_NOT_CONFIGURED',
          message: 'Firebase is not configured',
        },
      };
    }

    const sessionRef = doc(firestore, 'sessions', sessionId);
    const snapshot = await getDoc(sessionRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found in Firebase',
        },
      };
    }

    const data = snapshot.data();
    const session: Session = {
      id: snapshot.id,
      ...data,
      createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
      updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
      startTime: (data.startTime as Timestamp)?.toDate() || new Date(),
      endTime: data.endTime ? (data.endTime as Timestamp)?.toDate() : undefined,
    } as Session;

    // Save to local database
    await insert('sessions', {
      ...session,
      createdAt: session.createdAt.getTime(),
      updatedAt: session.updatedAt.getTime(),
      startTime: session.startTime.getTime(),
      endTime: session.endTime?.getTime(),
      firebaseSynced: 1,
    });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SYNC_ERROR',
        message: `Failed to sync session: ${error.message}`,
      },
    };
  }
}

/**
 * Sync local session to Firebase (only for active sessions)
 */
export async function syncSessionToFirebase(
  sessionId: string
): Promise<ServiceResult<void>> {
  try {
    if (!firestore) {
      return {
        success: false,
        error: {
          code: 'FIREBASE_NOT_CONFIGURED',
          message: 'Firebase is not configured',
        },
      };
    }

    // Get session from local database
    const result = await select<Session>('sessions', 'id = ?', [sessionId]);

    if (!result.success || !result.data || result.data.length === 0) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found in local database',
        },
      };
    }

    const session = result.data[0];

    // Only sync active sessions to Firebase
    if (session.status !== 'active') {
      return { success: true }; // Not an error, just skip
    }

    // Convert to Firebase format
    const firebaseData = {
      ...session,
      createdAt: Timestamp.fromDate(new Date(session.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(session.updatedAt)),
      startTime: Timestamp.fromDate(new Date(session.startTime)),
      endTime: session.endTime ? Timestamp.fromDate(new Date(session.endTime)) : null,
    };

    // Save to Firebase
    const sessionRef = doc(firestore, 'sessions', sessionId);
    await setDoc(sessionRef, firebaseData, { merge: true });

    // Mark as synced in local database
    await update('sessions', sessionId, { firebaseSynced: 1 });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SYNC_ERROR',
        message: `Failed to sync to Firebase: ${error.message}`,
      },
    };
  }
}

/**
 * Subscribe to real-time session updates from Firebase
 * Updates local database when Firebase changes
 */
export function subscribeToActiveSession(
  sessionId: string,
  onUpdate: (session: Session | null) => void
): () => void {
  if (!firestore) {
    console.warn('Firebase not configured, cannot subscribe');
    return () => {};
  }

  const sessionRef = doc(firestore, 'sessions', sessionId);

  const unsubscribe = onSnapshot(
    sessionRef,
    async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const session: Session = {
          id: snapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          startTime: (data.startTime as Timestamp)?.toDate() || new Date(),
          endTime: data.endTime ? (data.endTime as Timestamp)?.toDate() : undefined,
        } as Session;

        // Update local database
        await insert('sessions', {
          ...session,
          createdAt: session.createdAt.getTime(),
          updatedAt: session.updatedAt.getTime(),
          startTime: session.startTime.getTime(),
          endTime: session.endTime?.getTime(),
          firebaseSynced: 1,
        });

        onUpdate(session);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('Session subscription error:', error);
      onUpdate(null);
    }
  );

  return unsubscribe;
}

/**
 * Sync all pending changes to Firebase
 */
export async function syncPendingChanges(): Promise<ServiceResult<void>> {
  try {
    // Get all unsynced sessions
    const result = await select<Session>(
      'sessions',
      'firebaseSynced = 0 AND status = ?',
      ['active']
    );

    if (!result.success) {
      return result as any;
    }

    const unsyncedSessions = result.data || [];

    // Sync each session
    for (const session of unsyncedSessions) {
      await syncSessionToFirebase(session.id);
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SYNC_ERROR',
        message: `Failed to sync pending changes: ${error.message}`,
      },
    };
  }
}

/**
 * Initialize sync on app start
 */
export async function initializeSync(): Promise<ServiceResult<void>> {
  try {
    // Sync pending changes
    await syncPendingChanges();

    // Set up periodic sync (every 5 minutes)
    setInterval(() => {
      syncPendingChanges();
    }, 5 * 60 * 1000);

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SYNC_INIT_ERROR',
        message: `Failed to initialize sync: ${error.message}`,
      },
    };
  }
}
