/**
 * AlertsList Component
 * Displays a list of alerts with filtering and actions
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Alert as AlertType, getUserAlerts, markAlertAsViewed, acknowledgeAlert, resolveAlert } from '@/src/services/alert.service';
import { format, formatDistanceToNow } from 'date-fns';

interface AlertsListProps {
  userId: string;
  sessionId?: string;
  onAlertPress?: (alert: AlertType) => void;
  showActions?: boolean;
  onAlertsChange?: (hasAlerts: boolean) => void;
}

export default function AlertsList({
  userId,
  sessionId,
  onAlertPress,
  showActions = true,
  onAlertsChange,
}: AlertsListProps) {
  const { colors } = useTheme();
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AlertType['status'] | 'all'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadAlerts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // If sessionId is provided, get session alerts
      // Otherwise, get user alerts
      let result;
      if (sessionId) {
        const { getSessionAlerts } = await import('@/src/services/alert.service');
        result = await getSessionAlerts(sessionId);
      } else {
        result = await getUserAlerts(userId);
      }

      if (result.success && result.data) {
        // Sort by creation time (newest first)
        const sortedAlerts = [...result.data].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        setAlerts(sortedAlerts);
        onAlertsChange?.(sortedAlerts.length > 0);
      } else {
        setAlerts([]);
        onAlertsChange?.(false);
      }
    } catch (error: any) {
      console.error('Failed to load alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, sessionId]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleView = async (alert: AlertType) => {
    if (!alert.id) return;
    setProcessingId(alert.id);
    try {
      await markAlertAsViewed(alert.id);
      loadAlerts(true);
    } catch (error: any) {
      console.error('Failed to mark alert as viewed:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcknowledge = async (alert: AlertType) => {
    if (!alert.id) return;
    setProcessingId(alert.id);
    try {
      await acknowledgeAlert(alert.id);
      loadAlerts(true);
    } catch (error: any) {
      console.error('Failed to acknowledge alert:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResolve = async (alert: AlertType) => {
    if (!alert.id) return;
    setProcessingId(alert.id);
    try {
      await resolveAlert(alert.id);
      loadAlerts(true);
    } catch (error: any) {
      console.error('Failed to resolve alert:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getAlertIcon = (type: AlertType['type']) => {
    switch (type) {
      case 'cry_detection':
        return 'volume-high';
      case 'emergency':
        return 'warning';
      case 'gps_anomaly':
        return 'location';
      case 'session_reminder':
        return 'notifications';
      default:
        return 'alert-circle';
    }
  };

  const getSeverityColor = (severity: AlertType['severity']) => {
    switch (severity) {
      case 'critical':
        return colors.error || '#ef4444';
      case 'high':
        return colors.warning || '#f59e0b';
      case 'medium':
        return colors.info || '#3b82f6';
      case 'low':
        return colors.success || '#10b981';
      default:
        return colors.textSecondary;
    }
  };

  const getStatusColor = (status: AlertType['status']) => {
    switch (status) {
      case 'new':
        return colors.primary;
      case 'viewed':
        return colors.info || '#3b82f6';
      case 'acknowledged':
        return colors.warning || '#f59e0b';
      case 'resolved':
        return colors.success || '#10b981';
      default:
        return colors.textSecondary;
    }
  };

  const filteredAlerts = filter === 'all'
    ? alerts
    : alerts.filter((alert) => alert.status === filter);

  const renderAlert = ({ item }: { item: AlertType }) => {
    const severityColor = getSeverityColor(item.severity);
    const statusColor = getStatusColor(item.status);
    const isProcessing = processingId === item.id;

    return (
      <TouchableOpacity
        style={[styles.alertCard, { backgroundColor: colors.card, borderLeftColor: severityColor }]}
        onPress={() => onAlertPress?.(item)}
        activeOpacity={0.7}
        disabled={isProcessing}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertIconContainer}>
            <Ionicons
              name={getAlertIcon(item.type) as any}
              size={24}
              color={severityColor}
            />
          </View>
          <View style={styles.alertContent}>
            <View style={styles.alertTitleRow}>
              <Text style={[styles.alertTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: severityColor + '20' },
                ]}
              >
                <Text style={[styles.severityText, { color: severityColor }]}>
                  {item.severity.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.alertMessage, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.message}
            </Text>
            <View style={styles.alertFooter}>
              <Text style={[styles.alertTime, { color: colors.textSecondary }]}>
                {formatDistanceToNow(item.createdAt, { addSuffix: true })}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor + '20' },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {showActions && (
          <View style={styles.alertActions}>
            {item.status === 'new' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={() => handleView(item)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="eye" size={16} color={colors.white} />
                    <Text style={styles.actionButtonText}>View</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {item.status === 'viewed' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.warning || '#f59e0b' }]}
                onPress={() => handleAcknowledge(item)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                    <Text style={styles.actionButtonText}>Acknowledge</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {item.status !== 'resolved' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success || '#10b981' }]}
                onPress={() => handleResolve(item)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={16} color={colors.white} />
                    <Text style={styles.actionButtonText}>Resolve</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (alerts.length === 0) {
    return null; // Empty state handled by parent
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: colors.card }]}>
        {(['all', 'new', 'viewed', 'acknowledged', 'resolved'] as const).map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterButton,
              {
                backgroundColor: filter === filterOption ? colors.primary : 'transparent',
              },
            ]}
            onPress={() => setFilter(filterOption)}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: filter === filterOption ? colors.white : colors.text,
                },
              ]}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredAlerts}
        renderItem={renderAlert}
        keyExtractor={(item) => item.id || `alert-${item.createdAt.getTime()}`}
        refreshing={refreshing}
        onRefresh={() => loadAlerts(true)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No {filter === 'all' ? '' : filter} alerts
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  alertCard: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    gap: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    flex: 1,
    gap: 4,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  alertTime: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
