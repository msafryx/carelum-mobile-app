/**
 * Session Service - REST API
 * Handles all session-related operations with real-time support
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { Session } from '@/src/types/session.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { apiRequest } from './api-base.service';
import { API_ENDPOINTS } from '@/src/config/constants';

/**
 * Create a new session request
 */
export async function createSessionRequest(
  sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ServiceResult<Session>> {
  try {
    const apiData = {
      parentId: sessionData.parentId,
      sitterId: sessionData.sitterId || undefined,
      childId: sessionData.childId,
      startTime: sessionData.startTime.toISOString(),
      endTime: sessionData.endTime ? sessionData.endTime.toISOString() : undefined,
      location: sessionData.location ? (typeof sessionData.location === 'string' ? sessionData.location : JSON.stringify(sessionData.location)) : undefined,
      hourlyRate: sessionData.hourlyRate || undefined,
      notes: sessionData.notes || undefined,
    };

    const result = await apiRequest<any>(API_ENDPOINTS.SESSIONS, {
      method: 'POST',
      body: JSON.stringify(apiData),
    });

    if (!result.success) {
      return result;
    }

    const apiSession = result.data;
    const session: Session = {
      id: apiSession.id,
      parentId: apiSession.parentId,
      sitterId: apiSession.sitterId || '',
      childId: apiSession.childId,
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      notes: apiSession.notes,
      createdAt: new Date(apiSession.createdAt),
      updatedAt: new Date(apiSession.updatedAt),
    };

    return { success: true, data: session };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get session by ID
 * INSTANT: Loads from AsyncStorage first, syncs from API in background
 */
export async function getSessionById(sessionId: string): Promise<ServiceResult<Session>> {
  try {
    // Try AsyncStorage first (instant UI)
    try {
      const { getById, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getById<any>(STORAGE_KEYS.SESSIONS, sessionId);
      if (result.success && result.data) {
        const s = result.data;
        const session: Session = {
          id: s.id,
          parentId: s.parentId,
          sitterId: s.sitterId || '',
          childId: s.childId,
          status: s.status,
          startTime: new Date(s.startTime || s.createdAt || Date.now()),
          endTime: s.endTime ? new Date(s.endTime) : undefined,
          location: s.location,
          hourlyRate: s.hourlyRate,
          totalAmount: s.totalAmount,
          notes: s.notes,
          createdAt: new Date(s.createdAt || Date.now()),
          updatedAt: new Date(s.updatedAt || Date.now()),
        };
        console.log('✅ Loaded session from AsyncStorage (instant)');
        
        // Sync from API in background (non-blocking)
        syncSessionFromAPI(sessionId).catch(() => {});
        
        return { success: true, data: session };
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to load from AsyncStorage:', localError.message);
    }

    // Fallback to API if no cache
    return syncSessionFromAPI(sessionId);
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Sync session from API and update AsyncStorage
 */
async function syncSessionFromAPI(sessionId: string): Promise<ServiceResult<Session>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_BY_ID(sessionId));

    if (!result.success) {
      return result;
    }

    const apiSession = result.data;
    const session: Session = {
      id: apiSession.id,
      parentId: apiSession.parentId,
      sitterId: apiSession.sitterId || '',
      childId: apiSession.childId,
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      notes: apiSession.notes,
      createdAt: new Date(apiSession.createdAt),
      updatedAt: new Date(apiSession.updatedAt),
    };

    // Save to AsyncStorage for next time
    try {
      const { save, STORAGE_KEYS } = await import('./local-storage.service');
      await save(STORAGE_KEYS.SESSIONS, {
        ...session,
        startTime: session.startTime.getTime(),
        endTime: session.endTime ? session.endTime.getTime() : null,
        createdAt: session.createdAt.getTime(),
        updatedAt: session.updatedAt.getTime(),
      });
      console.log('✅ Session synced from API to AsyncStorage');
    } catch (syncError: any) {
      console.warn('⚠️ Failed to sync session to AsyncStorage:', syncError.message);
    }

    return { success: true, data: session };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get sessions for a user (parent or sitter)
 * INSTANT: Loads from AsyncStorage first, syncs from API in background
 */
export async function getUserSessions(
  userId: string,
  role: 'parent' | 'sitter',
  status?: Session['status']
): Promise<ServiceResult<Session[]>> {
  try {
    // Try AsyncStorage first (instant UI)
    try {
      const { getAll, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getAll(STORAGE_KEYS.SESSIONS);
      if (result.success && result.data) {
        let userSessions = result.data.filter((s: any) => 
          role === 'parent' ? s.parentId === userId : s.sitterId === userId
        );
        
        // Apply status filter if provided
        if (status) {
          userSessions = userSessions.filter((s: any) => s.status === status);
        }
        
        if (userSessions.length > 0) {
          const sessions: Session[] = userSessions.map((s: any) => ({
            id: s.id,
            parentId: s.parentId,
            sitterId: s.sitterId || '',
            childId: s.childId,
            status: s.status,
            startTime: new Date(s.startTime || s.createdAt || Date.now()),
            endTime: s.endTime ? new Date(s.endTime) : undefined,
            location: s.location,
            hourlyRate: s.hourlyRate,
            totalAmount: s.totalAmount,
            notes: s.notes,
            createdAt: new Date(s.createdAt || Date.now()),
            updatedAt: new Date(s.updatedAt || Date.now()),
          }));
          console.log(`✅ Loaded ${sessions.length} sessions from AsyncStorage (instant)`);
          
          // Sync from API in background (non-blocking)
          syncSessionsFromAPI(userId, role, status).catch(() => {});
          
          return { success: true, data: sessions };
        }
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to load from AsyncStorage:', localError.message);
    }

    // Fallback to API if no cache
    return syncSessionsFromAPI(userId, role, status);
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Sync sessions from API and update AsyncStorage
 */
async function syncSessionsFromAPI(
  userId: string,
  role: 'parent' | 'sitter',
  status?: Session['status']
): Promise<ServiceResult<Session[]>> {
  try {
    const endpoint = status 
      ? `${API_ENDPOINTS.SESSIONS}?status=${status}`
      : API_ENDPOINTS.SESSIONS;

    const result = await apiRequest<any[]>(endpoint);

    if (!result.success) {
      return result;
    }

    const sessions: Session[] = (result.data || []).map((apiSession: any) => ({
      id: apiSession.id,
      parentId: apiSession.parentId,
      sitterId: apiSession.sitterId || '',
      childId: apiSession.childId,
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      notes: apiSession.notes,
      createdAt: new Date(apiSession.createdAt),
      updatedAt: new Date(apiSession.updatedAt),
    }));

    // Save to AsyncStorage for next time
    try {
      const { save, STORAGE_KEYS } = await import('./local-storage.service');
      for (const session of sessions) {
        await save(STORAGE_KEYS.SESSIONS, {
          ...session,
          startTime: session.startTime.getTime(),
          endTime: session.endTime ? session.endTime.getTime() : null,
          createdAt: session.createdAt.getTime(),
          updatedAt: session.updatedAt.getTime(),
        });
      }
      console.log('✅ Sessions synced from API to AsyncStorage');
    } catch (syncError: any) {
      console.warn('⚠️ Failed to sync sessions to AsyncStorage:', syncError.message);
    }

    return { success: true, data: sessions };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
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
    const updateData: any = {
      status,
    };

    if (additionalData?.endTime) {
      updateData.endTime = additionalData.endTime.toISOString();
    }
    if (additionalData?.location) {
      updateData.location = typeof additionalData.location === 'string' 
        ? additionalData.location 
        : JSON.stringify(additionalData.location);
    }
    if (additionalData?.hourlyRate !== undefined) {
      updateData.hourlyRate = additionalData.hourlyRate;
    }
    if (additionalData?.totalAmount !== undefined) {
      updateData.totalAmount = additionalData.totalAmount;
    }
    if (additionalData?.notes !== undefined) {
      updateData.notes = additionalData.notes;
    }

    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_BY_ID(sessionId), {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    if (!result.success) {
      return result;
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
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
    notes: reason,
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
    endTime: new Date(),
    notes: review,
  } as any);
}

/**
 * Cancel session
 */
export async function cancelSession(sessionId: string): Promise<ServiceResult<void>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_BY_ID(sessionId), {
      method: 'DELETE',
    });

    if (!result.success) {
      return result;
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Subscribe to session updates (real-time)
 * Uses Supabase Realtime
 */
export function subscribeToSession(
  sessionId: string,
  callback: (session: Session | null) => void
): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('⚠️ Supabase not configured, cannot subscribe to session');
    return () => {};
  }

  const channel = supabase
    .channel(`session-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      },
      async (payload: any) => {
        if (payload.eventType === 'DELETE') {
          callback(null);
        } else {
          // Fetch updated session
          const result = await getSessionById(sessionId);
          if (result.success && result.data) {
            callback(result.data);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to user's sessions (real-time)
 * Uses Supabase Realtime
 */
export function subscribeToUserSessions(
  userId: string,
  role: 'parent' | 'sitter',
  callback: (sessions: Session[]) => void
): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('⚠️ Supabase not configured, cannot subscribe to sessions');
    return () => {};
  }

  const field = role === 'parent' ? 'parent_id' : 'sitter_id';
  const channel = supabase
    .channel(`user-sessions-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `${field}=eq.${userId}`,
      },
      async () => {
        // Fetch updated sessions
        const result = await getUserSessions(userId, role);
        if (result.success && result.data) {
          callback(result.data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
