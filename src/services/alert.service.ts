/**
 * Alert Service - Supabase
 * Handles alert creation and management with real-time subscriptions
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';

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

    const { data, error } = await supabase
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
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to create alert: ${error.message}`,
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
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    let query = supabase
      .from('alerts')
      .select('*')
      .eq('parent_id', userId)
      .order('created_at', { ascending: false })
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
          message: `Failed to fetch alerts: ${error.message}`,
        },
      };
    }

    const alerts: Alert[] = (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      childId: row.child_id,
      parentId: row.parent_id,
      sitterId: row.sitter_id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      status: row.status,
      audioLogId: row.audio_log_id,
      location: row.location ? (typeof row.location === 'string' ? JSON.parse(row.location) : row.location) : undefined,
      viewedAt: row.viewed_at ? new Date(row.viewed_at) : undefined,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      createdAt: new Date(row.created_at),
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
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    const { error } = await supabase
      .from('alerts')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to mark alert as viewed: ${error.message}`,
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
 * Acknowledge alert
 */
export async function acknowledgeAlert(alertId: string): Promise<ServiceResult<void>> {
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

    const { error } = await supabase
      .from('alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to acknowledge alert: ${error.message}`,
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
 * Get alerts for a session
 */
export async function getSessionAlerts(
  sessionId: string
): Promise<ServiceResult<Alert[]>> {
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
      .from('alerts')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch alerts: ${error.message}`,
        },
      };
    }

    const alerts: Alert[] = (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      childId: row.child_id,
      parentId: row.parent_id,
      sitterId: row.sitter_id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      status: row.status,
      audioLogId: row.audio_log_id,
      location: row.location ? (typeof row.location === 'string' ? JSON.parse(row.location) : row.location) : undefined,
      viewedAt: row.viewed_at ? new Date(row.viewed_at) : undefined,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      createdAt: new Date(row.created_at),
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
