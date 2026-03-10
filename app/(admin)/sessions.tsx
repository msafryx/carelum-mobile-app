import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import AdminHamburgerMenu from '@/src/components/ui/AdminHamburgerMenu';
import { useAuth } from '@/src/hooks/useAuth';
import { getUserSessions, setSessionMonitoringEnabled } from '@/src/services/session.service';
import { getSessionGPSTracking } from '@/src/services/monitoring.service';
import { getSessionAlerts } from '@/src/services/alert.service';
import { Session } from '@/src/types/session.types';
import Badge from '@/src/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

type SessionRow = {
  session: Session;
  lastLocationAt?: Date;
  lastAudioAt?: Date;
};

export default function AdminSessionsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<SessionRow[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await getUserSessions(user.id, 'parent'); // no status: backend returns all sessions for admin
      if (!res.success || !res.data) {
        setRows([]);
        return;
      }

      const sessions = res.data;
      const enriched = await Promise.all(
        sessions.map(async (s) => {
          try {
            const [gpsRes, alertsRes] = await Promise.all([
              getSessionGPSTracking(s.id),
              getSessionAlerts(s.id),
            ]);
            const lastLocationAt =
              gpsRes.success && gpsRes.data && gpsRes.data.length > 0
                ? gpsRes.data[gpsRes.data.length - 1].timestamp
                : undefined;

            const cryAlerts = (alertsRes.success && alertsRes.data ? alertsRes.data : []).filter(
              (a) => a.type === 'cry_detection'
            );
            const lastAudioAt =
              cryAlerts.length > 0
                ? cryAlerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
                : undefined;

            return { session: s, lastLocationAt, lastAudioAt };
          } catch {
            return { session: s };
          }
        })
      );
      setRows(enriched);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const activeMonitoringCount = useMemo(
    () => rows.filter((r) => r.session.monitoringEnabled).length,
    [rows]
  );
  const completedCount = useMemo(
    () => rows.filter((r) => r.session.status === 'completed').length,
    [rows]
  );
  const formatDurationBetween = (start: Date, end: Date): string => {
    const diff = end.getTime() - start.getTime();
    if (diff <= 0) return '0m';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleDisableMonitoring = async (sessionId: string) => {
    Alert.alert('Disable Monitoring', 'Disable monitoring for this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: async () => {
          const res = await setSessionMonitoringEnabled(sessionId, false);
          if (!res.success) {
            Alert.alert('Error', res.error?.message || 'Failed to disable monitoring.');
            return;
          }
          setRows((prev) =>
            prev.map((r) => (r.session.id === sessionId ? { ...r, session: res.data! } : r))
          );
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.burgerButton} onPress={() => setMenuVisible(true)}>
        <Ionicons name="menu" size={30} color={colors.text} />
      </TouchableOpacity>
      <Header showLogo={true} title="Sessions" showBack={true} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Sessions</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {rows.length}
          </Text>
          <Text style={[styles.summaryMeta, { color: colors.textSecondary }]}>
            Active with monitoring: {activeMonitoringCount} · Completed: {completedCount}
          </Text>
        </Card>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No active sessions
            </Text>
          </View>
        ) : (
          rows.map((r) => {
            const s = r.session;
            const isCompleted = s.status === 'completed';
            const monitoringLabel = s.monitoringEnabled ? 'Monitoring ACTIVE' : (isCompleted ? 'Monitoring ended' : 'Monitoring OFF');
            const durationStr = isCompleted && s.startedAt && (s.completedAt ?? s.endTime)
              ? formatDurationBetween(s.startedAt, s.completedAt ?? s.endTime!)
              : null;
            return (
              <Card key={s.id} style={styles.sessionCard}>
                <View style={styles.rowHeader}>
                  <Text style={[styles.sessionId, { color: colors.text }]} numberOfLines={1}>
                    {s.id}
                  </Text>
                  <Badge variant={isCompleted ? 'success' : s.monitoringEnabled ? 'success' : 'info'}>
                    {isCompleted ? 'Session completed' : monitoringLabel}
                  </Badge>
                </View>

                <View style={styles.metaRow}>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    Started: {s.startedAt ? formatDistanceToNow(s.startedAt, { addSuffix: true }) : '—'}
                  </Text>
                  {durationStr && (
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      Duration: {durationStr}
                    </Text>
                  )}
                </View>

                <View style={styles.metaRow}>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    Monitoring: {s.monitoringStartedAt ? formatDistanceToNow(s.monitoringStartedAt, { addSuffix: true }) : '—'}
                  </Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    Last location: {r.lastLocationAt ? formatDistanceToNow(r.lastLocationAt, { addSuffix: true }) : s.lastLocationAt ? formatDistanceToNow(s.lastLocationAt, { addSuffix: true }) : '—'}
                  </Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    Last audio: {r.lastAudioAt ? formatDistanceToNow(r.lastAudioAt, { addSuffix: true }) : s.lastAudioSignalAt ? formatDistanceToNow(s.lastAudioSignalAt, { addSuffix: true }) : '—'}
                  </Text>
                </View>

                {s.monitoringEnabled && (
                  <TouchableOpacity
                    style={[styles.disableButton, { borderColor: colors.error || '#ef4444' }]}
                    onPress={() => handleDisableMonitoring(s.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="power" size={18} color={colors.error || '#ef4444'} />
                    <Text style={[styles.disableText, { color: colors.error || '#ef4444' }]}>
                      Disable monitoring
                    </Text>
                  </TouchableOpacity>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      <AdminHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  burgerButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  content: {
    padding: 16,
    paddingTop: 90,
  },
  summaryCard: {
    marginBottom: 12,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  summaryValue: { fontSize: 32, fontWeight: '800', marginTop: 6 },
  summaryMeta: { marginTop: 6, fontSize: 14 },
  loadingContainer: { paddingVertical: 32, alignItems: 'center' },
  emptyContainer: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16 },
  sessionCard: { marginBottom: 12 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionId: { flex: 1, fontSize: 13, fontWeight: '700' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  metaText: { fontSize: 12, flex: 1 },
  disableButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disableText: { fontSize: 14, fontWeight: '700' },
});

