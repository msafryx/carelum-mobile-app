/**
 * Session Hook - Supabase
 * Manages session state with real-time updates
 */
import { useState, useEffect } from 'react';
import { Session } from '@/src/types/session.types';
import { SESSION_STATUS } from '@/src/config/constants';
import { getSessionById, subscribeToSession } from '@/src/services/session.service';

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

    // Load initial session
    getSessionById(sessionId).then((result) => {
      if (result.success && result.data) {
        setSession(result.data);
        setError(null);
      } else {
        setError(result.error?.message || 'Failed to load session');
      }
      setLoading(false);
    });

    // Subscribe to real-time updates
    const unsubscribe = subscribeToSession(sessionId, (updatedSession) => {
      if (updatedSession) {
        setSession(updatedSession);
        setError(null);
      } else {
        setError('Session not found');
      }
      setLoading(false);
    });

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
