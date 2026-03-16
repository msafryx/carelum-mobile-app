/**
 * Parent Session Detail Screen
 * Shows active session details, GPS tracking, cry detection alerts, and session controls
 */
import EnhancedAlertsView from '@/src/components/alerts/EnhancedAlertsView';
import EnhancedGPSMap from '@/src/components/gps/EnhancedGPSMap';
import CancelSessionModal from '@/src/components/session/CancelSessionModal';
import CryDetectionIndicator from '@/src/components/session/CryDetectionIndicator';
import SessionControls from '@/src/components/session/SessionControls';
import EmergencyCallButton from '@/src/components/session/EmergencyCallButton';
import SessionTimeline from '@/src/components/session/SessionTimeline';
import { createReview, getReviewForSession, type Review } from '@/src/services/review.service';
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
import { createPaymentIntent } from '@/src/services/payment.service';
import { getInterviewBySession, scheduleInterview } from '@/src/services/interview.service';
import {
    cancelSession,
    completeSession,
    getSessionById,
    subscribeToSession,
} from '@/src/services/session.service';
import { Child } from '@/src/types/child.types';
import { LocationUpdate, Session } from '@/src/types/session.types';
import { formatExpectedDuration, formatSearchDuration, getAcceptedDuration, getSearchingMessage, isDirectInvite } from '@/src/utils/sessionSearchUtils';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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

