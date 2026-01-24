/**
 * Parent Session Detail Screen
 * Shows active session details, GPS tracking, cry detection alerts, and session controls
 */
import EnhancedAlertsView from '@/src/components/alerts/EnhancedAlertsView';
import EnhancedGPSMap from '@/src/components/gps/EnhancedGPSMap';
import CancelSessionModal from '@/src/components/session/CancelSessionModal';
import CryDetectionIndicator from '@/src/components/session/CryDetectionIndicator';
import SessionControls from '@/src/components/session/SessionControls';
import SessionTimeline from '@/src/components/session/SessionTimeline';
import Card from '@/src/components/ui/Card';
import ErrorDisplay from '@/src/components/ui/ErrorDisplay';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import Header from '@/src/components/ui/Header';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import { getUserById } from '@/src/services/admin.service';
import {
    Alert as AlertType,
    getSessionAlerts,
    markAlertAsViewed,
    subscribeToSessionAlerts,
} from '@/src/services/alert.service';
import { getChildById } from '@/src/services/child.service';
import {
    getSessionGPSTracking,
    subscribeToGPSUpdates,
} from '@/src/services/monitoring.service';
import {
    cancelSession,
    completeSession,
    getSessionById,
    subscribeToSession,
} from '@/src/services/session.service';
import { Child } from '@/src/types/child.types';
import { LocationUpdate, Session } from '@/src/types/session.types';
import { formatExpectedDuration, formatSearchDuration, getAcceptedDuration, getSearchingMessage } from '@/src/utils/sessionSearchUtils';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// Helper function to format duration
function formatDuration(startTime: Date): string {
  const now = new Date();
  const diff = now.getTime() - startTime.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
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

export default function SessionDetailScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [children, setChildren] = useState<Child[]>([]); // All children in the session
  const [sitter, setSitter] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationUpdate[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [searchDuration, setSearchDuration] = useState<string>('');
  const searchDurationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<Session | null>(null);

  // Load session data
  const loadSessionData = useCallback(async () => {
    if (!id) return;

    try {
      setError(null);
      const [sessionResult, gpsResult, alertsResult] = await Promise.all([
        getSessionById(id),
        getSessionGPSTracking(id),
        getSessionAlerts(id),
      ]);

      if (!sessionResult.success || !sessionResult.data) {
        setError('Session not found');
        return;
      }

      const sessionData = sessionResult.data;
      // Ensure createdAt is a proper Date object
      if (sessionData.createdAt && !(sessionData.createdAt instanceof Date)) {
        sessionData.createdAt = new Date(sessionData.createdAt);
      }
      console.log('📅 Session loaded - createdAt:', sessionData.createdAt, 'type:', typeof sessionData.createdAt, 'isDate:', sessionData.createdAt instanceof Date);
      setSession(sessionData);

      // Load child data - handle multiple children if childIds exists
      console.log('📝 Session childIds:', sessionData.childIds, 'childId:', sessionData.childId);
      if (sessionData.childIds && sessionData.childIds.length > 0) {
        console.log(`📝 Loading ${sessionData.childIds.length} children for session:`, sessionData.childIds);
        // Multiple children: load all
        const childResults = await Promise.all(
          sessionData.childIds.map(childId => getChildById(childId))
        );
        const loadedChildren: Child[] = [];
        
        childResults.forEach((result, index) => {
          if (result.success && result.data) {
            loadedChildren.push(result.data);
          } else {
            console.warn(`⚠️ Failed to load child ${sessionData.childIds?.[index] || 'unknown'}:`, result.error);
          }
        });
        
        console.log(`✅ Loaded ${loadedChildren.length} children:`, loadedChildren.map(c => c.name));
        setChildren(loadedChildren);
        // Set primary child for backward compatibility
        if (loadedChildren.length > 0) {
          setChild(loadedChildren[0]);
        }
      } else if (sessionData.childId) {
        // Single child: load primary child
        console.log('📝 Loading single child:', sessionData.childId);
        const childResult = await getChildById(sessionData.childId);
        if (childResult.success && childResult.data) {
          setChild(childResult.data);
          setChildren([childResult.data]);
        }
      }

      // Load sitter data (if assigned)
      if (sessionData.sitterId) {
        const sitterResult = await getUserById(sessionData.sitterId);
        if (sitterResult.success && sitterResult.data) {
          setSitter(sitterResult.data);
        }
      }

      // Process GPS tracking
      if (gpsResult.success && gpsResult.data) {
        const tracking = gpsResult.data;
        if (tracking.length > 0) {
          const latest = tracking[tracking.length - 1];
          setCurrentLocation({
            latitude: latest.location.latitude,
            longitude: latest.location.longitude,
            timestamp: latest.timestamp,
            accuracy: latest.location.accuracy,
          });
          setLocationHistory(
            tracking.map((t) => ({
              latitude: t.location.latitude,
              longitude: t.location.longitude,
              timestamp: t.timestamp,
              accuracy: t.location.accuracy,
            }))
          );
        }
      }

      // Process alerts
      if (alertsResult.success && alertsResult.data) {
        setAlerts(alertsResult.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load session data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Keep session ref updated
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Real-time search duration timer
  useEffect(() => {
    // Update ref immediately
    sessionRef.current = session;
    
    if (!session || session.status !== 'requested') {
      if (searchDurationIntervalRef.current) {
        clearInterval(searchDurationIntervalRef.current);
        searchDurationIntervalRef.current = null;
      }
      setSearchDuration('');
      return;
    }

    // Ensure createdAt is a Date object
    if (!session.createdAt) {
      console.warn('⚠️ Session has no createdAt');
      setSearchDuration('');
      return;
    }

    // Helper function to calculate and set duration
    const calculateAndSetDuration = (sessionToUse: Session) => {
      if (!sessionToUse || !sessionToUse.createdAt) return;
      
      try {
        // Ensure createdAt is a Date object - handle both Date objects and timestamps
        let createdDate: Date;
        if (sessionToUse.createdAt instanceof Date) {
          createdDate = sessionToUse.createdAt;
        } else if (typeof sessionToUse.createdAt === 'number') {
          // It's a timestamp
          createdDate = new Date(sessionToUse.createdAt);
        } else if (typeof sessionToUse.createdAt === 'string') {
          // It's a date string
          createdDate = new Date(sessionToUse.createdAt);
        } else {
          console.warn('⚠️ Unknown createdAt type:', typeof sessionToUse.createdAt, sessionToUse.createdAt);
          return;
        }
        
        if (!isNaN(createdDate.getTime())) {
          const duration = formatSearchDuration(createdDate);
          setSearchDuration(duration);
        } else {
          console.warn('⚠️ Invalid createdAt date:', sessionToUse.createdAt, 'parsed as:', createdDate);
          setSearchDuration('');
        }
      } catch (error) {
        console.warn('Error formatting search duration:', error);
        setSearchDuration('');
      }
    };

    // Initial update immediately using current session
    calculateAndSetDuration(session);

    // Update search duration every second
    const updateDuration = () => {
      // Use ref to get the latest session value
      const currentSession = sessionRef.current;
      if (currentSession && currentSession.status === 'requested') {
        calculateAndSetDuration(currentSession);
      }
    };

    searchDurationIntervalRef.current = setInterval(updateDuration, 1000);

    return () => {
      if (searchDurationIntervalRef.current) {
        clearInterval(searchDurationIntervalRef.current);
        searchDurationIntervalRef.current = null;
      }
    };
  }, [session]);

  // Real-time subscriptions
  useEffect(() => {
    if (!id) return;

    // Subscribe to session updates
    const unsubscribeSession = subscribeToSession(id, (updatedSession) => {
      if (updatedSession) {
        setSession(updatedSession);
      }
    });

    // Subscribe to GPS updates
    const unsubscribeGPS = subscribeToGPSUpdates(id, (location) => {
      setCurrentLocation(location);
      setLocationHistory((prev) => [...prev, location]);
    });

    // Subscribe to alerts
    const unsubscribeAlerts = subscribeToSessionAlerts(id, (newAlerts) => {
      setAlerts(newAlerts);
      // Show notification for new alerts
      const unviewedAlerts = newAlerts.filter((a) => a.status === 'new');
      if (unviewedAlerts.length > 0) {
        const latestAlert = unviewedAlerts[0];
        Alert.alert(latestAlert.title, latestAlert.message);
        // Mark as viewed
        markAlertAsViewed(latestAlert.id!);
      }
    });

    // Initial load
    loadSessionData();

    return () => {
      unsubscribeSession();
      unsubscribeGPS();
      unsubscribeAlerts();
    };
  }, [id, loadSessionData]);

  // Handle end session
  const handleEndSession = async () => {
    if (!session || !id) return;

    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await completeSession(id);
            if (result.success) {
              Alert.alert('Success', 'Session ended successfully');
              router.back();
            } else {
              Alert.alert('Error', result.error?.message || 'Failed to end session');
            }
            setActionLoading(false);
          },
        },
      ]
    );
  };

  // Handle emergency
  const handleEmergency = async () => {
    if (!session || !id) return;

    Alert.alert(
      'Emergency Alert',
      'This will send an emergency alert. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: async () => {
            // Create emergency alert
            const { createAlert } = await import('@/src/services/alert.service');
            const result = await createAlert({
              sessionId: id,
              childId: session.childId,
              parentId: session.parentId,
              sitterId: session.sitterId,
              type: 'emergency',
              severity: 'critical',
              title: 'Emergency Alert',
              message: 'Parent has triggered an emergency alert',
              status: 'new',
            });

            if (result.success) {
              Alert.alert('Success', 'Emergency alert sent');
            } else {
              Alert.alert('Error', 'Failed to send emergency alert');
            }
          },
        },
      ]
    );
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadSessionData();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          showLogo={true} 
          title="Session Details"
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
        <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          showLogo={true} 
          title="Session Details"
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
        <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
        <ErrorDisplay
          error={error || 'Session not found'}
          onRetry={loadSessionData}
        />
      </View>
    );
  }

  const cryAlerts = alerts.filter((a) => a.type === 'cry_detection');
  const lastCryDetection = cryAlerts.length > 0
    ? cryAlerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
    : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        showLogo={true} 
        title="Session Details"
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
      <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Session Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionHeaderLeft}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status, colors) }]}>
                <Text style={[styles.statusText, { color: colors.white }]}>
                  {session.status.toUpperCase()}
                </Text>
              </View>
              {children.length > 1 ? (
                <Text style={[styles.childName, { color: colors.text }]}>
                  {children.length} Children: {children.map(c => c.name).join(', ')}
                </Text>
              ) : child ? (
                <Text style={[styles.childName, { color: colors.text }]}>
                  {child.name}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.sessionInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Started: {session.startTime.toLocaleString()}
              </Text>
            </View>
            {session.endTime && (
              <View style={styles.infoRow}>
                <Ionicons name={session.status === 'requested' ? "time-outline" : "checkmark-outline"} size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  {session.status === 'requested' ? 'End' : 'Ended'}: {session.endTime.toLocaleString()}
                </Text>
              </View>
            )}
            {session.status === 'active' && (
              <View style={styles.infoRow}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Duration: {formatDuration(session.startTime)}
                </Text>
              </View>
            )}
            {session.status === 'requested' && (
              <View style={styles.searchingSection}>
                <View style={styles.searchingIndicator}>
                  <SearchingAnimation />
                  <Text style={[styles.searchingText, { color: colors.primary }]}>
                    {getSearchingMessage(session)}
                  </Text>
                </View>
                {session.createdAt && (
                  <View style={styles.searchingTimeRow}>
                    <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.searchingTimeText, { color: colors.textSecondary }]}>
                      Searching for {searchDuration || (() => {
                        // Fallback: calculate directly if searchDuration is not set yet
                        try {
                          const createdDate = session.createdAt instanceof Date 
                            ? session.createdAt 
                            : new Date(session.createdAt);
                          if (!isNaN(createdDate.getTime())) {
                            return formatSearchDuration(createdDate);
                          }
                        } catch (e) {
                          console.warn('Error in fallback calculation:', e);
                        }
                        return '...';
                      })()}
                    </Text>
                  </View>
                )}
                {(session.endTime || (session.timeSlots && session.timeSlots.length > 0)) && (
                  <View style={styles.infoRow}>
                    <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      Expected Duration: {formatExpectedDuration(session)}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {session.status === 'accepted' && session.createdAt && (
              <View style={styles.acceptedSection}>
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.infoText, { color: colors.success }]}>
                    Accepted in {getAcceptedDuration(session) || 'N/A'}
                  </Text>
                </View>
              </View>
            )}
            {/* Booking Mode */}
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Booking Mode: {session.timeSlots && session.timeSlots.length > 0 ? 'Time Slots' : 'Continuous'}
              </Text>
            </View>
            {/* Time Slots Display */}
            {session.timeSlots && session.timeSlots.length > 0 && (
              <View style={styles.timeSlotsContainer}>
                <View style={styles.timeSlotsHeader}>
                  <Text style={[styles.timeSlotsTitle, { color: colors.text }]}>Time Slots</Text>
                  {session.timeSlots.length > 4 && (
                    <Text style={[styles.timeSlotsCount, { color: colors.textSecondary }]}>
                      {session.timeSlots.length} slots
                    </Text>
                  )}
                </View>
                <ScrollView 
                  style={styles.timeSlotsScrollContainer}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={session.timeSlots.length > 4}
                >
                  {session.timeSlots.map((slot, index) => {
                    // Parse and format date and times
                    let formattedDate = slot.date;
                    let formattedStartTime = slot.startTime;
                    let formattedEndTime = slot.endTime;
                    
                    try {
                      // Parse date - handle both date strings and ISO strings
                      let dateObj: Date | null = null;
                      if (slot.date) {
                        dateObj = new Date(slot.date);
                        if (isNaN(dateObj.getTime())) {
                          // Try parsing as date only (YYYY-MM-DD)
                          const dateOnly = slot.date.split('T')[0];
                          dateObj = new Date(dateOnly);
                        }
                        if (!isNaN(dateObj.getTime())) {
                          formattedDate = dateObj.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric'
                          });
                        }
                      }
                      
                      // Parse and format start time - handle ISO strings and time strings
                      let startTimeObj: Date | null = null;
                      if (slot.startTime) {
                        // If it's an ISO string, parse it directly
                        if (slot.startTime.includes('T') || slot.startTime.includes('Z')) {
                          startTimeObj = new Date(slot.startTime);
                        } else {
                          // If it's just a time string (HH:mm), combine with date
                          if (dateObj && !isNaN(dateObj.getTime())) {
                            const [hours, minutes] = slot.startTime.split(':').map(Number);
                            startTimeObj = new Date(dateObj);
                            startTimeObj.setHours(hours, minutes || 0, 0, 0);
                          } else {
                            startTimeObj = new Date(`2000-01-01T${slot.startTime}`);
                          }
                        }
                        if (startTimeObj && !isNaN(startTimeObj.getTime())) {
                          formattedStartTime = startTimeObj.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          });
                        }
                      }
                      
                      // Parse and format end time - handle ISO strings and time strings
                      let endTimeObj: Date | null = null;
                      if (slot.endTime) {
                        // If it's an ISO string, parse it directly
                        if (slot.endTime.includes('T') || slot.endTime.includes('Z')) {
                          endTimeObj = new Date(slot.endTime);
                        } else {
                          // If it's just a time string (HH:mm), combine with date
                          if (dateObj && !isNaN(dateObj.getTime())) {
                            const [hours, minutes] = slot.endTime.split(':').map(Number);
                            endTimeObj = new Date(dateObj);
                            endTimeObj.setHours(hours, minutes || 0, 0, 0);
                          } else {
                            endTimeObj = new Date(`2000-01-01T${slot.endTime}`);
                          }
                        }
                        if (endTimeObj && !isNaN(endTimeObj.getTime())) {
                          formattedEndTime = endTimeObj.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          });
                        }
                      }
                    } catch (e) {
                      console.warn('Error parsing time slot date/time:', e, slot);
                    }
                    
                    return (
                      <View 
                        key={index} 
                        style={[
                          styles.timeSlotRow, 
                          { 
                            backgroundColor: colors.background + '80',
                            borderLeftColor: colors.primary,
                            borderLeftWidth: 3
                          }
                        ]}
                      >
                        <View style={styles.timeSlotLeft}>
                          <Ionicons name="calendar" size={16} color={colors.primary} />
                          <View style={styles.timeSlotDetails}>
                            <Text style={[styles.timeSlotDate, { color: colors.text }]}>
                              {formattedDate}
                            </Text>
                            <Text style={[styles.timeSlotTimeText, { color: colors.textSecondary }]}>
                              {formattedStartTime} - {formattedEndTime}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.timeSlotRight}>
                          <Text style={[styles.timeSlotHours, { color: colors.primary }]}>
                            {slot.hours.toFixed(1)}h
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            {sitter && (
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Sitter: {sitter.displayName || sitter.email}
                </Text>
              </View>
            )}
            {session.searchScope && (
              <View style={styles.infoRow}>
                <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Search: {session.searchScope === 'invite' ? 'Invite Only' : session.searchScope === 'nearby' ? `Within ${session.maxDistanceKm}km` : session.searchScope === 'city' ? 'City Wide' : 'Nationwide'}
                </Text>
              </View>
            )}
            {session.location && typeof session.location === 'object' && session.location.address && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={2}>
                  Location: {session.location.address}
                </Text>
              </View>
            )}
            {session.hourlyRate && session.hourlyRate > 0 && (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Rate: ${session.hourlyRate.toFixed(2)}/hour
                </Text>
              </View>
            )}
            {session.notes && (
              <View style={styles.infoRow}>
                <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={3}>
                  Notes: {session.notes}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Enhanced GPS Tracking */}
        {session.status === 'active' && (
          <EnhancedGPSMap
            sessionId={id!}
            currentLocation={currentLocation || undefined}
            locationHistory={locationHistory}
            isTracking={session.gpsTrackingEnabled}
            geofenceCenter={session.location?.coordinates ? {
              latitude: session.location.coordinates.latitude,
              longitude: session.location.coordinates.longitude,
            } : undefined}
            geofenceRadius={100}
            onLocationPress={(location) => {
              // Handle location press
            }}
            onGeofenceViolation={() => {
              Alert.alert('Geofence Alert', 'Sitter has left the designated area');
            }}
          />
        )}

        {/* Children Info Card - Show all children if multiple */}
        {children.length > 1 && (
          <Card style={styles.infoCard}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
              Children in This Session ({children.length})
            </Text>
            {children.map((c, index) => (
              <View key={c.id} style={[styles.childRow, index < children.length - 1 && { marginBottom: 12 }]}>
                {c.photoUrl ? (
                  <Image source={{ uri: c.photoUrl }} style={styles.childThumbnail} />
                ) : (
                  <View style={[styles.childThumbnailPlaceholder, { backgroundColor: colors.border }]}>
                    <Ionicons name="person" size={20} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.childInfo}>
                  <Text style={[styles.childNameText, { color: colors.text }]}>{c.name}</Text>
                  {c.dateOfBirth && (
                    <Text style={[styles.childAgeText, { color: colors.textSecondary }]}>
                      {c.age ? `${c.age} years old` : 'Age not specified'}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Cry Detection */}
        {session.status === 'active' && (
          <CryDetectionIndicator
            isEnabled={session.cryDetectionEnabled || false}
            isActive={session.monitoringEnabled || false}
            lastDetection={lastCryDetection}
            alertCount={cryAlerts.length}
            recentAlerts={cryAlerts.slice(0, 5)}
            onViewAlerts={() => {
              router.push(`/(parent)/alerts?sessionId=${id}`);
            }}
          />
        )}

        {/* Enhanced Alerts View */}
        {alerts.length > 0 && (
          <View style={styles.alertsSection}>
            <EnhancedAlertsView
              sessionId={id!}
              userId={user?.id || ''}
              role="parent"
              onAlertPress={(alert) => {
                router.push(`/(parent)/alerts?sessionId=${id}&alertId=${alert.id}`);
              }}
              onEmergencyAction={(alert) => {
                handleEmergency();
              }}
            />
          </View>
        )}

        {/* Chatbot Access */}
        {session.status === 'active' && child && (
          <Card style={styles.chatbotCard}>
            <TouchableOpacity
              style={[styles.chatbotButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                router.push(`/(parent)/chatbot?sessionId=${id}&childId=${child.id}&sitterId=${session.sitterId}`);
              }}
            >
              <Ionicons name="chatbubbles" size={24} color={colors.white} />
              <Text style={[styles.chatbotButtonText, { color: colors.white }]}>
                Ask AI Assistant
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </TouchableOpacity>
          </Card>
        )}

        {/* Session Controls */}
        <SessionControls
          sessionStatus={session.status}
          onEndSession={handleEndSession}
          onEmergency={handleEmergency}
          onCancel={() => setCancelModalVisible(true)}
          isLoading={actionLoading}
          canEndSession={session.status === 'active'}
        />

        {/* Session Timeline */}
        <SessionTimeline session={session} />
      </ScrollView>

      {/* Cancel Session Modal */}
      {cancelModalVisible && session && (
        <CancelSessionModal
          visible={cancelModalVisible}
          session={session}
          onConfirm={async (reason: string, customReason?: string) => {
            setActionLoading(true);
            const cancellationReason = customReason || reason;
            const result = await cancelSession(session.id, cancellationReason);
            if (result.success) {
              Alert.alert('Success', 'Session cancelled successfully');
              router.back();
            } else {
              Alert.alert('Error', result.error?.message || 'Failed to cancel session');
            }
            setActionLoading(false);
            setCancelModalVisible(false);
          }}
          onClose={() => setCancelModalVisible(false)}
          loading={actionLoading}
        />
      )}
    </View>
  );
}

function getStatusColor(status: Session['status'], colors: any): string {
  switch (status) {
    case 'active':
      return colors.success;
    case 'completed':
      return colors.success;
    case 'cancelled':
      return colors.textSecondary;
    case 'accepted':
      return colors.info;
    default:
      return colors.warning;
  }
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  alertsSection: {
    marginTop: 8,
  },
  chatbotCard: {
    marginBottom: 0,
  },
  chatbotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
  },
  chatbotButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    marginBottom: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  childName: {
    fontSize: 18,
    fontWeight: '600',
  },
  sessionInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  childThumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childInfo: {
    flex: 1,
  },
  childNameText: {
    fontSize: 16,
    fontWeight: '600',
  },
  childAgeText: {
    fontSize: 14,
    marginTop: 2,
  },
  searchingSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  searchingTimeText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  acceptedSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
  timeSlotsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  timeSlotsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeSlotsTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  timeSlotsCount: {
    fontSize: 13,
  },
  timeSlotsScrollContainer: {
    maxHeight: 288, // 4 rows * 72px per row
  },
  timeSlotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  timeSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  timeSlotDetails: {
    flex: 1,
    gap: 4,
  },
  timeSlotDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeSlotTimeText: {
    fontSize: 13,
    marginTop: 2,
  },
  timeSlotRight: {
    alignItems: 'flex-end',
  },
  timeSlotHours: {
    fontSize: 15,
    fontWeight: '700',
  },
});
