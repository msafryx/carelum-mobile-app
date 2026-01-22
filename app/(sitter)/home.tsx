import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import Header from '@/src/components/ui/Header';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/hooks/useAuth';
import { getUserSessions, discoverAvailableSessions } from '@/src/services/session.service';
import { getChildById } from '@/src/services/child.service';
import { getUserById } from '@/src/services/admin.service';
import { Session } from '@/src/types/session.types';
import { format } from 'date-fns';
import { SESSION_STATUS } from '@/src/config/constants';

interface SessionWithDetails extends Session {
  childName?: string;
  parentName?: string;
}

export default function SitterHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeSessions, setActiveSessions] = useState<SessionWithDetails[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithDetails[]>([]);
  const [availableSessions, setAvailableSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleProfilePress = () => {
    // Always route to profile setup from homepage
    router.push('/(sitter)/profile-setup');
  };

  const loadSessions = useCallback(async (isRefresh = false) => {
    if (!user || !userProfile) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Load active sessions
      const activeResult = await getUserSessions(user.id, 'sitter', SESSION_STATUS.ACTIVE);
      // Load upcoming sessions (accepted but not yet active)
      const upcomingResult = await getUserSessions(user.id, 'sitter', SESSION_STATUS.ACCEPTED);
      // Discover available sessions (Uber-like discovery)
      const availableResult = await discoverAvailableSessions();

      const loadSessionDetails = async (sessions: Session[]) => {
        return Promise.all(
          sessions.map(async (session) => {
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
      };

      if (activeResult.success && activeResult.data) {
        const activeWithDetails = await loadSessionDetails(activeResult.data);
        setActiveSessions(activeWithDetails);
      } else {
        setActiveSessions([]);
      }

      if (upcomingResult.success && upcomingResult.data) {
        const upcomingWithDetails = await loadSessionDetails(upcomingResult.data);
        setUpcomingSessions(upcomingWithDetails);
      } else {
        setUpcomingSessions([]);
      }

      if (availableResult.success && availableResult.data) {
        const availableWithDetails = await loadSessionDetails(availableResult.data);
        setAvailableSessions(availableWithDetails);
      } else {
        setAvailableSessions([]);
      }
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      setActiveSessions([]);
      setUpcomingSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, userProfile]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        showLogo={true} 
        title="Dashboard" 
        showBack={false}
        rightComponent={
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={30} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadSessions(true)} />
        }
      >
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(sitter)/requests')}
          >
            <Ionicons name="mail" size={24} color="#fff" />
            <Text style={styles.quickText}>Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(sitter)/activities')}
          >
            <Ionicons name="calendar" size={24} color="#fff" />
            <Text style={styles.quickText}>Sessions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={handleProfilePress}
          >
            <Ionicons name="person" size={24} color="#fff" />
            <Text style={styles.quickText}>Profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Sessions</Text>
        {loading && !refreshing ? (
          <Card>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </Card>
        ) : activeSessions.length === 0 ? (
          <Card>
            <EmptyState
              icon="radio-outline"
              title="No active sessions"
              message="You don't have any active babysitting sessions at the moment"
            />
          </Card>
        ) : (
          activeSessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              onPress={() => router.push(`/(sitter)/session/${session.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]}>
                      {session.childName || 'Child'}
                    </Text>
                    {session.parentName && (
                      <Text style={[styles.parentName, { color: colors.textSecondary }]}>
                        for {session.parentName}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="radio" size={20} color={colors.success || '#10b981'} />
                </View>
                <View style={styles.sessionDetails}>
                  <Text style={[styles.sessionTime, { color: colors.textSecondary }]}>
                    Started {format(session.startTime, 'MMM dd, h:mm a')}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Sessions</Text>
        {loading && !refreshing ? (
          <Card>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </Card>
        ) : upcomingSessions.length === 0 ? (
          <Card>
            <EmptyState
              icon="calendar-outline"
              title="No upcoming sessions"
              message="You don't have any upcoming sessions scheduled"
            />
          </Card>
        ) : (
          upcomingSessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              onPress={() => router.push(`/(sitter)/session/${session.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]}>
                      {session.childName || 'Child'}
                    </Text>
                    {session.parentName && (
                      <Text style={[styles.parentName, { color: colors.textSecondary }]}>
                        for {session.parentName}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="time" size={20} color={colors.warning || '#f59e0b'} />
                </View>
                <View style={styles.sessionDetails}>
                  <Text style={[styles.sessionTime, { color: colors.textSecondary }]}>
                    {format(session.startTime, 'MMM dd, yyyy • h:mm a')}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Sessions</Text>
        {loading && !refreshing ? (
          <Card>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </Card>
        ) : availableSessions.length === 0 ? (
          <Card>
            <EmptyState
              icon="search-outline"
              title="No available sessions"
              message="There are no session requests available at the moment. Check back later!"
            />
          </Card>
        ) : (
          availableSessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              onPress={() => router.push(`/(sitter)/session/${session.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]}>
                      {session.childName || 'Child'}
                    </Text>
                    {session.parentName && (
                      <Text style={[styles.parentName, { color: colors.textSecondary }]}>
                        from {session.parentName}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="location" size={20} color={colors.primary} />
                </View>
                <View style={styles.sessionDetails}>
                  <Text style={[styles.sessionTime, { color: colors.textSecondary }]}>
                    {format(session.startTime, 'MMM dd, yyyy • h:mm a')}
                  </Text>
                  {session.hourlyRate && (
                    <Text style={[styles.sessionRate, { color: colors.primary }]}>
                      ${session.hourlyRate}/hr
                    </Text>
                  )}
                  {session.searchScope && session.searchScope !== 'invite' && (
                    <Text style={[styles.sessionScope, { color: colors.textSecondary }]}>
                      {session.searchScope === 'nearby' && session.maxDistanceKm
                        ? `Within ${session.maxDistanceKm}km`
                        : session.searchScope.charAt(0).toUpperCase() + session.searchScope.slice(1)}
                    </Text>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.messagesButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(sitter)/messages')}
      >
        <Ionicons name="chatbubbles" size={28} color={colors.white} />
      </TouchableOpacity>

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
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  quickButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  quickText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
  },
  messagesButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  sessionCard: {
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  parentName: {
    fontSize: 14,
  },
  sessionDetails: {
    marginTop: 4,
  },
  sessionTime: {
    fontSize: 14,
  },
  sessionRate: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  sessionScope: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
