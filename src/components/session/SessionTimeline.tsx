/**
 * Session Timeline Component
 * Shows session events from API. Parent/sitter see same timeline; admin sees admin actions too.
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Card from '@/src/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@/src/types/session.types';
import { getSessionEvents } from '@/src/services/session.service';
import { format } from 'date-fns';

const EVENT_LABELS: Record<string, string> = {
  session_requested: 'Session requested',
  session_accepted: 'Session accepted',
  session_started: 'Session started',
  monitoring_enabled: 'Monitoring enabled',
  monitoring_disabled: 'Monitoring disabled',
  cry_detected: 'Cry detected',
  session_completed: 'Session completed',
  session_cancelled: 'Session cancelled',
  admin_action: 'Admin action',
  sitter_requested_end: 'Sitter requested end',
  admin_force_end: 'Force ended by admin',
  session_time_expired: 'Session time expired',
  session_extended: 'Session extended',
  session_auto_completed: 'Session auto completed',
  emergency_contact_called: 'Emergency contact called',
};

const EVENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  session_requested: 'calendar-outline',
  session_accepted: 'checkmark-circle-outline',
  session_started: 'play-circle-outline',
  monitoring_enabled: 'mic-outline',
  monitoring_disabled: 'mic-off-outline',
  cry_detected: 'alert-circle-outline',
  session_completed: 'checkmark-done-circle-outline',
  session_cancelled: 'close-circle-outline',
  admin_action: 'shield-outline',
  sitter_requested_end: 'hand-left-outline',
  admin_force_end: 'shield-outline',
  session_time_expired: 'time-outline',
  session_extended: 'extension-puzzle-outline',
  session_auto_completed: 'checkmark-done-circle-outline',
  emergency_contact_called: 'call-outline',
};

interface DisplayEvent {
  id: string;
  type: string;
  title: string;
  timeLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface SessionTimelineProps {
  session: Session;
  /** parent | sitter: hide admin_action / admin_force_end; admin: show all */
  role?: 'parent' | 'sitter' | 'admin';
}

/** Format for session timeline: 12hr with AM/PM and date (e.g. Jan 26, 2026, 2:30 PM). */
function formatTimelineTime(iso: string): string {
  try {
    const d = new Date(iso);
    return format(d, 'MMM d, yyyy, h:mm a');
  } catch {
    return iso;
  }
}

export default function SessionTimeline({ session, role = 'parent' }: SessionTimelineProps) {
  const { colors } = useTheme();
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!session?.id) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getSessionEvents(session.id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.success || !res.data) {
        setEvents([]);
        return;
      }
      const showAdmin = role === 'admin';
      const filtered = res.data.filter(
        (e) => showAdmin || (e.type !== 'admin_action' && e.type !== 'admin_force_end')
      );
      const display: DisplayEvent[] = filtered.map((e) => ({
        id: e.id,
        type: e.type,
        title: EVENT_LABELS[e.type] ?? e.type,
        timeLabel: formatTimelineTime(e.createdAt),
        icon: EVENT_ICONS[e.type] ?? 'ellipse-outline',
      }));
      setEvents(display);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.id, role]);

  const getEventColor = (type: string): string => {
    if (type === 'cry_detected' || type === 'emergency_contact_called') return colors.emergency ?? '#dc2626';
    if (type === 'session_cancelled' || type === 'admin_force_end') return colors.textSecondary ?? '#64748b';
    if (['session_started', 'session_accepted', 'session_completed', 'monitoring_enabled'].includes(type)) {
      return colors.success ?? '#22c55e';
    }
    if (type === 'admin_action') return colors.warning ?? '#eab308';
    return colors.primary ?? '#6366f1';
  };

  if (loading) {
    return (
      <Card style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Session Timeline</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </Card>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Session Timeline</Text>
      </View>

      <View style={styles.timelineContainer}>
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          const eventColor = getEventColor(event.type);

          return (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.iconContainer, { backgroundColor: eventColor + '20' }]}>
                  <Ionicons name={event.icon} size={20} color={eventColor} />
                </View>
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.eventTitle, { color: colors.text }]}>
                  {event.timeLabel} {event.title}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  loading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  timelineContainer: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
  },
});
