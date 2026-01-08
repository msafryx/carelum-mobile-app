/**
 * Enhanced Alerts View Component
 * Complete alert management with push notifications, emergency alerts, history, and settings
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/src/components/ui/Card';
import Badge from '@/src/components/ui/Badge';
import {
  Alert as AlertType,
  getSessionAlerts,
  markAlertAsViewed,
  acknowledgeAlert,
  resolveAlert,
  subscribeToSessionAlerts,
} from '@/src/services/alert.service';
import { format, formatDistanceToNow } from 'date-fns';
import * as Notifications from 'expo-notifications';

interface EnhancedAlertsViewProps {
  sessionId: string;
  userId: string;
  role: 'parent' | 'sitter';
  onAlertPress?: (alert: AlertType) => void;
  onEmergencyAction?: (alert: AlertType) => void;
}

export default function EnhancedAlertsView({
  sessionId,
  userId,
  role,
  onAlertPress,
  onEmergencyAction,
}: EnhancedAlertsViewProps) {
  const { colors, spacing } = useTheme();
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'new' | 'critical' | 'cry_detection'>('all');
  const [notificationPermission, setNotificationPermission] = useState<boolean>(false);

  useEffect(() => {
    loadAlerts();
    checkNotificationPermission();
    setupNotificationListener();
    
    // Subscribe to real-time alerts
    const unsubscribe = subscribeToSessionAlerts(sessionId, (alertsList) => {
      setAlerts(alertsList);
      // Show notification for new alerts
      const newAlerts = alertsList.filter((a) => a.status === 'new');
      if (newAlerts.length > 0) {
        newAlerts.forEach((alert) => showPushNotification(alert));
      }
    });

    return unsubscribe;
  }, [sessionId]);

  const checkNotificationPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationPermission(status === 'granted');
    
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(newStatus === 'granted');
    }
  };

  const setupNotificationListener = () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  };

  const showPushNotification = async (alert: AlertType) => {
    if (!notificationPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: alert.title,
        body: alert.message,
        sound: alert.severity === 'critical' || alert.severity === 'high' ? true : false,
        priority: alert.severity === 'critical' ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
        data: { alertId: alert.id, sessionId },
      },
      trigger: null, // Show immediately
    });
  };

  const loadAlerts = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getSessionAlerts(sessionId);
      if (result.success && result.data) {
        setAlerts(result.data);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMarkAsViewed = async (alert: AlertType) => {
    if (alert.status === 'new' && alert.id) {
      try {
        await markAlertAsViewed(alert.id);
        setAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? { ...a, status: 'viewed' as const } : a))
        );
      } catch (err) {
        console.error('Failed to mark alert as viewed:', err);
      }
    }
  };

  const handleAcknowledge = async (alert: AlertType) => {
    if (alert.id) {
      try {
        await acknowledgeAlert(alert.id);
        setAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? { ...a, status: 'acknowledged' as const } : a))
        );
      } catch (err) {
        console.error('Failed to acknowledge alert:', err);
      }
    }
  };

  const handleResolve = async (alert: AlertType) => {
    if (alert.id) {
      try {
        await resolveAlert(alert.id);
        setAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? { ...a, status: 'resolved' as const } : a))
        );
      } catch (err) {
        console.error('Failed to resolve alert:', err);
      }
    }
  };

  const handleEmergencyAction = (alert: AlertType) => {
    Alert.alert(
      'Emergency Alert',
      alert.message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Emergency',
          style: 'destructive',
          onPress: () => {
            // Handle emergency call
            onEmergencyAction?.(alert);
          },
        },
        {
          text: 'Acknowledge',
          onPress: () => handleAcknowledge(alert),
        },
      ]
    );
  };

  const getSeverityColor = (severity: AlertType['severity']) => {
    switch (severity) {
      case 'critical':
        return colors.error;
      case 'high':
        return colors.warning;
      case 'medium':
        return colors.primary;
      default:
        return colors.textSecondary;
    }
  };

  const getTypeIcon = (type: AlertType['type']) => {
    switch (type) {
      case 'cry_detection':
        return 'mic';
      case 'emergency':
        return 'alert-circle';
      case 'gps_anomaly':
        return 'location';
      default:
        return 'notifications';
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'all') return true;
    if (filter === 'new') return alert.status === 'new';
    if (filter === 'critical') return alert.severity === 'critical' || alert.severity === 'high';
    if (filter === 'cry_detection') return alert.type === 'cry_detection';
    return true;
  });

  const newAlertsCount = alerts.filter((a) => a.status === 'new').length;
  const criticalAlertsCount = alerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'high'
  ).length;

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading alerts...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              {
                backgroundColor: filter === 'all' ? colors.primary : colors.backgroundSecondary,
              },
            ]}
            onPress={() => setFilter('all')}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === 'all' ? colors.white : colors.text },
              ]}
            >
              All ({alerts.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              {
                backgroundColor: filter === 'new' ? colors.primary : colors.backgroundSecondary,
              },
            ]}
            onPress={() => setFilter('new')}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === 'new' ? colors.white : colors.text },
              ]}
            >
              New ({newAlertsCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              {
                backgroundColor: filter === 'critical' ? colors.error : colors.backgroundSecondary,
              },
            ]}
            onPress={() => setFilter('critical')}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === 'critical' ? colors.white : colors.text },
              ]}
            >
              Critical ({criticalAlertsCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              {
                backgroundColor:
                  filter === 'cry_detection' ? colors.primary : colors.backgroundSecondary,
              },
            ]}
            onPress={() => setFilter('cry_detection')}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === 'cry_detection' ? colors.white : colors.text },
              ]}
            >
              Cry Detection
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Alerts List */}
      <ScrollView
        style={styles.alertsList}
        contentContainerStyle={styles.alertsContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAlerts(true)} />
        }
      >
        {filteredAlerts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="notifications-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Alerts</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {filter === 'all'
                ? 'No alerts for this session yet'
                : `No ${filter} alerts found`}
            </Text>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              style={[
                styles.alertCard,
                alert.status === 'new' && { borderLeftWidth: 4, borderLeftColor: colors.primary },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  handleMarkAsViewed(alert);
                  onAlertPress?.(alert);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.alertHeader}>
                  <View style={styles.alertHeaderLeft}>
                    <View
                      style={[
                        styles.alertIconContainer,
                        { backgroundColor: getSeverityColor(alert.severity) + '20' },
                      ]}
                    >
                      <Ionicons
                        name={getTypeIcon(alert.type) as any}
                        size={20}
                        color={getSeverityColor(alert.severity)}
                      />
                    </View>
                    <View style={styles.alertTitleContainer}>
                      <Text style={[styles.alertTitle, { color: colors.text }]}>
                        {alert.title}
                      </Text>
                      <View style={styles.alertBadges}>
                        <Badge
                          label={alert.severity}
                          variant={
                            alert.severity === 'critical' || alert.severity === 'high'
                              ? 'error'
                              : 'default'
                          }
                        />
                        {alert.status === 'new' && (
                          <Badge label="New" variant="info" />
                        )}
                      </View>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>

                <Text style={[styles.alertMessage, { color: colors.textSecondary }]}>
                  {alert.message}
                </Text>

                <View style={styles.alertFooter}>
                  <View style={styles.alertFooterLeft}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.alertTime, { color: colors.textSecondary }]}>
                      {formatDistanceToNow(alert.createdAt, { addSuffix: true })}
                    </Text>
                  </View>
                  {alert.severity === 'critical' && (
                    <TouchableOpacity
                      style={[styles.emergencyButton, { backgroundColor: colors.error }]}
                      onPress={() => handleEmergencyAction(alert)}
                    >
                      <Ionicons name="call" size={16} color={colors.white} />
                      <Text style={[styles.emergencyButtonText, { color: colors.white }]}>
                        Emergency
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Action Buttons */}
                {alert.status !== 'resolved' && (
                  <View style={styles.alertActions}>
                    {alert.status === 'new' && (
                      <TouchableOpacity
                        style={[styles.actionButton, { borderColor: colors.border }]}
                        onPress={() => handleAcknowledge(alert)}
                      >
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                          Acknowledge
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: colors.border }]}
                      onPress={() => handleResolve(alert)}
                    >
                      <Ionicons name="checkmark-done" size={18} color={colors.success} />
                      <Text style={[styles.actionButtonText, { color: colors.success }]}>
                        Resolve
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  filterContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertsList: {
    flex: 1,
  },
  alertsContent: {
    padding: 16,
    gap: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  alertCard: {
    marginBottom: 0,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitleContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  alertBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  alertMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertTime: {
    fontSize: 12,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  emergencyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
