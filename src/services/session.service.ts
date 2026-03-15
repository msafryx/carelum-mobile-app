/**
 * Session Service - REST API
 * Handles all session-related operations with real-time support
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { Session, SessionEvent } from '@/src/types/session.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { apiRequest } from './api-base.service';
import { API_ENDPOINTS } from '@/src/config/constants';

/**
 * Helper function to parse childIds from API response
 */
function parseChildIds(apiSession: any): string[] | undefined {
  if (apiSession.childIds && Array.isArray(apiSession.childIds)) {
    return apiSession.childIds;
  }
  if (apiSession.child_ids) {
    if (Array.isArray(apiSession.child_ids)) {
      return apiSession.child_ids;
    }
    if (typeof apiSession.child_ids === 'string') {
      try {
        return JSON.parse(apiSession.child_ids);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function parseTimeSlots(apiSession: any): any[] | undefined {
  if (apiSession.timeSlots && Array.isArray(apiSession.timeSlots)) {
    return apiSession.timeSlots;
  }
  if (apiSession.time_slots) {
    if (Array.isArray(apiSession.time_slots)) {
      return apiSession.time_slots;
    }
    if (typeof apiSession.time_slots === 'string') {
      try {
        return JSON.parse(apiSession.time_slots);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

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
      childIds: sessionData.childIds || undefined, // Array of child IDs for multiple children
      status: sessionData.status || 'requested', // Include status field (required by database)
      startTime: sessionData.startTime.toISOString(),
      endTime: sessionData.endTime ? sessionData.endTime.toISOString() : undefined,
      location: sessionData.location ? (typeof sessionData.location === 'string' ? sessionData.location : JSON.stringify(sessionData.location)) : undefined,
      hourlyRate: sessionData.hourlyRate || undefined,
      notes: sessionData.notes || undefined,
      searchScope: sessionData.searchScope || undefined,
      maxDistanceKm: sessionData.maxDistanceKm || undefined,
      timeSlots: sessionData.timeSlots || undefined, // Array of time slots for multi-day sessions
    };

    console.log('📤 Creating session request:', {
      ...apiData,
      location: typeof apiData.location === 'string' ? apiData.location.substring(0, 50) + '...' : apiData.location,
    });

    const result = await apiRequest<any>(API_ENDPOINTS.SESSIONS, {
      method: 'POST',
      body: JSON.stringify(apiData),
    });

    if (!result.success) {
      console.error('❌ Session creation failed:', result.error);
    } else {
      console.log('✅ Session created successfully:', result.data?.id);
    }

    if (!result.success) {
      return result;
    }

    const apiSession = result.data;
    const session: Session = {
      id: apiSession.id,
      parentId: apiSession.parentId,
      sitterId: apiSession.sitterId || '',
      childId: apiSession.childId,
      childIds: parseChildIds(apiSession),
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      paymentStatus: apiSession.paymentStatus ?? apiSession.payment_status,
      estimatedAmount: apiSession.estimatedAmount ?? apiSession.estimated_amount,
      notes: apiSession.notes,
      searchScope: apiSession.searchScope || apiSession.search_scope,
      maxDistanceKm: apiSession.maxDistanceKm || apiSession.max_distance_km,
      timeSlots: parseTimeSlots(apiSession),
      cancelledAt: apiSession.cancelledAt ? new Date(apiSession.cancelledAt) : undefined,
      cancelledBy: apiSession.cancelledBy,
      cancellationReason: apiSession.cancellationReason,
      completedAt: apiSession.completedAt ? new Date(apiSession.completedAt) : undefined,
      endedAt: apiSession.endedAt ? new Date(apiSession.endedAt) : undefined,
      endedAt: apiSession.endedAt ? new Date(apiSession.endedAt) : undefined,
      endedAt: apiSession.endedAt ? new Date(apiSession.endedAt) : undefined,
      startedAt: (apiSession.startedAt ?? apiSession.started_at) ? new Date(apiSession.startedAt ?? apiSession.started_at) : undefined,
      monitoringEnabled: (apiSession.monitoringEnabled ?? apiSession.monitoring_enabled) ?? undefined,
      monitoringStartedAt: (apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) ? new Date(apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) : undefined,
      lastLocationAt: (apiSession.lastLocationAt ?? apiSession.last_location_at) ? new Date(apiSession.lastLocationAt ?? apiSession.last_location_at) : undefined,
      lastAudioSignalAt: (apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) ? new Date(apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) : undefined,
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
/**
 * Get timeline events for a session (parent/sitter see same; admin sees admin actions too).
 */
export async function getSessionEvents(sessionId: string): Promise<ServiceResult<SessionEvent[]>> {
  try {
    const result = await apiRequest<any[]>(API_ENDPOINTS.SESSION_EVENTS(sessionId));
    if (!result.success) return result;
    const list = Array.isArray(result.data) ? result.data : [];
    const events: SessionEvent[] = list.map((e: any) => ({
      id: e.id,
      sessionId: e.sessionId ?? e.session_id,
      type: e.type,
      triggeredBy: e.triggeredBy ?? e.triggered_by,
      createdAt: e.createdAt ?? e.created_at ?? '',
    }));
    return { success: true, data: events };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

export interface SessionReport {
  sessionId: string;
  parentId: string;
  sitterId?: string | null;
  childId: string;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
  monitoringStartedAt?: string | null;
  monitoringEnabled?: boolean | null;
  lastLocationAt?: string | null;
  lastAudioSignalAt?: string | null;
  monitoringDurationMinutes?: number | null;
  cryAlertCount: number;
  gpsPointCount: number;
  parentName?: string | null;
  sitterName?: string | null;
  childName?: string | null;
}

export async function getSessionReport(sessionId: string): Promise<ServiceResult<SessionReport>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_REPORT(sessionId));
    if (!result.success) return result;
    const data = result.data;
    return {
      success: true,
      data: {
        sessionId: data.sessionId,
        parentId: data.parentId,
        sitterId: data.sitterId,
        childId: data.childId,
        status: data.status,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        monitoringStartedAt: data.monitoringStartedAt,
        monitoringEnabled: data.monitoringEnabled,
        lastLocationAt: data.lastLocationAt,
        lastAudioSignalAt: data.lastAudioSignalAt,
        monitoringDurationMinutes: data.monitoringDurationMinutes,
        cryAlertCount: data.cryAlertCount,
        gpsPointCount: data.gpsPointCount,
        parentName: data.parentName,
        sitterName: data.sitterName,
        childName: data.childName,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

export interface EmergencyInfo {
  emergencyNumber: string;
  sitterPhone?: string | null;
  parentPhone?: string | null;
  childEmergencyContactName?: string | null;
  childEmergencyContactPhone?: string | null;
  doctorContact?: string | null;
  doctorPhone?: string | null;
}

export async function getSessionEmergencyInfo(sessionId: string): Promise<ServiceResult<EmergencyInfo>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_EMERGENCY_INFO(sessionId));
    if (!result.success) return result;
    const d = result.data;
    return {
      success: true,
      data: {
        emergencyNumber: d.emergencyNumber ?? '911',
        sitterPhone: d.sitterPhone,
        parentPhone: d.parentPhone,
        childEmergencyContactName: d.childEmergencyContactName,
        childEmergencyContactPhone: d.childEmergencyContactPhone,
        doctorContact: d.doctorContact,
        doctorPhone: d.doctorPhone,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

export async function logEmergencyCall(sessionId: string, action: string): Promise<ServiceResult<{ success: boolean; action: string }>> {
  try {
    const result = await apiRequest<{ success: boolean; action: string }>(
      API_ENDPOINTS.SESSION_EMERGENCY_CALL(sessionId),
      { method: 'POST', body: JSON.stringify({ action }) }
    );
    return result;
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

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
          childIds: s.childIds || (s.child_ids ? (Array.isArray(s.child_ids) ? s.child_ids : JSON.parse(s.child_ids)) : undefined),
          status: s.status,
          startTime: new Date(s.startTime || s.createdAt || Date.now()),
          endTime: s.endTime ? new Date(s.endTime) : undefined,
          location: s.location,
          hourlyRate: s.hourlyRate,
          totalAmount: s.totalAmount,
          paymentStatus: s.paymentStatus ?? s.payment_status,
          estimatedAmount: s.estimatedAmount ?? s.estimated_amount,
          notes: s.notes,
          searchScope: s.searchScope || s.search_scope,
          maxDistanceKm: s.maxDistanceKm || s.max_distance_km,
          timeSlots: s.timeSlots || (s.time_slots ? (Array.isArray(s.time_slots) ? s.time_slots : JSON.parse(s.time_slots)) : undefined),
          cancelledAt: s.cancelledAt ? new Date(s.cancelledAt) : undefined,
          cancelledBy: s.cancelledBy,
          cancellationReason: s.cancellationReason,
          completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
          startedAt: (s.startedAt ?? s.started_at) ? new Date(s.startedAt ?? s.started_at) : undefined,
          monitoringEnabled: (s.monitoringEnabled ?? s.monitoring_enabled) ?? undefined,
          monitoringStartedAt: (s.monitoringStartedAt ?? s.monitoring_started_at) ? new Date(s.monitoringStartedAt ?? s.monitoring_started_at) : undefined,
          lastLocationAt: (s.lastLocationAt ?? s.last_location_at) ? new Date(s.lastLocationAt ?? s.last_location_at) : undefined,
          lastAudioSignalAt: (s.lastAudioSignalAt ?? s.last_audio_signal_at) ? new Date(s.lastAudioSignalAt ?? s.last_audio_signal_at) : undefined,
          gpsTrackingEnabled: s.gpsTrackingEnabled ?? s.gps_tracking_enabled ?? (s.monitoringEnabled ?? s.monitoring_enabled) ?? undefined,
          cryDetectionEnabled: s.cryDetectionEnabled ?? s.cry_detection_enabled ?? (s.monitoringEnabled ?? s.monitoring_enabled) ?? undefined,
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
    const monitoringEnabled = apiSession.monitoringEnabled ?? apiSession.monitoring_enabled ?? undefined;
    const session: Session = {
      id: apiSession.id,
      parentId: apiSession.parentId,
      sitterId: apiSession.sitterId || '',
      childId: apiSession.childId,
      childIds: parseChildIds(apiSession),
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      paymentStatus: apiSession.paymentStatus ?? apiSession.payment_status,
      estimatedAmount: apiSession.estimatedAmount ?? apiSession.estimated_amount,
      notes: apiSession.notes,
      searchScope: apiSession.searchScope || apiSession.search_scope,
      maxDistanceKm: apiSession.maxDistanceKm || apiSession.max_distance_km,
      timeSlots: parseTimeSlots(apiSession),
      cancelledAt: apiSession.cancelledAt ? new Date(apiSession.cancelledAt) : undefined,
      cancelledBy: apiSession.cancelledBy,
      cancellationReason: apiSession.cancellationReason,
      completedAt: apiSession.completedAt ? new Date(apiSession.completedAt) : undefined,
      endedAt: apiSession.endedAt ? new Date(apiSession.endedAt) : undefined,
      startedAt: (apiSession.startedAt ?? apiSession.started_at) ? new Date(apiSession.startedAt ?? apiSession.started_at) : undefined,
      monitoringEnabled,
      monitoringStartedAt: (apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) ? new Date(apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) : undefined,
      lastLocationAt: (apiSession.lastLocationAt ?? apiSession.last_location_at) ? new Date(apiSession.lastLocationAt ?? apiSession.last_location_at) : undefined,
      lastAudioSignalAt: (apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) ? new Date(apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) : undefined,
      gpsTrackingEnabled: apiSession.gpsTrackingEnabled ?? apiSession.gps_tracking_enabled ?? monitoringEnabled ?? undefined,
      cryDetectionEnabled: apiSession.cryDetectionEnabled ?? apiSession.cry_detection_enabled ?? monitoringEnabled ?? undefined,
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
/** Single status or comma-separated list for API filter (e.g. "accepted,payment_pending,booked") */
export type SessionStatusFilter = Session['status'] | string;

export async function getUserSessions(
  userId: string,
  role: 'parent' | 'sitter',
  status?: SessionStatusFilter,
  options?: { forceRefresh?: boolean }
): Promise<ServiceResult<Session[]>> {
  try {
    // When forceRefresh (e.g. Track screen), skip cache and always fetch from API
    if (options?.forceRefresh) {
      return syncSessionsFromAPI(userId, role, status);
    }

    // Try AsyncStorage first (instant UI)
    try {
      const { getAll, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getAll(STORAGE_KEYS.SESSIONS);
      if (result.success && result.data) {
        let userSessions = result.data.filter((s: any) =>
          role === 'parent' ? s.parentId === userId : s.sitterId === userId
        );

        // Apply status filter if provided (comma-separated = any of)
        if (status) {
          const statusList = typeof status === 'string' && status.includes(',')
            ? status.split(',').map((s) => s.trim())
            : [status];
          userSessions = userSessions.filter((s: any) => statusList.includes(s.status));
        }
        
        if (userSessions.length > 0) {
          const sessions: Session[] = userSessions.map((s: any) => {
            const monitoringEnabled = (s.monitoringEnabled ?? s.monitoring_enabled) ?? undefined;
            return {
              id: s.id,
              parentId: s.parentId,
              sitterId: s.sitterId || '',
              childId: s.childId,
              childIds: s.childIds || (s.child_ids ? (Array.isArray(s.child_ids) ? s.child_ids : JSON.parse(s.child_ids)) : undefined),
              status: s.status,
              startTime: new Date(s.startTime || s.createdAt || Date.now()),
              endTime: s.endTime ? new Date(s.endTime) : undefined,
              location: s.location,
              hourlyRate: s.hourlyRate,
              totalAmount: s.totalAmount,
              paymentStatus: s.paymentStatus ?? s.payment_status,
              estimatedAmount: s.estimatedAmount ?? s.estimated_amount,
              notes: s.notes,
              searchScope: s.searchScope || s.search_scope,
              maxDistanceKm: s.maxDistanceKm || s.max_distance_km,
              timeSlots: s.timeSlots || (s.time_slots ? (Array.isArray(s.time_slots) ? s.time_slots : JSON.parse(s.time_slots)) : undefined),
              monitoringEnabled,
              monitoringStartedAt: (s.monitoringStartedAt ?? s.monitoring_started_at) ? new Date(s.monitoringStartedAt ?? s.monitoring_started_at) : undefined,
              gpsTrackingEnabled: s.gpsTrackingEnabled ?? s.gps_tracking_enabled ?? monitoringEnabled ?? undefined,
              cryDetectionEnabled: s.cryDetectionEnabled ?? s.cry_detection_enabled ?? monitoringEnabled ?? undefined,
              createdAt: new Date(s.createdAt || Date.now()),
              updatedAt: new Date(s.updatedAt || Date.now()),
            };
          });
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
  status?: SessionStatusFilter
): Promise<ServiceResult<Session[]>> {
  try {
    const endpoint = status
      ? `${API_ENDPOINTS.SESSIONS}?status=${encodeURIComponent(status)}`
      : API_ENDPOINTS.SESSIONS;

    const result = await apiRequest<any[]>(endpoint);

    if (!result.success) {
      return result;
    }

    const sessions: Session[] = (result.data || []).map((apiSession: any) => {
      const monitoringEnabled = (apiSession.monitoringEnabled ?? apiSession.monitoring_enabled) ?? undefined;
      return {
        id: apiSession.id,
        parentId: apiSession.parentId,
        sitterId: apiSession.sitterId || '',
        childId: apiSession.childId,
        childIds: parseChildIds(apiSession),
        status: apiSession.status,
        startTime: new Date(apiSession.startTime),
        endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
        location: apiSession.location,
        hourlyRate: apiSession.hourlyRate,
        totalAmount: apiSession.totalAmount,
        paymentStatus: apiSession.paymentStatus ?? apiSession.payment_status,
        estimatedAmount: apiSession.estimatedAmount ?? apiSession.estimated_amount,
        notes: apiSession.notes,
        searchScope: apiSession.searchScope || apiSession.search_scope,
        maxDistanceKm: apiSession.maxDistanceKm || apiSession.max_distance_km,
        timeSlots: parseTimeSlots(apiSession),
        cancelledAt: apiSession.cancelledAt ? new Date(apiSession.cancelledAt) : undefined,
        cancelledBy: apiSession.cancelledBy,
        cancellationReason: apiSession.cancellationReason,
        completedAt: apiSession.completedAt ? new Date(apiSession.completedAt) : undefined,
        endedAt: apiSession.endedAt ? new Date(apiSession.endedAt) : undefined,
        startedAt: (apiSession.startedAt ?? apiSession.started_at) ? new Date(apiSession.startedAt ?? apiSession.started_at) : undefined,
        monitoringEnabled,
        monitoringStartedAt: (apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) ? new Date(apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) : undefined,
        lastLocationAt: (apiSession.lastLocationAt ?? apiSession.last_location_at) ? new Date(apiSession.lastLocationAt ?? apiSession.last_location_at) : undefined,
        lastAudioSignalAt: (apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) ? new Date(apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) : undefined,
        gpsTrackingEnabled: apiSession.gpsTrackingEnabled ?? apiSession.gps_tracking_enabled ?? monitoringEnabled ?? undefined,
        cryDetectionEnabled: apiSession.cryDetectionEnabled ?? apiSession.cry_detection_enabled ?? monitoringEnabled ?? undefined,
        createdAt: new Date(apiSession.createdAt),
        updatedAt: new Date(apiSession.updatedAt),
      };
    });

    // Save to AsyncStorage and remove deleted sessions
    try {
      const { save, getAll, remove, STORAGE_KEYS } = await import('./local-storage.service');
      
      // Get all current sessions from AsyncStorage for this user
      const allCachedResult = await getAll(STORAGE_KEYS.SESSIONS);
      if (allCachedResult.success && allCachedResult.data) {
        // Filter to get only this user's sessions
        const userCachedSessions = allCachedResult.data.filter((s: any) => 
          role === 'parent' ? s.parentId === userId : s.sitterId === userId
        );
        
        // Get IDs of sessions from API (these are the ones that should exist)
        const apiSessionIds = new Set(sessions.map(s => s.id));
        
        // Remove sessions from cache that are no longer in the API response (deleted from DB)
        for (const cachedSession of userCachedSessions) {
          if (!apiSessionIds.has(cachedSession.id)) {
            console.log('🗑️ Removing deleted session from cache:', cachedSession.id);
            await remove(STORAGE_KEYS.SESSIONS, cachedSession.id);
          }
        }
      }
      
      // Save/update sessions from API
      for (const session of sessions) {
        await save(STORAGE_KEYS.SESSIONS, {
          ...session,
          startTime: session.startTime.getTime(),
          endTime: session.endTime ? session.endTime.getTime() : null,
          createdAt: session.createdAt.getTime(),
          updatedAt: session.updatedAt.getTime(),
          timeSlots: session.timeSlots || undefined,
        });
      }
      console.log('✅ Sessions synced from API to AsyncStorage (removed deleted sessions)');
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
  return cancelSession(sessionId, reason);
}

/**
 * Start session (sitter only). Transitions BOOKED → LIVE. Idempotent.
 * Uses dedicated POST /sessions/:id/start for started_at and timeline event.
 */
export async function startSession(sessionId: string): Promise<ServiceResult<Session>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_START(sessionId), {
      method: 'POST',
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
      childIds: parseChildIds(apiSession),
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      paymentStatus: apiSession.paymentStatus ?? apiSession.payment_status,
      estimatedAmount: apiSession.estimatedAmount ?? apiSession.estimated_amount,
      notes: apiSession.notes,
      searchScope: apiSession.searchScope || apiSession.search_scope,
      maxDistanceKm: apiSession.maxDistanceKm || apiSession.max_distance_km,
      timeSlots: parseTimeSlots(apiSession),
      expiresAt: apiSession.expiresAt ? new Date(apiSession.expiresAt) : undefined,
      cancelledAt: apiSession.cancelledAt ? new Date(apiSession.cancelledAt) : undefined,
      cancelledBy: apiSession.cancelledBy,
      cancellationReason: apiSession.cancellationReason,
      completedAt: apiSession.completedAt ? new Date(apiSession.completedAt) : undefined,
      startedAt: (apiSession.startedAt ?? apiSession.started_at) ? new Date(apiSession.startedAt ?? apiSession.started_at) : undefined,
      monitoringEnabled: (apiSession.monitoringEnabled ?? apiSession.monitoring_enabled) ?? undefined,
      monitoringStartedAt: (apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) ? new Date(apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) : undefined,
      lastLocationAt: (apiSession.lastLocationAt ?? apiSession.last_location_at) ? new Date(apiSession.lastLocationAt ?? apiSession.last_location_at) : undefined,
      lastAudioSignalAt: (apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) ? new Date(apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) : undefined,
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
 * Enable/disable monitoring (separate from session start).
 * Backend enforces: session must be active; sitter-only (admin can only disable).
 */
export async function setSessionMonitoringEnabled(
  sessionId: string,
  enabled: boolean
): Promise<ServiceResult<Session>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_MONITORING(sessionId), {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });

    if (!result.success) return result;

    const apiSession = result.data;
    const mon = (apiSession.monitoringEnabled ?? apiSession.monitoring_enabled) ?? undefined;
    const session: Session = {
      id: apiSession.id,
      parentId: apiSession.parentId,
      sitterId: apiSession.sitterId || '',
      childId: apiSession.childId,
      childIds: parseChildIds(apiSession),
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      paymentStatus: apiSession.paymentStatus ?? apiSession.payment_status,
      estimatedAmount: apiSession.estimatedAmount ?? apiSession.estimated_amount,
      notes: apiSession.notes,
      searchScope: apiSession.searchScope || apiSession.search_scope,
      maxDistanceKm: apiSession.maxDistanceKm || apiSession.max_distance_km,
      timeSlots: parseTimeSlots(apiSession),
      expiresAt: apiSession.expiresAt ? new Date(apiSession.expiresAt) : undefined,
      cancelledAt: apiSession.cancelledAt ? new Date(apiSession.cancelledAt) : undefined,
      cancelledBy: apiSession.cancelledBy,
      cancellationReason: apiSession.cancellationReason,
      completedAt: apiSession.completedAt ? new Date(apiSession.completedAt) : undefined,
      startedAt: (apiSession.startedAt ?? apiSession.started_at) ? new Date(apiSession.startedAt ?? apiSession.started_at) : undefined,
      monitoringEnabled: mon,
      monitoringStartedAt: (apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) ? new Date(apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) : undefined,
      lastLocationAt: (apiSession.lastLocationAt ?? apiSession.last_location_at) ? new Date(apiSession.lastLocationAt ?? apiSession.last_location_at) : undefined,
      lastAudioSignalAt: (apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) ? new Date(apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) : undefined,
      gpsTrackingEnabled: apiSession.gpsTrackingEnabled ?? apiSession.gps_tracking_enabled ?? mon ?? undefined,
      cryDetectionEnabled: apiSession.cryDetectionEnabled ?? apiSession.cry_detection_enabled ?? mon ?? undefined,
      createdAt: new Date(apiSession.createdAt),
      updatedAt: new Date(apiSession.updatedAt),
    };

    return { success: true, data: session };
  } catch (error: any) {
    return { success: false, error: handleUnexpectedError(error) };
  }
}

/**
 * End session (sitter or admin). POST /api/sessions/{id}/end.
 * Returns updated session. Parent cannot end (backend returns 403).
 */
export async function endSession(sessionId: string): Promise<ServiceResult<Session>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_END(sessionId), {
      method: 'POST',
    });
    if (!result.success) return result;
    const apiSession = result.data;
    const session: Session = {
      id: apiSession.id,
      parentId: apiSession.parentId,
      sitterId: apiSession.sitterId || '',
      childId: apiSession.childId,
      childIds: parseChildIds(apiSession),
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      paymentStatus: apiSession.paymentStatus ?? apiSession.payment_status,
      estimatedAmount: apiSession.estimatedAmount ?? apiSession.estimated_amount,
      notes: apiSession.notes,
      searchScope: apiSession.searchScope || apiSession.search_scope,
      maxDistanceKm: apiSession.maxDistanceKm || apiSession.max_distance_km,
      timeSlots: parseTimeSlots(apiSession),
      expiresAt: apiSession.expiresAt ? new Date(apiSession.expiresAt) : undefined,
      cancelledAt: apiSession.cancelledAt ? new Date(apiSession.cancelledAt) : undefined,
      cancelledBy: apiSession.cancelledBy,
      cancellationReason: apiSession.cancellationReason,
      completedAt: apiSession.completedAt ? new Date(apiSession.completedAt) : undefined,
      startedAt: (apiSession.startedAt ?? apiSession.started_at) ? new Date(apiSession.startedAt ?? apiSession.started_at) : undefined,
      monitoringEnabled: (apiSession.monitoringEnabled ?? apiSession.monitoring_enabled) ?? undefined,
      monitoringStartedAt: (apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) ? new Date(apiSession.monitoringStartedAt ?? apiSession.monitoring_started_at) : undefined,
      lastLocationAt: (apiSession.lastLocationAt ?? apiSession.last_location_at) ? new Date(apiSession.lastLocationAt ?? apiSession.last_location_at) : undefined,
      lastAudioSignalAt: (apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) ? new Date(apiSession.lastAudioSignalAt ?? apiSession.last_audio_signal_at) : undefined,
      createdAt: new Date(apiSession.createdAt),
      updatedAt: new Date(apiSession.updatedAt),
    };
    return { success: true, data: session };
  } catch (error: any) {
    return { success: false, error: handleUnexpectedError(error) };
  }
}

/**
 * Complete session (alias for endSession). Returns updated session so caller can show charged amount.
 */
export async function completeSession(
  sessionId: string,
  _rating?: number,
  _review?: string
): Promise<ServiceResult<Session>> {
  return endSession(sessionId);
}

/**
 * Sitter request to end session (no status change; notifies parent).
 */
export async function requestSessionEnd(sessionId: string): Promise<ServiceResult<void>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_REQUEST_END(sessionId), {
      method: 'POST',
    });
    if (!result.success) return result;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: handleUnexpectedError(error) };
  }
}

/**
 * Cancel session (Uber-like: with reason tracking)
 */
export async function cancelSession(
  sessionId: string,
  reason?: string
): Promise<ServiceResult<void>> {
  try {
    const url = reason
      ? `${API_ENDPOINTS.SESSION_BY_ID(sessionId)}?reason=${encodeURIComponent(reason)}`
      : API_ENDPOINTS.SESSION_BY_ID(sessionId);
    
    const result = await apiRequest<any>(url, {
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
 * Discover available sessions for sitters (Uber-like discovery)
 */
export async function discoverAvailableSessions(
  scope?: 'invite' | 'nearby' | 'city' | 'nationwide',
  maxDistance?: number,
  sitterCity?: string
): Promise<ServiceResult<Session[]>> {
  try {
    let endpoint = `${API_ENDPOINTS.SESSIONS}/discover/available`;
    const params = new URLSearchParams();
    
    if (scope) {
      params.append('scope', scope);
    }
    if (maxDistance) {
      params.append('max_distance', maxDistance.toString());
    }
    if (sitterCity) {
      params.append('sitter_city', sitterCity);
    }
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const result = await apiRequest<any[]>(endpoint);

    if (!result.success) {
      return result;
    }

      const sessions: Session[] = (result.data || []).map((apiSession: any) => ({
      id: apiSession.id,
      parentId: apiSession.parentId,
      sitterId: apiSession.sitterId || '',
      childId: apiSession.childId,
      childIds: parseChildIds(apiSession),
      status: apiSession.status,
      startTime: new Date(apiSession.startTime),
      endTime: apiSession.endTime ? new Date(apiSession.endTime) : undefined,
      location: apiSession.location,
      hourlyRate: apiSession.hourlyRate,
      totalAmount: apiSession.totalAmount,
      paymentStatus: apiSession.paymentStatus ?? apiSession.payment_status,
      estimatedAmount: apiSession.estimatedAmount ?? apiSession.estimated_amount,
      notes: apiSession.notes,
      searchScope: apiSession.searchScope || apiSession.search_scope,
      maxDistanceKm: apiSession.maxDistanceKm || apiSession.max_distance_km,
      timeSlots: parseTimeSlots(apiSession),
      expiresAt: apiSession.expiresAt ? new Date(apiSession.expiresAt) : undefined,
      cancelledAt: apiSession.cancelledAt ? new Date(apiSession.cancelledAt) : undefined,
      cancelledBy: apiSession.cancelledBy,
      cancellationReason: apiSession.cancellationReason,
      completedAt: apiSession.completedAt ? new Date(apiSession.completedAt) : undefined,
      startedAt: (apiSession.startedAt ?? apiSession.started_at) ? new Date(apiSession.startedAt ?? apiSession.started_at) : undefined,
      createdAt: new Date(apiSession.createdAt),
      updatedAt: new Date(apiSession.updatedAt),
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

/**
 * Subscribe to available session requests (status = 'requested') for sitter feed.
 * Do NOT filter by distance/city at DB level; filter client-side after refetch.
 * Callback is called on INSERT/UPDATE/DELETE so the feed can refetch and filter
 * (INVITED → sitter_id match, NEARBY/CITY/NATIONWIDE filtered client-side).
 */
export function subscribeToAvailableRequests(callback: () => void): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('⚠️ Supabase not configured, cannot subscribe to available requests');
    return () => {};
  }

  const channel = supabase
    .channel('available-requests-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: 'status=eq.requested',
      },
      () => {
        callback();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
