import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { useParentTabBadges } from '@/src/contexts/ParentTabBadgesContext';
import { getUserAlerts, markAlertAsViewed } from '@/src/services/alert.service';
import type { Alert } from '@/src/services/alert.service';
import { formatDistanceToNow } from 'date-fns';

export default function ParentNotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const badges = useParentTabBadges();
  const [menuVisible, setMenuVisible] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getUserAlerts(user.id);
      if (result.success && result.data) {
        const sorted = [...result.data].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        setAlerts(sorted);
        // Mark all as viewed when user opens Notifications so badge count goes down
        const newAlerts = sorted.filter((a) => a.status === 'new');
        if (newAlerts.length > 0) {
          // Optimistic: clear badge immediately so tab bar updates
          badges?.setNotificationCount?.(0);
          for (const a of newAlerts) {
            if (a.id) await markAlertAsViewed(a.id);
          }
          setAlerts((prev) =>
            prev.map((a) => (a.status === 'new' ? { ...a, status: 'viewed' as const } : a))
          );
        }
        // Always sync badge with server so count is correct (e.g. after opening tab or when all were already read)
        await badges?.refreshNotificationCount?.();
      } else {
        setAlerts([]);
        badges?.setNotificationCount?.(0);
      }
    } catch {
      setAlerts([]);
      badges?.setNotificationCount?.(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, badges?.refreshNotificationCount, badges?.setNotificationCount]);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
  );

  const handleAlertPress = async (alert: Alert) => {
    if (alert.id && alert.status === 'new') {
      // Optimistic: decrement badge so tab bar updates immediately
      const current = badges?.notificationCount ?? 0;
      badges?.setNotificationCount?.(Math.max(0, current - 1));
      await markAlertAsViewed(alert.id);
      await badges?.refreshNotificationCount?.();
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, status: 'viewed' as const } : a))
      );
    }
    if (alert.sessionId) {
      router.push(`/(parent)/session/${alert.sessionId}` as any);
    }
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'session_request':
        return 'mail-unread';
      case 'session_accepted':
        return 'checkmark-circle';
      case 'session_cancelled':
        return 'close-circle';
      case 'session_started':
        return 'play-circle';
      case 'cry_detection':
        return 'alert-circle';
      case 'emergency':
        return 'warning';
      default:
        return 'notifications';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.burgerButton}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="menu" size={30} color={colors.text} />
      </TouchableOpacity>
      <Header showLogo={true} title="Notifications" showBack={true} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAlerts(true)} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : alerts.length === 0 ? (
          <Card>
            <EmptyState
              icon="notifications-outline"
              title="No notifications"
              message="You're all caught up!"
            />
          </Card>
        ) : (
          alerts.map((alert) => {
            const isRead = alert.status === 'viewed' || alert.status === 'acknowledged' || alert.status === 'resolved';
            return (
              <TouchableOpacity
                key={alert.id}
                activeOpacity={0.7}
                onPress={() => handleAlertPress(alert)}
                style={[
                  styles.alertCard,
                  {
                    backgroundColor: colors.surface || colors.background,
                    opacity: isRead ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[styles.alertIconWrap, { backgroundColor: colors.primary + (isRead ? '15' : '20') }]}>
                  <Ionicons
                    name={getAlertIcon(alert.type) as any}
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.alertBody}>
                  <View style={styles.alertTitleRow}>
                    <Text style={[styles.alertTitle, { color: colors.text }]} numberOfLines={1}>
                      {alert.title}
                    </Text>
                    {isRead && (
                      <Text style={[styles.readLabel, { color: colors.textSecondary }]}>Read</Text>
                    )}
                  </View>
                  <Text style={[styles.alertMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                    {alert.message}
                  </Text>
                  <Text style={[styles.alertTime, { color: colors.textSecondary }]}>
                    {formatDistanceToNow(alert.createdAt, { addSuffix: true })}
                  </Text>
                </View>
                {alert.sessionId && (
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      <HamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  burgerButton: {
    position: 'absolute',
    top: 60,
    right: 10,
    zIndex: 1000,
    padding: 8,
  },
  content: {
    padding: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  alertIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertBody: {
    flex: 1,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  readLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  alertMessage: {
    fontSize: 14,
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 12,
  },
});
