/**
 * Session Service - Supabase
 * Handles all session-related operations with real-time support
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { Session } from '@/src/types/session.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';

/**
 * Create a new session request
 */
export async function createSessionRequest(
  sessionData: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ServiceResult<Session>> {
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
      .from('sessions')
      .insert({
        parent_id: sessionData.parentId,
        sitter_id: sessionData.sitterId || null,
        child_id: sessionData.childId,
        status: sessionData.status || 'pending',
        start_time: sessionData.startTime.toISOString(),
        end_time: sessionData.endTime ? sessionData.endTime.toISOString() : null,
        location: sessionData.location || null,
        hourly_rate: sessionData.hourlyRate || null,
        total_amount: sessionData.totalAmount || null,
        notes: sessionData.notes || null,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to create session: ${error.message}`,
        },
      };
    }

    const session: Session = {
      id: data.id,
      parentId: data.parent_id,
      sitterId: data.sitter_id,
      childId: data.child_id,
      status: data.status,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      location: data.location,
      hourlyRate: data.hourly_rate,
      totalAmount: data.total_amount,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
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
 */
export async function getSessionById(sessionId: string): Promise<ServiceResult<Session>> {
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
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: {
          code: ErrorCode.DOCUMENT_NOT_FOUND,
          message: 'Session not found',
        },
      };
    }

    const session: Session = {
      id: data.id,
      parentId: data.parent_id,
      sitterId: data.sitter_id,
      childId: data.child_id,
      status: data.status,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      location: data.location,
      hourlyRate: data.hourly_rate,
      totalAmount: data.total_amount,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
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
 * Get sessions for a user (parent or sitter)
 */
export async function getUserSessions(
  userId: string,
  role: 'parent' | 'sitter',
  status?: Session['status']
): Promise<ServiceResult<Session[]>> {
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

    const field = role === 'parent' ? 'parent_id' : 'sitter_id';
    let query = supabase
      .from('sessions')
      .select('*')
      .eq(field, userId)
      .order('start_time', { ascending: false })
      .limit(50);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch sessions: ${error.message}`,
        },
      };
    }

    const sessions: Session[] = (data || []).map((row: any) => ({
      id: row.id,
      parentId: row.parent_id,
      sitterId: row.sitter_id,
      childId: row.child_id,
      status: row.status,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      location: row.location,
      hourlyRate: row.hourly_rate,
      totalAmount: row.total_amount,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

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
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    const updateData: any = {
      status,
    };

    if (additionalData?.endTime) {
      updateData.end_time = additionalData.endTime.toISOString();
    }
    if (additionalData?.location) {
      updateData.location = additionalData.location;
    }
    if (additionalData?.hourlyRate !== undefined) {
      updateData.hourly_rate = additionalData.hourlyRate;
    }
    if (additionalData?.totalAmount !== undefined) {
      updateData.total_amount = additionalData.totalAmount;
    }
    if (additionalData?.notes !== undefined) {
      updateData.notes = additionalData.notes;
    }

    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to update session: ${error.message}`,
        },
      };
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
