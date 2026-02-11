/**
 * Alert Service - REST API
 * Handles alert creation and management with real-time subscriptions
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { apiRequest } from './api-base.service';
import { API_ENDPOINTS } from '@/src/config/constants';
import { executeWrite } from './supabase-write.service';

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
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    const insertRes = await executeWrite(() => supabase
      .from('alerts')
      .insert({
        session_id: alertData.sessionId || null,
        child_id: alertData.childId || null,
        parent_id: alertData.parentId,
        sitter_id: alertData.sitterId || null,
        type: alertData.type,
        severity: alertData.severity,
        title: alertData.title,
        message: alertData.message,
        status: alertData.status,
        audio_log_id: alertData.audioLogId || null,
        location: alertData.location ? JSON.stringify(alertData.location) : null,
        viewed_at: null,
        acknowledged_at: null,
        resolved_at: null,
      })
      .select()
      .single(), 'alerts_insert');

    const data = insertRes.data;
    const error = insertRes.error;

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to create alert: ${error.message || JSON.stringify(error)}`,
        },
      };
    }

    const alert: Alert = {
      id: data.id,
      sessionId: data.session_id,
      childId: data.child_id,
      parentId: data.parent_id,
      sitterId: data.sitter_id,
      type: data.type,
      severity: data.severity,
      title: data.title,
      message: data.message,
      status: data.status,
      audioLogId: data.audio_log_id,
      location: data.location ? (typeof data.location === 'string' ? JSON.parse(data.location) : data.location) : undefined,
      viewedAt: data.viewed_at ? new Date(data.viewed_at) : undefined,
      acknowledgedAt: data.acknowledged_at ? new Date(data.acknowledged_at) : undefined,
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
      createdAt: new Date(data.created_at),
    };

    return { success: true, data: alert };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
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
    const endpoint = status 
      ? `${API_ENDPOINTS.ALERTS}?status=${status}`
      : API_ENDPOINTS.ALERTS;

    const result = await apiRequest<any[]>(endpoint);

    if (!result.success) {
      return result;
    }

    const alerts: Alert[] = (result.data || []).map((apiAlert: any) => ({
      id: apiAlert.id,
      sessionId: apiAlert.sessionId,
      childId: apiAlert.childId,
      parentId: apiAlert.parentId,
      sitterId: apiAlert.sitterId,
      type: apiAlert.type,
      severity: apiAlert.severity,
      title: apiAlert.title,
      message: apiAlert.message,
      status: apiAlert.status,
      audioLogId: apiAlert.audioLogId,
      location: apiAlert.location,
      viewedAt: apiAlert.viewedAt ? new Date(apiAlert.viewedAt) : undefined,
      acknowledgedAt: apiAlert.acknowledgedAt ? new Date(apiAlert.acknowledgedAt) : undefined,
      resolvedAt: apiAlert.resolvedAt ? new Date(apiAlert.resolvedAt) : undefined,
      createdAt: new Date(apiAlert.createdAt),
    }));

    return { success: true, data: alerts };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Mark alert as viewed
 */
export async function markAlertAsViewed(alertId: string): Promise<ServiceResult<void>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.ALERT_VIEW(alertId), {
      method: 'PUT',
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
 * Acknowledge alert
 */
export async function acknowledgeAlert(alertId: string): Promise<ServiceResult<void>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.ALERT_ACKNOWLEDGE(alertId), {
      method: 'PUT',
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
 * Resolve alert
 */
export async function resolveAlert(alertId: string): Promise<ServiceResult<void>> {
  try {
    const result = await apiRequest<any>(API_ENDPOINTS.ALERT_RESOLVE(alertId), {
      method: 'PUT',
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
 * Get alerts for a session
 */
export async function getSessionAlerts(
  sessionId: string
): Promise<ServiceResult<Alert[]>> {
  try {
    const endpoint = `${API_ENDPOINTS.ALERTS}?session_id=${sessionId}`;
    const result = await apiRequest<any[]>(endpoint);

    if (!result.success) {
      return result;
    }

    const alerts: Alert[] = (result.data || []).map((apiAlert: any) => ({
      id: apiAlert.id,
      sessionId: apiAlert.sessionId,
      childId: apiAlert.childId,
      parentId: apiAlert.parentId,
      sitterId: apiAlert.sitterId,
      type: apiAlert.type,
      severity: apiAlert.severity,
      title: apiAlert.title,
      message: apiAlert.message,
      status: apiAlert.status,
      audioLogId: apiAlert.audioLogId,
      location: apiAlert.location,
      viewedAt: apiAlert.viewedAt ? new Date(apiAlert.viewedAt) : undefined,
      acknowledgedAt: apiAlert.acknowledgedAt ? new Date(apiAlert.acknowledgedAt) : undefined,
      resolvedAt: apiAlert.resolvedAt ? new Date(apiAlert.resolvedAt) : undefined,
      createdAt: new Date(apiAlert.createdAt),
    }));

    return { success: true, data: alerts };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Subscribe to session alerts (real-time)
 */
export function subscribeToSessionAlerts(
  sessionId: string,
  callback: (alerts: Alert[]) => void
): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('⚠️ Supabase not configured, cannot subscribe to alerts');
    return () => {};
  }

  // Initial load
  getSessionAlerts(sessionId).then((result) => {
    if (result.success && result.data) {
      callback(result.data);
    }
  });

  const channel = supabase
    .channel(`session-alerts-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'alerts',
        filter: `session_id=eq.${sessionId}`,
      },
      async () => {
        // Fetch updated alerts
        const result = await getSessionAlerts(sessionId);
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
