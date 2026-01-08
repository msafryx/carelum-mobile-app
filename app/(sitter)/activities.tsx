import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { useAuth } from '@/src/hooks/useAuth';
import { useRouter } from 'expo-router';
import { getUserSessions } from '@/src/services/session.service';
import { getChildById } from '@/src/services/child.service';
import { getUserById } from '@/src/services/admin.service';
import { Session } from '@/src/types/session.types';
import { format, formatDistanceToNow } from 'date-fns';
import { SESSION_STATUS } from '@/src/config/constants';

const tabs = ['Ongoing', 'Completed', 'Cancelled'] as const;

// Map tab to session status
const getStatusForTab = (tab: string): Session['status'] | undefined => {
  switch (tab) {
    case 'Ongoing':
      return SESSION_STATUS.ACTIVE;
    case 'Completed':
      return SESSION_STATUS.COMPLETED;
    case 'Cancelled':
      return SESSION_STATUS.CANCELLED;
    default:
      return undefined;
  }
};

interface SessionWithDetails extends Session {
  childName?: string;
  parentName?: string;
}

export default function SitterActivitiesScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Ongoing');
  const [menuVisible, setMenuVisible] = useState(false);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async (isRefresh = false) => {
    if (!user || !userProfile) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const status = getStatusForTab(activeTab);
      // For sitter, we need to use 'sitter' role (not 'babysitter')
      const role = userProfile.role === 'babysitter' ? 'sitter' : 'sitter';
      const result = await getUserSessions(user.id, role, status);

      if (result.success && result.data) {
        // Fetch child and parent names for each session
        const sessionsWithDetails = await Promise.all(
          result.data.map(async (session) => {
            const details: SessionWithDetails = { ...session };
            
            // Get child name
            if (session.childId) {
              const childResult = await getChildById(session.childId);
              if (childResult.success && childResult.data) {
                details.childName = childResult.data.name;
              }
            }

            // Get parent name
            if (session.parentId) {
              const parentResult = await getUserById(session.parentId);
              if (parentResult.success && parentResult.data) {
                details.parentName = parentResult.data.displayName || 'Parent';
              }
            }

            return details;
          })
        );

        setSessions(sessionsWithDetails);
      } else {
        setSessions([]);
      }
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, userProfile, activeTab]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSessionPress = (sessionId: string) => {
    router.push(`/(sitter)/session/${sessionId}` as any);
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case SESSION_STATUS.ACTIVE:
        return colors.success || '#10b981';
      case SESSION_STATUS.COMPLETED:
        return colors.primary;
      case SESSION_STATUS.CANCELLED:
        return colors.error || '#ef4444';
      case SESSION_STATUS.ACCEPTED:
        return colors.warning || '#f59e0b';
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: Session['status']) => {
    switch (status) {
      case SESSION_STATUS.ACTIVE:
        return 'radio';
      case SESSION_STATUS.COMPLETED:
        return 'checkmark-circle';
      case SESSION_STATUS.CANCELLED:
        return 'close-circle';
      case SESSION_STATUS.ACCEPTED:
        return 'time';
      default:
        return 'ellipse';
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
      <Header showLogo={true} title="My Sessions" showBack={true} />
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabButton,
              { backgroundColor: activeTab === tab ? colors.primary : colors.border },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.white : colors.text },
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sessions.length === 0 ? (
        <ScrollView 
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadSessions(true)} />
          }
        >
          <Card>
            <EmptyState
              icon="list-outline"
              title={`No ${activeTab.toLowerCase()} sessions`}
              message={`You don't have any ${activeTab.toLowerCase()} sessions at the moment`}
            />
          </Card>
        </ScrollView>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadSessions(true)} />
          }
        >
          {sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              onPress={() => handleSessionPress(session.id)}
              activeOpacity={0.7}
            >
              <Card style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <View style={styles.sessionTitleRow}>
                      <Ionicons
                        name={getStatusIcon(session.status) as any}
                        size={20}
                        color={getStatusColor(session.status)}
                        style={styles.statusIcon}
                      />
                      <Text style={[styles.sessionTitle, { color: colors.text }]}>
                        {session.childName || 'Child'}
                      </Text>
                    </View>
                    {session.parentName && (
                      <Text style={[styles.parentName, { color: colors.textSecondary }]}>
                        for {session.parentName}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>

                <View style={styles.sessionDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      {format(session.startTime, 'MMM dd, yyyy • h:mm a')}
                    </Text>
                  </View>
                  {session.location?.address && (
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {session.location.address}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      ${session.hourlyRate}/hr
                      {session.totalAmount && ` • Total: $${session.totalAmount.toFixed(2)}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.sessionFooter}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(session.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(session.status) },
                      ]}
                    >
                      {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </Text>
                  </View>
                  {session.endTime && (
                    <Text style={[styles.timeAgo, { color: colors.textSecondary }]}>
                      {formatDistanceToNow(session.endTime, { addSuffix: true })}
                    </Text>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      <SitterHamburgerMenu
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
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontWeight: '500',
    fontSize: 14,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCard: {
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusIcon: {
    marginRight: 8,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  parentName: {
    fontSize: 14,
    marginLeft: 28,
  },
  sessionDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeAgo: {
    fontSize: 12,
  },
});
