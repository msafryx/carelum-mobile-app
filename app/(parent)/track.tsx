/**
 * Track – Live session tracking for parents
 * Shows sitter location (map), baby cry detection alerts, and monitoring status.
 * All live baby-related tracking is done here.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import EnhancedGPSMap from '@/src/components/gps/EnhancedGPSMap';
import CryDetectionIndicator from '@/src/components/session/CryDetectionIndicator';
import EmergencyCallButton from '@/src/components/session/EmergencyCallButton';
import { useAuth } from '@/src/hooks/useAuth';
import { getUserSessions } from '@/src/services/session.service';
import { getSessionById, getSessionGPSTracking, subscribeToGPSUpdates } from '@/src/services/monitoring.service';
import { getSessionAlerts, subscribeToSessionAlerts, Alert as AlertType } from '@/src/services/alert.service';
import { Session } from '@/src/types/session.types';
import { LocationUpdate } from '@/src/types/session.types';
import { SESSION_STATUS } from '@/src/config/constants';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';

function formatMonitoringDuration(startTime?: Date): string {
  if (!startTime) return '0m';
  const now = new Date();
  const diff = now.getTime() - (startTime instanceof Date ? startTime : new Date(startTime)).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function TrackScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetail, setSessionDetail] = useState<Session | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationUpdate[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveSessions = useCallback(async () => {
    if (!user) return;
    try {
      // Force API fetch so Track always shows current active sessions (not stale cache)
      const result = await getUserSessions(user.id, 'parent', SESSION_STATUS.ACTIVE, { forceRefresh: true });
      if (result.success && result.data) {
        setActiveSessions(result.data);
        if (result.data.length > 0 && !selectedSession) {
          setSelectedSession(result.data[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadSessionData = useCallback(async (sessionId: string) => {
    const [sessionRes, gpsRes, alertsRes] = await Promise.all([
      getSessionById(sessionId),
      getSessionGPSTracking(sessionId),
      getSessionAlerts(sessionId),
    ]);
    if (sessionRes.success && sessionRes.data) {
      setSessionDetail(sessionRes.data);
    }
    if (gpsRes.success && gpsRes.data && gpsRes.data.length > 0) {
      const latest = gpsRes.data[gpsRes.data.length - 1];
      setCurrentLocation({
        latitude: latest.location.latitude,
        longitude: latest.location.longitude,
        timestamp: latest.timestamp,
        accuracy: latest.location.accuracy,
      });
      setLocationHistory(
        gpsRes.data.map((t) => ({
          latitude: t.location.latitude,
          longitude: t.location.longitude,
          timestamp: t.timestamp,
          accuracy: t.location.accuracy,
        }))
      );
    } else {
      setCurrentLocation(null);
      setLocationHistory([]);
    }
    if (alertsRes.success && alertsRes.data) {
      setAlerts(alertsRes.data);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadActiveSessions();
  }, [loadActiveSessions]);

  useEffect(() => {
    if (!selectedSession?.id) {
      setSessionDetail(null);
      setCurrentLocation(null);
      setLocationHistory([]);
      setAlerts([]);
      return;
    }
    loadSessionData(selectedSession.id);
  }, [selectedSession?.id, loadSessionData]);

  // Real-time: subscribe to GPS and alerts for selected session
  useEffect(() => {
    if (!selectedSession?.id) return;
    const unsubGps = subscribeToGPSUpdates(selectedSession.id, (loc) => {
      const update: LocationUpdate = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: loc.timestamp,
        accuracy: loc.accuracy,
      };
      setCurrentLocation(update);
      setLocationHistory((prev) => [...prev.slice(-99), update]);
    });
    const unsubAlerts = subscribeToSessionAlerts(selectedSession.id, (newAlerts) => {
      setAlerts(newAlerts);
    });
    return () => {
      unsubGps();
      unsubAlerts();
    };
  }, [selectedSession?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActiveSessions();
    if (selectedSession?.id) await loadSessionData(selectedSession.id);
    setRefreshing(false);
  }, [loadActiveSessions, loadSessionData, selectedSession?.id]);

  if (!user) return null;

  const monitoringEnabled = sessionDetail?.monitoringEnabled ?? sessionDetail?.monitoring_enabled ?? false;
  const monitoringStartedAt = sessionDetail?.monitoringStartedAt ?? sessionDetail?.monitoring_started_at;
  const cryAlerts = alerts.filter((a) => a.type === 'cry_detection');
  const lastCry = cryAlerts.length > 0 ? new Date(cryAlerts[cryAlerts.length - 1].createdAt) : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        showLogo={false}
        showBack={true}
        title="Track"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={[styles.content, activeSessions.length === 0 && !loading && styles.contentEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <Card>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</Text>
            </View>
          </Card>
        ) : activeSessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon="location-outline"
              title="No active session to track"
              message="When you have an active babysitting session, you can track the sitter's location and receive cry detection alerts here."
            />
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(parent)/home')}
            >
              <Text style={styles.primaryButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <>
            {activeSessions.length > 1 && (
              <Card style={styles.selectorCard}>
                <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>Session</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {activeSessions.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.sessionChip,
                        {
                          backgroundColor: selectedSession?.id === s.id ? colors.primary + '20' : colors.border,
                          borderColor: selectedSession?.id === s.id ? colors.primary : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedSession(s)}
                    >
                      <Text style={[styles.sessionChipText, { color: colors.text }]} numberOfLines={1}>
                        {s.childId ? `Session` : 'Session'} · {format(s.startTime, 'MMM d')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Card>
            )}

            {sessionDetail && selectedSession && (
              <>
                <Card style={styles.statusCard}>
                  <View style={styles.statusRow}>
                    <Ionicons
                      name={monitoringEnabled ? 'shield-checkmark' : 'shield-outline'}
                      size={22}
                      color={monitoringEnabled ? (colors.success || colors.primary) : colors.textSecondary}
                    />
                    <Text style={[styles.statusText, { color: colors.text }]}>
                      {monitoringEnabled
                        ? `Monitoring active · ${formatMonitoringDuration(monitoringStartedAt as any)}`
                        : 'Monitoring is off'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.linkButton, { marginTop: spacing.sm }]}
                    onPress={() => router.push(`/(parent)/session/${selectedSession.id}` as any)}
                  >
                    <Text style={[styles.linkText, { color: colors.primary }]}>View full session</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </Card>

                {sessionDetail.status === 'active' && monitoringEnabled && (
                  <EnhancedGPSMap
                    sessionId={selectedSession.id}
                    currentLocation={currentLocation || undefined}
                    locationHistory={locationHistory}
                    isTracking={sessionDetail.gpsTrackingEnabled ?? (sessionDetail as any).gps_tracking_enabled}
                    geofenceCenter={
                      sessionDetail.location?.coordinates
                        ? {
                            latitude: sessionDetail.location.coordinates.latitude,
                            longitude: sessionDetail.location.coordinates.longitude,
                          }
                        : undefined
                    }
                    geofenceRadius={100}
                  />
                )}

                {sessionDetail.status === 'active' && (
                  <CryDetectionIndicator
                    isEnabled={sessionDetail.cryDetectionEnabled ?? (sessionDetail as any).cry_detection_enabled ?? false}
                    isActive={monitoringEnabled}
                    lastDetection={lastCry}
                    alertCount={cryAlerts.length}
                    recentAlerts={cryAlerts.slice(0, 5)}
                    onViewAlerts={() => router.push(`/(parent)/alerts?sessionId=${selectedSession.id}`)}
                  />
                )}

                {alerts.length > 0 && (
                  <Card style={styles.alertsCard}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent alerts</Text>
                    {alerts.slice(0, 5).map((alert) => (
                      <View key={alert.id} style={[styles.alertRow, { borderBottomColor: colors.border }]}>
                        <Ionicons
                          name={alert.type === 'cry_detection' ? 'mic' : 'warning'}
                          size={18}
                          color={alert.severity === 'critical' || alert.severity === 'high' ? (colors.emergency || '#c00') : colors.primary}
                        />
                        <View style={styles.alertBody}>
                          <Text style={[styles.alertTitle, { color: colors.text }]}>{alert.title}</Text>
                          <Text style={[styles.alertMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                            {alert.message}
                          </Text>
                          <Text style={[styles.alertTime, { color: colors.textSecondary }]}>
                            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[styles.linkButton, { marginTop: spacing.sm }]}
                      onPress={() => router.push(`/(parent)/alerts?sessionId=${selectedSession.id}`)}
                    >
                      <Text style={[styles.linkText, { color: colors.primary }]}>View all alerts</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </Card>
                )}

                <View style={styles.emergencyWrap}>
                  <EmergencyCallButton sessionId={selectedSession.id} role="parent" />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  contentEmpty: { flexGrow: 1, minHeight: 280 },
  emptyCard: { flex: 1 },
  loadingContainer: { padding: 24, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 14 },
  primaryButton: { marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  selectorCard: { marginBottom: 12 },
  selectorLabel: { fontSize: 12, marginBottom: 8 },
  sessionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  sessionChipText: { fontSize: 14 },
  statusCard: { marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 15, flex: 1 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 14, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  alertsCard: { marginTop: 12 },
  alertRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  alertBody: { flex: 1 },
  alertTitle: { fontSize: 15, fontWeight: '600' },
  alertMessage: { fontSize: 13, marginTop: 2 },
  alertTime: { fontSize: 11, marginTop: 4 },
  emergencyWrap: { marginTop: 24, alignItems: 'center' },
});
