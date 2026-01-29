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
import { updateUserProfileViaAPI } from '@/src/services/user-api.service';
import { Session } from '@/src/types/session.types';
import { format } from 'date-fns';
import { SESSION_STATUS } from '@/src/config/constants';
import * as Location from 'expo-location';
import { Switch, Alert } from 'react-native';

interface SessionWithDetails extends Session {
  childName?: string;
  parentName?: string;
}

// Helper function to extract readable address from location
const getReadableLocation = (location: any): string | null => {
  if (!location) return null;
  
  // If it's already a plain string, return it
  if (typeof location === 'string') {
    // Check if it's a JSON string
    try {
      const parsed = JSON.parse(location);
      if (parsed && typeof parsed === 'object') {
        return parsed.address || parsed.city || location;
      }
    } catch {
      // Not JSON, return as-is
      return location;
    }
    return location;
  }
  
  // If it's an object
  if (typeof location === 'object') {
    if (location.address) return location.address;
    if (location.city) return location.city;
    // If it has coordinates but no address, return a generic message
    if (location.coordinates) return 'Location set';
  }
  
  return null;
};

export default function SitterHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeSessions, setActiveSessions] = useState<SessionWithDetails[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithDetails[]>([]);
  const [availableSessions, setAvailableSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Initialize isActive from userProfile if available, otherwise false
  // Will be synced when profile loads
  const [isActive, setIsActive] = useState(userProfile?.isActive ?? false);
  const [updatingActiveStatus, setUpdatingActiveStatus] = useState(false);

  const handleProfilePress = () => {
    // Always route to profile setup from homepage
    router.push('/(sitter)/profile-setup');
  };

  const handleToggleActiveStatus = async (value: boolean) => {
    if (!user) return;
    
    setUpdatingActiveStatus(true);
    try {
      // If turning on, get current location
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      if (value) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({});
            latitude = location.coords.latitude;
            longitude = location.coords.longitude;
          }
        } catch (error) {
          console.warn('Failed to get location:', error);
          // Continue without location if permission denied
        }
      }
      
      const result = await updateUserProfileViaAPI({
        isActive: value,
        latitude,
        longitude,
      });
      
      if (result.success) {
        setIsActive(value);
        await refreshProfile();
        if (value) {
          Alert.alert('You\'re now online', 'Parents can now see you in their search results.');
        } else {
          Alert.alert('You\'re now offline', 'You won\'t appear in parent search results until you go online again.');
        }
      } else {
        Alert.alert('Error', 'Failed to update availability status. Please try again.');
        // Revert toggle
        setIsActive(!value);
      }
    } catch (error: any) {
      console.error('Failed to toggle active status:', error);
      Alert.alert('Error', 'Failed to update availability status. Please try again.');
      // Revert toggle
      setIsActive(!value);
    } finally {
      setUpdatingActiveStatus(false);
    }
  };

  // Sync isActive state with userProfile (when profile loads or updates)
  // This ensures UI always reflects backend state
  useEffect(() => {
    if (userProfile) {
      // Always sync from backend profile (source of truth)
      const backendIsActive = userProfile.isActive ?? false;
      if (isActive !== backendIsActive) {
        console.log(`🔄 Syncing isActive from backend: ${isActive} -> ${backendIsActive}`);
        setIsActive(backendIsActive);
      }
    } else {
      // If profile not loaded yet, default to false
      if (isActive !== false) {
        setIsActive(false);
      }
    }
  }, [userProfile?.isActive, userProfile?.id]); // Sync when isActive changes or profile ID changes (new login)

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
            
            // Get child name - handle errors gracefully
            if (session.childId) {
              try {
                const childResult = await getChildById(session.childId);
                if (childResult.success && childResult.data) {
                  details.childName = childResult.data.name;
                } else {
                  // Child not found or error - use fallback
                  console.warn(`⚠️ Could not load child ${session.childId}:`, childResult.error?.message || 'Child not found');
                  details.childName = 'Child';
                }
              } catch (error: any) {
                // Handle unexpected errors gracefully
                console.warn(`⚠️ Error loading child ${session.childId}:`, error.message);
                details.childName = 'Child';
              }
            }

            // Get parent name - handle errors gracefully
            if (session.parentId) {
              try {
                const parentResult = await getUserById(session.parentId);
                if (parentResult.success && parentResult.data) {
                  details.parentName = parentResult.data.displayName || 'Parent';
                } else {
                  // Parent not found or error - use fallback
                  console.warn(`⚠️ Could not load parent ${session.parentId}:`, parentResult.error?.message || 'Parent not found');
                  details.parentName = 'Parent';
                }
              } catch (error: any) {
                // Handle unexpected errors gracefully
                console.warn(`⚠️ Error loading parent ${session.parentId}:`, error.message);
                details.parentName = 'Parent';
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
        {/* Active Status Toggle Card */}
        <Card style={styles.activeStatusCard}>
          <View style={styles.activeStatusRow}>
            <View style={styles.activeStatusInfo}>
              <Text style={[styles.activeStatusTitle, { color: colors.text }]}>
                {isActive ? 'You\'re Online' : 'You\'re Offline'}
              </Text>
              <Text style={[styles.activeStatusSubtitle, { color: colors.textSecondary }]}>
                {isActive 
                  ? 'Parents can see you in search results' 
                  : 'You won\'t appear in parent searches'}
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={handleToggleActiveStatus}
              disabled={updatingActiveStatus}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
          {updatingActiveStatus && (
            <View style={styles.updatingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.updatingText, { color: colors.textSecondary }]}>
                Updating...
              </Text>
            </View>
          )}
        </Card>

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
              <Card style={styles.availableSessionCard}>
                <View style={styles.availableSessionHeader}>
                  <View style={styles.availableSessionInfo}>
                    <View style={styles.availableSessionTitleRow}>
                      <Text style={[styles.availableSessionTitle, { color: colors.text }]}>
                        {session.childName || 'Child'}
                      </Text>
                      {session.searchScope && session.searchScope !== 'invite' && (
                        <View style={[styles.scopeBadge, { backgroundColor: colors.primary + '15' }]}>
                          <Text style={[styles.scopeBadgeText, { color: colors.primary }]}>
                            {session.searchScope === 'nearby' && session.maxDistanceKm
                              ? `${session.maxDistanceKm}km`
                              : session.searchScope.charAt(0).toUpperCase() + session.searchScope.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                    {session.parentName && (
                      <Text style={[styles.availableSessionParent, { color: colors.textSecondary }]}>
                        from {session.parentName}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.locationIconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="location" size={18} color={colors.primary} />
                  </View>
                </View>
                <View style={styles.availableSessionDetails}>
                  <View style={styles.availableSessionDetailRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.availableSessionDetailText, { color: colors.textSecondary }]}>
                      {format(session.startTime, 'MMM dd, yyyy • h:mm a')}
                    </Text>
                  </View>
                  {getReadableLocation(session.location) && (
                    <View style={styles.availableSessionDetailRow}>
                      <Ionicons name="location" size={14} color={colors.warning || '#f59e0b'} />
                      <Text style={[styles.availableSessionDetailText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {getReadableLocation(session.location)}
                      </Text>
                    </View>
                  )}
                  {session.hourlyRate && (
                    <View style={styles.availableSessionDetailRow}>
                      <Ionicons name="cash" size={14} color={colors.primary} />
                      <Text style={[styles.availableSessionRate, { color: colors.primary }]}>
                        Rs. {session.hourlyRate.toFixed(0)}/hr
                      </Text>
                    </View>
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
  availableSessionCard: {
    marginBottom: 12,
    padding: 16,
  },
  availableSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  availableSessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  availableSessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  availableSessionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scopeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scopeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  availableSessionParent: {
    fontSize: 14,
    marginTop: 2,
  },
  locationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableSessionDetails: {
    gap: 8,
  },
  availableSessionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availableSessionDetailText: {
    fontSize: 14,
    flex: 1,
  },
  availableSessionRate: {
    fontSize: 15,
    fontWeight: '600',
  },
  activeStatusCard: {
    marginBottom: 20,
  },
  activeStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeStatusInfo: {
    flex: 1,
    marginRight: 16,
  },
  activeStatusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeStatusSubtitle: {
    fontSize: 14,
  },
  updatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  updatingText: {
    fontSize: 12,
  },
});
