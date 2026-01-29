import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import Header from '@/src/components/ui/Header';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import { getAll, save, STORAGE_KEYS } from '@/src/services/local-storage.service';
import { getUserSessions, cancelSession } from '@/src/services/session.service';
import CancelSessionModal from '@/src/components/session/CancelSessionModal';
import { getChildById } from '@/src/services/child.service';
import { getUserById } from '@/src/services/admin.service';
import { Session } from '@/src/types/session.types';
import { SESSION_STATUS } from '@/src/config/constants';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, RefreshControl, ActivityIndicator, Alert, Image, Animated } from 'react-native';
import { format } from 'date-fns';
import { formatSearchDuration, getSearchingMessage, isDirectInvite } from '@/src/utils/sessionSearchUtils';

interface SessionWithDetails extends Session {
  childName?: string;
  childNames?: string[]; // Array of all child names for sessions with multiple children
  childPhotoUrl?: string;
  childPhotoUrls?: string[]; // Array of all child photo URLs
  sitterName?: string;
}

// Searching Animation Component (Uber-like pulsing animation)
function SearchingAnimation() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);
  
  return (
    <Animated.View
      style={[
        styles.pulsingDot,
        {
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <View style={styles.pulsingDotInner} />
    </Animated.View>
  );
}


export default function ParentHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeSessions, setActiveSessions] = useState<SessionWithDetails[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithDetails[]>([]);
  const [requestedSessions, setRequestedSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedSessionForCancel, setSelectedSessionForCancel] = useState<SessionWithDetails | null>(null);
  const [searchDurations, setSearchDurations] = useState<Record<string, string>>({});
  const searchDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [cancelling, setCancelling] = useState(false);
  
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
      // Load requested sessions (newly created, waiting for sitter acceptance)
      const requestedResult = await getUserSessions(user.id, 'parent', SESSION_STATUS.REQUESTED);

      const loadSessionDetails = async (sessions: Session[]) => {
        return Promise.all(
          sessions.map(async (session) => {
            const details: SessionWithDetails = { ...session };
            
            // Get child names and photos - handle multiple children if childIds exists
            if (session.childIds && session.childIds.length > 0) {
              console.log(`📝 Loading ${session.childIds.length} children for session ${session.id}:`, session.childIds);
              // Multiple children: load all
              const childResults = await Promise.all(
                session.childIds.map(childId => getChildById(childId))
              );
              const childNames: string[] = [];
              const childPhotoUrls: string[] = [];
              
              childResults.forEach((result, index) => {
                if (result.success && result.data) {
                  childNames.push(result.data.name);
                  if (result.data.photoUrl) {
                    childPhotoUrls.push(result.data.photoUrl);
                  }
                } else {
                  console.warn(`⚠️ Failed to load child ${session.childIds[index]}:`, result.error);
                }
              });
              
              console.log(`✅ Loaded ${childNames.length} children:`, childNames);
              details.childNames = childNames;
              details.childPhotoUrls = childPhotoUrls;
              // Set primary child name for backward compatibility
              if (childNames.length > 0) {
                details.childName = childNames[0];
              }
              if (childPhotoUrls.length > 0) {
                details.childPhotoUrl = childPhotoUrls[0];
              }
            } else if (session.childId) {
              // Single child: load primary child
              const childResult = await getChildById(session.childId);
              if (childResult.success && childResult.data) {
                details.childName = childResult.data.name;
                details.childPhotoUrl = childResult.data.photoUrl;
                details.childNames = [childResult.data.name];
                if (childResult.data.photoUrl) {
                  details.childPhotoUrls = [childResult.data.photoUrl];
                }
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

      if (requestedResult.success && requestedResult.data) {
        const requestedWithDetails = await loadSessionDetails(requestedResult.data);
        setRequestedSessions(requestedWithDetails);
      } else {
        setRequestedSessions([]);
      }
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      setActiveSessions([]);
      setUpcomingSessions([]);
      setRequestedSessions([]);
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

  // Real-time search duration updates for requested sessions
  useEffect(() => {
    if (requestedSessions.length === 0) {
      if (searchDurationIntervalRef.current) {
        clearInterval(searchDurationIntervalRef.current);
        searchDurationIntervalRef.current = null;
      }
      setSearchDurations({});
      return;
    }

    // Update search duration every second for all requested sessions
    const updateDurations = () => {
      const durations: Record<string, string> = {};
      requestedSessions.forEach((session) => {
        if (session.createdAt) {
          try {
            durations[session.id] = formatSearchDuration(session.createdAt);
          } catch (error) {
            console.warn('Error formatting search duration:', error);
          }
        }
      });
      setSearchDurations((prev) => ({ ...prev, ...durations }));
    };

    updateDurations(); // Initial update
    searchDurationIntervalRef.current = setInterval(updateDurations, 1000);

    return () => {
      if (searchDurationIntervalRef.current) {
        clearInterval(searchDurationIntervalRef.current);
        searchDurationIntervalRef.current = null;
      }
    };
  }, [requestedSessions]);
  
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
                      {session.childNames && session.childNames.length > 1
                        ? `${session.childNames.length} Children: ${session.childNames.join(', ')}`
                        : session.childName || 'Child'}
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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Requested Sessions</Text>
        {loading && !refreshing ? (
          <Card>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </Card>
        ) : requestedSessions.length === 0 ? (
          <Card>
            <EmptyState
              icon="hourglass-outline"
              title="No requested sessions"
              message="You don't have any pending session requests"
            />
          </Card>
        ) : (
          requestedSessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              onPress={() => router.push(`/(parent)/session/${session.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  {/* Show overlapping avatars for multiple children */}
                  {session.childNames && session.childNames.length > 1 ? (
                    <View style={styles.overlappingAvatars}>
                      {session.childNames.slice(0, 3).map((childName, index) => {
                        const photoUrl = session.childPhotoUrls?.[index];
                        return photoUrl ? (
                          <Image
                            key={index}
                            source={{ uri: photoUrl }}
                            style={[
                              styles.overlappingAvatar,
                              { marginLeft: index > 0 ? -12 : 0, zIndex: session.childNames.length - index }
                            ]}
                            defaultSource={require('@/assets/images/child.webp')}
                          />
                        ) : (
                          <View
                            key={index}
                            style={[
                              styles.overlappingAvatar,
                              styles.overlappingAvatarPlaceholder,
                              { 
                                marginLeft: index > 0 ? -12 : 0, 
                                zIndex: session.childNames.length - index,
                                backgroundColor: colors.border 
                              }
                            ]}
                          >
                            <Ionicons name="person" size={20} color={colors.textSecondary} />
                          </View>
                        );
                      })}
                      {session.childNames.length > 3 && (
                        <View style={[
                          styles.overlappingAvatar,
                          styles.avatarOverflow,
                          { marginLeft: -12, zIndex: 0, backgroundColor: colors.primary }
                        ]}>
                          <Text style={[styles.avatarOverflowText, { color: colors.white }]}>
                            +{session.childNames.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : session.childPhotoUrl ? (
                    <Image 
                      source={{ uri: session.childPhotoUrl }} 
                      style={styles.childAvatar}
                      defaultSource={require('@/assets/images/child.webp')}
                    />
                  ) : (
                    <View style={[styles.childAvatarPlaceholder, { backgroundColor: colors.border }]}>
                      <Ionicons name="person" size={24} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]}>
                      {session.childNames && session.childNames.length > 1
                        ? `${session.childNames.length} Children: ${session.childNames.join(', ')}`
                        : session.childName || 'Child'}
                    </Text>
                    <View style={styles.searchingContainer}>
                      <View style={styles.searchingIndicator}>
                        {isDirectInvite(session) ? (
                          <Ionicons name="mail" size={16} color={colors.primary} style={styles.inviteIcon} />
                        ) : (
                          <SearchingAnimation />
                        )}
                        <Text style={[styles.searchingText, { color: colors.primary }]}>
                          {getSearchingMessage(session)}
                        </Text>
                      </View>
                      <Text style={[styles.searchingSubtext, { color: colors.textSecondary }]}>
                        {session.searchScope === 'invite' && session.sitterName 
                          ? `Invited: ${session.sitterName}`
                          : session.searchScope === 'nearby'
                          ? `Within ${session.maxDistanceKm}km`
                          : session.searchScope === 'city'
                          ? 'City wide search'
                          : 'Nationwide search'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.sessionDetails}>
                  <Text style={[styles.sessionTime, { color: colors.textSecondary }]}>
                    {format(session.startTime, 'MMM dd, yyyy • h:mm a')}
                    {session.endTime && (() => {
                      const startDateStr = format(session.startTime, 'MMM dd, yyyy');
                      const endDateStr = format(session.endTime, 'MMM dd, yyyy');
                      const endTimeStr = format(session.endTime, 'h:mm a');
                      // If end date is different from start date, show date with time
                      if (startDateStr !== endDateStr) {
                        return ` - ${endDateStr} • ${endTimeStr}`;
                      }
                      return ` - ${endTimeStr}`;
                    })()}
                  </Text>
                  {session.createdAt && searchDurations[session.id] && (
                    <View style={styles.searchingTimeContainer}>
                      <Text style={[styles.searchingTimeText, { color: colors.textSecondary }]}>
                        {isDirectInvite(session)
                          ? `Waiting for ${searchDurations[session.id]}`
                          : `Searching for ${searchDurations[session.id]}`}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.error || '#ef4444' }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedSessionForCancel(session);
                    setCancelModalVisible(true);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.error || '#ef4444'} />
                  <Text style={[styles.cancelButtonText, { color: colors.error || '#ef4444' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
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
                      {session.childNames && session.childNames.length > 1
                        ? `${session.childNames.length} Children: ${session.childNames.join(', ')}`
                        : session.childName || 'Child'}
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
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.error || '#ef4444' }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedSessionForCancel(session);
                    setCancelModalVisible(true);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.error || '#ef4444'} />
                  <Text style={[styles.cancelButtonText, { color: colors.error || '#ef4444' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* Cancel Session Modal */}
        <CancelSessionModal
          visible={cancelModalVisible}
          session={selectedSessionForCancel}
          onClose={() => {
            setCancelModalVisible(false);
            setSelectedSessionForCancel(null);
          }}
          onConfirm={async (reason) => {
            if (!selectedSessionForCancel) return;
            setCancelling(true);
            const result = await cancelSession(selectedSessionForCancel.id, reason);
            if (result.success) {
              Alert.alert(
                'Session Cancelled',
                'Your session has been cancelled successfully.',
                [
                  {
                    text: 'Request New Session',
                    onPress: () => {
                      setCancelModalVisible(false);
                      setSelectedSessionForCancel(null);
                      // Navigate to search to create new session
                      router.push('/(parent)/search');
                    },
                  },
                  {
                    text: 'OK',
                    onPress: () => {
                      setCancelModalVisible(false);
                      setSelectedSessionForCancel(null);
                      loadSessions(true);
                    },
                  },
                ]
              );
            } else {
              Alert.alert('Error', result.error?.message || 'Failed to cancel session');
            }
            setCancelling(false);
          }}
          loading={cancelling}
        />

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
    gap: 12,
  },
  childAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  childAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlappingAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
  },
  overlappingAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
  },
  overlappingAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarOverflow: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarOverflowText: {
    fontSize: 12,
    fontWeight: 'bold',
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
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchingContainer: {
    marginTop: 4,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteIcon: {
    marginRight: 0,
  },
  searchingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchingSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  searchingTimeContainer: {
    marginTop: 4,
  },
  searchingTimeText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulsingDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
});
