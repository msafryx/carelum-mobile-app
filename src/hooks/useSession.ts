import { useState, useEffect } from 'react';
import { Session } from '@/src/types/session.types';
import { SESSION_STATUS } from '@/src/config/constants';
import { subscribeToDocument } from '@/src/services/firestore.service';
import { COLLECTIONS } from '@/src/config/constants';
import { ServiceResult } from '@/src/types/error.types';

export function useSession(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToDocument<Session>(
      COLLECTIONS.SESSIONS,
      sessionId,
      (result: ServiceResult<Session>) => {
        if (result.success && result.data) {
          setSession(result.data);
          setError(null);
        } else {
          setError(result.error?.message || 'Failed to load session');
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [sessionId]);

  const isActive = session?.status === SESSION_STATUS.ACTIVE;
  const isRequested = session?.status === SESSION_STATUS.REQUESTED;
  const isCompleted = session?.status === SESSION_STATUS.COMPLETED;
  const isCancelled = session?.status === SESSION_STATUS.CANCELLED;

  return {
    session,
    loading,
    error,
    isActive,
    isRequested,
    isCompleted,
    isCancelled,
  };
}
