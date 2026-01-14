import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import Header from '@/src/components/ui/Header';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import { getAll, save, STORAGE_KEYS } from '@/src/services/local-storage.service';
import { getUserSessions } from '@/src/services/session.service';
import { getChildById } from '@/src/services/child.service';
import { getUserById } from '@/src/services/admin.service';
import { Session } from '@/src/types/session.types';
import { SESSION_STATUS } from '@/src/config/constants';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, RefreshControl, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';

interface SessionWithDetails extends Session {
  childName?: string;
  sitterName?: string;
}

export default function ParentHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeSessions, setActiveSessions] = useState<SessionWithDetails[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const loadSessions = useCallback(async (isRefresh = false) => {
    if (!user) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Load active sessions
      const activeResult = await getUserSessions(user.id, 'parent', SESSION_STATUS.ACTIVE);
      // Load upcoming sessions (accepted but not yet active)
      const upcomingResult = await getUserSessions(user.id, 'parent', SESSION_STATUS.ACCEPTED);

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

            // Get sitter name
            if (session.sitterId) {
              const sitterResult = await getUserById(session.sitterId);
              if (sitterResult.success && sitterResult.data) {
                details.sitterName = sitterResult.data.displayName || 'Sitter';
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
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      setActiveSessions([]);
      setUpcomingSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Sync current user to AsyncStorage if not already there
  useEffect(() => {
    if (user && userProfile) {
      syncUserToLocal();
    }
  }, [user, userProfile]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);
  
  const syncUserToLocal = async () => {
    try {
      if (!user || !userProfile) return;
      
      // Check if user already in AsyncStorage
      const usersResult = await getAll(STORAGE_KEYS.USERS);
      const existingUser = usersResult.data?.find((u: any) => u.id === user.id);
      
      if (!existingUser) {
        // Save user profile directly to AsyncStorage
        const { id, ...profileWithoutId } = userProfile;
        await save(STORAGE_KEYS.USERS, {
          id: user.id, // Supabase UUID
          userNumber: (userProfile as any).userNumber || null, // Readable ID: p1, b1, a1
          ...profileWithoutId,
          createdAt: userProfile.createdAt instanceof Date 
            ? userProfile.createdAt.getTime() 
            : Date.now(),
          updatedAt: Date.now(),
        });
        console.log('✅ User saved to AsyncStorage');
      }
    } catch (error: any) {
      console.error('❌ Failed to sync user to local:', error.message);
    }
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        showLogo={true} 
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
        <TextInput
          placeholder="Search sitters"
          placeholderTextColor={colors.textSecondary}
          style={[styles.search, { backgroundColor: colors.white, color: colors.text }]}
          onFocus={() => router.push('/(parent)/search')}
        />

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(parent)/search')}
          >
            <Text style={styles.quickText}>Book Sitter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(parent)/activities')}
          >
            <Text style={styles.quickText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => {}}
          >
            <Text style={styles.quickText}>Track</Text>
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
              onPress={() => router.push(`/(parent)/session/${session.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]}>
                      {session.childName || 'Child'}
                    </Text>
                    {session.sitterName && (
                      <Text style={[styles.sitterName, { color: colors.textSecondary }]}>
                        with {session.sitterName}
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
              onPress={() => router.push(`/(parent)/session/${session.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]}>
                      {session.childName || 'Child'}
                    </Text>
                    {session.sitterName && (
                      <Text style={[styles.sitterName, { color: colors.textSecondary }]}>
                        with {session.sitterName}
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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended Sitters</Text>
        <Card>
          <EmptyState
            icon="star-outline"
            title="Coming soon"
            message="Recommended babysitters will appear here"
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activities</Text>
        <Card>
          <EmptyState
            icon="time-outline"
            title="Nothing yet"
            message="Your recent activities will appear here"
          />
        </Card>
      </ScrollView>

      <TouchableOpacity
        style={[styles.chatbotButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(parent)/messages')}
      >
        <Ionicons name="chatbubbles" size={28} color={colors.white} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.emergencyButton, { backgroundColor: colors.emergency }]}
        onPress={() => {}}
      >
        <Ionicons name="call" size={26} color={colors.white} />
      </TouchableOpacity>

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
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  search: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 20,
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
  },
  quickText: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
  },
  chatbotButton: {
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
  emergencyButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
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
  sitterName: {
    fontSize: 14,
  },
  sessionDetails: {
    marginTop: 4,
  },
  sessionTime: {
    fontSize: 14,
  },
});
