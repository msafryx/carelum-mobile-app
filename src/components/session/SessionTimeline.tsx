/**
 * Session Timeline Component
 * Shows session events and timeline
 */
import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Card from '@/src/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@/src/types/session.types';

interface TimelineEvent {
  id: string;
  type: 'created' | 'accepted' | 'started' | 'location' | 'cry_detected' | 'completed' | 'cancelled';
  title: string;
  description?: string;
  timestamp: Date;
  icon: keyof typeof Ionicons.glyphMap;
}

interface SessionTimelineProps {
  session: Session;
  events?: TimelineEvent[];
}

export default function SessionTimeline({ session, events = [] }: SessionTimelineProps) {
  const { colors, spacing } = useTheme();

  // Generate timeline events from session data
  const generateEvents = (): TimelineEvent[] => {
    const timeline: TimelineEvent[] = [];

    timeline.push({
      id: 'created',
      type: 'created',
      title: 'Session Requested',
      timestamp: session.createdAt,
      icon: 'calendar-outline',
    });

    if (session.status === 'accepted' || ['active', 'completed', 'cancelled'].includes(session.status)) {
      timeline.push({
        id: 'accepted',
        type: 'accepted',
        title: 'Session Accepted',
        timestamp: session.updatedAt,
        icon: 'checkmark-circle-outline',
      });
    }

    if (session.status === 'active' || session.status === 'completed') {
      timeline.push({
        id: 'started',
        type: 'started',
        title: 'Session Started',
        timestamp: session.startTime,
        icon: 'play-circle-outline',
      });
    }

    if (session.lastLocationUpdate) {
      timeline.push({
        id: 'location',
        type: 'location',
        title: 'Location Updated',
        description: 'GPS tracking active',
        timestamp: session.lastLocationUpdate,
        icon: 'location-outline',
      });
    }

    if (session.lastCryDetection) {
      timeline.push({
        id: 'cry_detected',
        type: 'cry_detected',
        title: 'Cry Detected',
        description: `${session.cryAlertsCount || 0} alert(s)`,
        timestamp: session.lastCryDetection,
        icon: 'alert-circle-outline',
      });
    }

    if (session.status === 'completed' && session.endTime) {
      timeline.push({
        id: 'completed',
        type: 'completed',
        title: 'Session Completed',
        timestamp: session.endTime,
        icon: 'checkmark-done-circle-outline',
      });
    }

    if (session.status === 'cancelled') {
      timeline.push({
        id: 'cancelled',
        type: 'cancelled',
        title: 'Session Cancelled',
        description: session.cancellationReason,
        timestamp: session.cancelledAt || session.updatedAt,
        icon: 'close-circle-outline',
      });
    }

    // Add custom events
    timeline.push(...events);

    // Sort by timestamp
    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  const timelineEvents = generateEvents();

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return colors.primary;
      case 'accepted':
        return colors.success;
      case 'started':
        return colors.success;
      case 'location':
        return colors.info;
      case 'cry_detected':
        return colors.emergency;
      case 'completed':
        return colors.success;
      case 'cancelled':
        return colors.textSecondary;
      default:
        return colors.primary;
    }
  };

  if (timelineEvents.length === 0) {
    return null;
  }

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Session Timeline</Text>
      </View>

      <View style={styles.timelineContainer}>
        {timelineEvents.map((event, index) => {
          const isLast = index === timelineEvents.length - 1;
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
                <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                {event.description && (
                  <Text style={[styles.eventDescription, { color: colors.textSecondary }]}>
                    {event.description}
                  </Text>
                )}
                <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                  {event.timestamp.toLocaleString()}
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