function formatMonitoringDuration(startTime?: Date): string {
  if (!startTime) return '0m';
  const now = new Date();
  const diff = now.getTime() - startTime.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDurationBetween(start: Date, end: Date): string {
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return '0m';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
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
  const [interview, setInterview] = useState<{ meeting_link: string; scheduled_time: string; status: string } | null>(null);
  const [searchDuration, setSearchDuration] = useState<string>('');
  const searchDurationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [payButtonLoading, setPayButtonLoading] = useState(false);
  const [sessionReview, setSessionReview] = useState<Review | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateModalSessionId, setRateModalSessionId] = useState<string | null>(null);
  const [rateModalSitterId, setRateModalSitterId] = useState<string | null>(null);
  const [rateStars, setRateStars] = useState(0);
  const [rateComment, setRateComment] = useState('');
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [justEndedSession, setJustEndedSession] = useState(false);
  const isExpoGo = Constants.appOwnership === 'expo';
  const LazyPaymentSheetFlow = React.useMemo(
    () => React.lazy(() => import('@/src/components/session/PaymentSheetFlow')),
    []
  );

  const monitoringEnabled = session?.monitoringEnabled || false;
  const lastSignal =
    session?.lastLocationAt && session.lastAudioSignalAt
      ? new Date(Math.max(session.lastLocationAt.getTime(), session.lastAudioSignalAt.getTime()))
      : session?.lastLocationAt || session?.lastAudioSignalAt || null;
  const monitoringUnstable =
    monitoringEnabled &&
    lastSignal &&
    (Date.now() - lastSignal.getTime() > 2 * 60 * 1000);
  const monitoringStatusLabel = !monitoringEnabled
    ? 'Monitoring OFF'
    : monitoringUnstable
      ? 'Monitoring UNSTABLE'
      : 'Monitoring ACTIVE';

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

      if (sessionData.status === 'interview_scheduled' || sessionData.status === 'interview_completed') {
        const interviewRes = await getInterviewBySession(id!);
        if (interviewRes.success && interviewRes.data) {
          setInterview({
            meeting_link: interviewRes.data.meeting_link,
            scheduled_time: interviewRes.data.scheduled_time,
            status: interviewRes.data.status,
          });
        } else {
          setInterview(null);
        }
      } else {
        setInterview(null);
      }

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

  // Load review for completed session
  useEffect(() => {
    if (!id || !session || session.status !== 'completed') return;
    let cancelled = false;
    (async () => {
      const res = await getReviewForSession(id);
      if (!cancelled && res.success) setSessionReview(res.data ?? null);
    })();
    return () => { cancelled = true; };
  }, [id, session?.status]);

  // Handle end session (payment required: charged for time used, then session ends)
  const handleEndSession = async () => {
    if (!session || !id) return;

    Alert.alert(
      'End Session',
      'You will be charged for the time used (or full amount). Payment must succeed before the session ends. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await completeSession(id);
            if (result.success) {
              const amount = result.data?.totalAmount;
              const message = amount != null && amount > 0
                ? `Session ended. You were charged Rs. ${amount.toFixed(2)} for the time used.`
                : 'Session ended successfully.';
              Alert.alert('Success', message);
              await loadSessionData();
              setJustEndedSession(true);
              setRateModalSessionId(id);
              setRateModalSitterId(session.sitterId ?? null);
              setRateStars(0);
              setRateComment('');
              setShowRateModal(true);
            } else {
              const errMsg = result.error?.message || 'Failed to end session';
              const isPaymentError = errMsg.toLowerCase().includes('payment') || errMsg.toLowerCase().includes('profile') || errMsg.toLowerCase().includes('card');
              Alert.alert(
                isPaymentError ? 'Payment required' : 'Cannot end session',
                errMsg.includes('Profile') ? `${errMsg} Open Profile to add a payment method.` : errMsg
              );
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
                  {session.status === 'active' ? 'LIVE' : session.status === 'accepted' || session.status === 'booked' ? 'BOOKED' : session.status === 'payment_pending' ? 'PAYMENT REQUIRED' : session.status.toUpperCase().replace(/_/g, ' ')}
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
                  Duration: {formatDuration(session.startedAt ?? session.startTime)}
                </Text>
              </View>
            )}
            {session.status === 'requested' && (
              <View style={styles.searchingSection}>
                <View style={styles.searchingIndicator}>
                  {isDirectInvite(session) ? (
                    <Ionicons name="mail" size={16} color={colors.primary} />
                  ) : (
                    <SearchingAnimation />
                  )}
                  <Text style={[styles.searchingText, { color: colors.primary }]}>
                    {getSearchingMessage(session)}
                  </Text>
                </View>
                {session.createdAt && (
                  <View style={styles.searchingTimeRow}>
                    <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.searchingTimeText, { color: colors.textSecondary }]}>
                      {isDirectInvite(session) ? 'Waiting for ' : 'Searching for '}{searchDuration || (() => {
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
                {session.status === 'requested' && !session.sitterId && (
                  <Text style={[styles.helperText, { color: colors.textSecondary, marginTop: 8 }]}>
                    When a sitter accepts, you can schedule an online video call here before confirming the booking.
                  </Text>
                )}
              </View>
            )}
            {session.status === 'requested' && session.sitterId && (
              <View style={styles.interviewSection}>
                <Text style={[styles.paymentSectionTitle, { color: colors.text }]}>
                  Video call before booking
                </Text>
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Meet your sitter in a short online video call before you confirm. Schedule the call and both of you can join when it's time.
                </Text>
                <TouchableOpacity
                  style={[styles.confirmPayButton, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    const preferredTime = session.startTime ? session.startTime.toISOString() : new Date(Date.now() + 86400000).toISOString();
                    const res = await scheduleInterview(session.id, preferredTime);
                    if (res.success && res.data) {
                      Alert.alert('Interview scheduled', 'Sitter has been notified. You can join when it\'s time.');
                      loadSessionData();
                    } else {
                      Alert.alert('Error', res.error?.message || 'Could not schedule interview.');
                    }
                  }}
                >
                  <Ionicons name="videocam-outline" size={20} color="#fff" />
                  <Text style={styles.confirmPayButtonText}>Schedule video call</Text>
                </TouchableOpacity>
              </View>
            )}
            {session.status === 'interview_scheduled' && interview && (
              <View style={styles.interviewSection}>
                <Text style={[styles.paymentSectionTitle, { color: colors.text }]}>Upcoming Interview</Text>
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  {new Date(interview.scheduled_time).toLocaleString()}
                </Text>
                <TouchableOpacity
                  style={[styles.confirmPayButton, { backgroundColor: colors.primary }]}
                  onPress={() => interview.meeting_link && Linking.openURL(interview.meeting_link)}
                >
                  <Ionicons name="videocam" size={20} color="#fff" />
                  <Text style={styles.confirmPayButtonText}>Join Video Call</Text>
                </TouchableOpacity>
              </View>
            )}
            {session.status === 'payment_pending' && (
              <View style={styles.paymentSection}>
                <Text style={[styles.paymentSectionTitle, { color: colors.text }]}>Session cost</Text>
                <Text style={[styles.estimatedAmount, { color: colors.text }]}>
                  Rs. {(session.estimatedAmount ?? session.totalAmount ?? 0).toFixed(2)} (estimated)
                </Text>
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Add a payment method in Profile if you have not. You will be charged (Rs. for time used) when you end the session. Sitter can start once you have added an account.
                </Text>
                {paymentClientSecret && !isExpoGo && (
                  <React.Suspense fallback={null}>
                    <LazyPaymentSheetFlow
                      clientSecret={paymentClientSecret}
                      merchantDisplayName="Carelum"
                      onSuccess={() => {
                        setPaymentClientSecret(null);
                        loadSessionData();
                      }}
                      onCancel={() => setPaymentClientSecret(null)}
                      onError={(msg) => Alert.alert('Payment error', msg)}
                    />
                  </React.Suspense>
                )}
                <TouchableOpacity
                  style={[styles.confirmPayButton, { backgroundColor: colors.primary, opacity: payButtonLoading ? 0.7 : 1 }]}
                  onPress={async () => {
                    if (payButtonLoading) return;
                    setPayButtonLoading(true);
                    try {
                      const res = await createPaymentIntent(session.id);
                      const secret = res.data?.clientSecret ?? (res.data as any)?.client_secret;
                      if (res.success && secret) {
                        if (isExpoGo) {
                          Alert.alert(
                            'Expo Go',
                            'Payment will be collected when you end the session. For the in-app payment sheet, use a development build (expo run:android or expo run:ios).'
                          );
                          loadSessionData();
                        } else {
                          setPaymentClientSecret(secret);
                        }
                      } else {
                        Alert.alert('Error', res.error?.message || 'Could not start payment. Please try again.');
                      }
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || 'Could not start payment. Please try again.');
                    } finally {
                      setPayButtonLoading(false);
                    }
                  }}
                  disabled={payButtonLoading}
                >
                  {payButtonLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="card" size={20} color="#fff" />
                      <Text style={styles.confirmPayButtonText}>Confirm and Pay</Text>
                    </>
                  )}
                </TouchableOpacity>
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
                  Rate: Rs. {session.hourlyRate.toFixed(2)}/hour
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

        {/* Monitoring Status */}
        {session.status === 'active' && (
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons
                name={!monitoringEnabled ? 'power' : monitoringUnstable ? 'warning' : 'radio'}
                size={16}
                color={!monitoringEnabled ? colors.textSecondary : monitoringUnstable ? (colors.warning || colors.textSecondary) : (colors.success || colors.primary)}
              />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {monitoringStatusLabel}
                {monitoringEnabled ? ` • ${formatMonitoringDuration(session.monitoringStartedAt)}` : ''}
              </Text>
            </View>
          </Card>
        )}

        {/* Enhanced GPS Tracking */}
        {session.status === 'active' && monitoringEnabled && (
          <EnhancedGPSMap
            sessionId={id!}
            currentLocation={currentLocation || undefined}
            locationHistory={locationHistory}
            isTracking={session.gpsTrackingEnabled ?? session.monitoringEnabled ?? false}
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
        {session.status === 'active' && monitoringEnabled && (
          <CryDetectionIndicator
            isEnabled={session.cryDetectionEnabled ?? session.monitoringEnabled ?? false}
            isActive={session.monitoringEnabled ?? false}
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

        {/* Parent: Completed session summary + rate sitter */}
        {session.status === 'completed' && (
          <Card style={styles.infoCard}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
              Session completed
            </Text>
            <View style={styles.sessionInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Total duration: {session.startedAt && session.completedAt
                    ? formatDurationBetween(session.startedAt, session.completedAt)
                    : session.startTime && (session.completedAt ?? session.endTime)
                      ? formatDurationBetween(session.startTime, session.completedAt ?? session.endTime!)
                      : '—'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="radio-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Monitoring ended
                </Text>
              </View>
            </View>
            {sessionReview ? (
              <View style={styles.reviewSummary}>
                <View style={styles.infoRow}>
                  <Ionicons name="star" size={16} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.text }]}>You rated: {sessionReview.rating} star{sessionReview.rating !== 1 ? 's' : ''}</Text>
                </View>
                {sessionReview.comment ? (
                  <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{sessionReview.comment}</Text>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.rateButton, { backgroundColor: colors.primary, marginBottom: 8 }]}
                onPress={() => {
                  setRateModalSessionId(session.id);
                  setRateModalSitterId(session.sitterId ?? null);
                  setJustEndedSession(false);
                  setRateStars(0);
                  setRateComment('');
                  setShowRateModal(true);
                }}
              >
                <Ionicons name="star" size={20} color={colors.white} />
                <Text style={[styles.rateButtonText, { color: colors.white }]}>Rate & feedback</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.rateButton, { backgroundColor: colors.primary }]}
              onPress={async () => {
                const { getSessionReport } = await import('@/src/services/session.service');
                const reportRes = await getSessionReport(session.id);
                if (!reportRes.success || !reportRes.data) {
                  Alert.alert('Error', reportRes.error?.message || 'Failed to load session report.');
                  return;
                }
                const report = reportRes.data;
                const lines = [
                  `Session: ${report.sessionId}`,
                  report.startedAt ? `Started: ${report.startedAt}` : null,
                  report.endedAt ? `Ended: ${report.endedAt}` : null,
                  report.monitoringDurationMinutes != null ? `Monitoring: ${report.monitoringDurationMinutes} min` : null,
                  `Cry alerts: ${report.cryAlertCount}`,
                  `GPS points: ${report.gpsPointCount}`,
                ].filter(Boolean);
                Alert.alert('Session report', lines.join('\n'));
              }}
            >
              <Ionicons name="document-text" size={20} color={colors.white} />
              <Text style={[styles.rateButtonText, { color: colors.white }]}>Download report</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Session Timeline – at bottom */}
        <SessionTimeline session={session} role="parent" />

        {/* Session Controls – at bottom */}
        {session.status === 'active' && (
          <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 8 }]}>
            When you end the session, you'll be charged only for the time used (prorated).
          </Text>
        )}
        <SessionControls
          sessionStatus={session.status}
          onEndSession={handleEndSession}
          onEmergency={handleEmergency}
          onCancel={() => setCancelModalVisible(true)}
          isLoading={actionLoading}
          canEndSession={session.status === 'active'}
        />
      </ScrollView>

      {/* Two circles: left = Emergency, right = Assistant (same as home screen) */}
      {session.status === 'active' && child && (
        <TouchableOpacity
          style={[styles.fabCircle, styles.fabCircleRight, { backgroundColor: colors.primary }]}
          onPress={() => router.push(`/(parent)/chatbot?sessionId=${id}&childId=${child.id}&sitterId=${session.sitterId}` as any)}
          activeOpacity={0.9}
        >
          <Ionicons name="chatbubbles" size={28} color={colors.white} />
        </TouchableOpacity>
      )}
      <EmergencyCallButton session={session} role="parent" position="left" />

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

      {/* Rate & feedback modal (after end session or from completed card) */}
      <Modal visible={showRateModal} transparent animationType="fade">
        <View style={styles.rateModalOverlay}>
          <View style={[styles.rateModalContent, { backgroundColor: (colors as any).card ?? colors.background }]}>
            <Text style={[styles.rateModalTitle, { color: colors.text }]}>Rate this session</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRateStars(n)} style={styles.starTouch}>
                  <Ionicons name={rateStars >= n ? 'star' : 'star-outline'} size={36} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.rateCommentInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Optional feedback (e.g. how was the sitter?)"
              placeholderTextColor={colors.textSecondary}
              value={rateComment}
              onChangeText={setRateComment}
              multiline
              numberOfLines={3}
            />
            <View style={styles.rateModalButtons}>
              <TouchableOpacity style={[styles.rateModalButton, { backgroundColor: colors.border }]} onPress={() => { setShowRateModal(false); setRateModalSessionId(null); setRateModalSitterId(null); setRateStars(0); setRateComment(''); if (justEndedSession) router.back(); }}>
                <Text style={[styles.rateModalButtonText, { color: colors.text }]}>{rateModalSessionId && rateModalSitterId ? 'Skip' : 'Close'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rateModalButton, { backgroundColor: colors.primary }]}
                disabled={rateStars < 1 || rateSubmitting}
                onPress={async () => {
                  if (!rateModalSessionId || !rateModalSitterId || rateStars < 1) return;
                  setRateSubmitting(true);
                  const res = await createReview({ sessionId: rateModalSessionId, sitterId: rateModalSitterId, rating: rateStars, comment: rateComment.trim() || undefined });
                  setRateSubmitting(false);
                  if (res.success) {
                    setSessionReview({ id: '', session_id: rateModalSessionId, reviewer_id: '', reviewee_id: rateModalSitterId, rating: rateStars, comment: rateComment.trim() || null, created_at: new Date().toISOString() });
                    setShowRateModal(false);
                    setRateModalSessionId(null);
                    setRateModalSitterId(null);
                    setRateStars(0);
                    setRateComment('');
                    const wasJustEnded = justEndedSession;
                    setJustEndedSession(false);
                    if (wasJustEnded) router.back();
                    else Alert.alert('Thanks', 'Your feedback has been submitted.');
                  } else {
                    Alert.alert('Error', res.error?.message ?? 'Failed to submit review.');
                  }
                }}
              >
                <Text style={[styles.rateModalButtonText, { color: colors.white }]}>{rateSubmitting ? 'Submitting…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStatusColor(status: Session['status'], colors: any): string {
  switch (status) {
    case 'active':
      return colors.success;
    case 'completed':
      return colors.success;
    case 'booked':
      return colors.info;
    case 'cancelled':
      return colors.textSecondary;
    case 'accepted':
      return colors.info;
    case 'payment_pending':
      return colors.warning;
    case 'interview_scheduled':
    case 'interview_completed':
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
    paddingBottom: 100,
  },
  alertsSection: {
    marginTop: 8,
  },
  chatbotCard: {
    marginBottom: 0,
  },
  fabCircle: {
    position: 'absolute',
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 99,
  },
  fabCircleRight: {
    right: 20,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewSummary: {
    marginTop: 12,
    gap: 6,
  },
  reviewComment: {
    fontSize: 14,
    marginTop: 4,
    fontStyle: 'italic',
  },
  rateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  rateModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
  },
  rateModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  starTouch: {
    padding: 4,
  },
  rateCommentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rateModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  rateModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  rateModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  paymentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  interviewSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  paymentSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  estimatedAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    marginBottom: 12,
  },
  confirmPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  confirmPayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
