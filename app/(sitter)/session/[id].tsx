/**
 * Sitter Session Detail Screen
 * Shows active session controls, monitoring interface, GPS tracking, and cry detection
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import ErrorDisplay from '@/src/components/ui/ErrorDisplay';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import GPSMapView from '@/src/components/session/GPSMapView';
import EnhancedGPSMap from '@/src/components/gps/EnhancedGPSMap';
import TwoPinMap from '@/src/components/gps/TwoPinMap';
import CryDetectionIndicator from '@/src/components/session/CryDetectionIndicator';
import CryDetectionInterface from '@/src/components/monitoring/CryDetectionInterface';
import MonitoringControls from '@/src/components/session/MonitoringControls';
import EmergencyCallButton from '@/src/components/session/EmergencyCallButton';
import SessionTimeline from '@/src/components/session/SessionTimeline';
import { useAuth } from '@/src/hooks/useAuth';
import {
  getSessionById,
  subscribeToSession,
  startSession,
  setSessionMonitoringEnabled,
  endSession,
  requestSessionEnd,
  updateSessionStatus,
  acceptSessionRequest,
  cancelSession,
} from '@/src/services/session.service';
import {
  getSessionGPSTracking,
  subscribeToGPSUpdates,
  updateGPSLocation,
  recordAndDetectCry,
} from '@/src/services/monitoring.service';
import {
  getSessionAlerts,
  subscribeToSessionAlerts,
} from '@/src/services/alert.service';
import { getInterviewBySession } from '@/src/services/interview.service';
import {
  startLocationTracking,
  getCurrentLocation,
  haversineDistanceMeters,
  estimateTravelTimeMinutes,
} from '@/src/services/location.service';
import * as Location from 'expo-location';
import { Session } from '@/src/types/session.types';
import { LocationUpdate } from '@/src/types/session.types';
import { Alert as AlertType } from '@/src/services/alert.service';
import { formatExpectedDuration } from '@/src/utils/sessionSearchUtils';
import { Ionicons } from '@expo/vector-icons';
import * as Audio from 'expo-av';
import { format } from 'date-fns';

// Helper function to format duration (from start to now)
function formatDuration(startTime: Date): string {
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

// Get parent location coordinates from session (object or JSON string)
function getParentCoords(location: Session['location']): { latitude: number; longitude: number } | null {
  if (!location) return null;
  let obj = location;
  if (typeof location === 'string') {
    try {
      obj = JSON.parse(location) as any;
    } catch {
      return null;
    }
  }
  if (obj && typeof obj === 'object') {
    if (obj.coordinates?.latitude != null && obj.coordinates?.longitude != null) {
      return { latitude: obj.coordinates.latitude, longitude: obj.coordinates.longitude };
    }
    if (obj.latitude != null && obj.longitude != null) {
      return { latitude: obj.latitude, longitude: obj.longitude };
    }
  }
  return null;
}

export default function SitterSessionDetailScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const handleBackToRequests = useCallback(() => {
    router.replace('/(sitter)/requests');
  }, [router]);

  const [session, setSession] = useState<Session | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationUpdate[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Monitoring state
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(false);
  const [cryDetectionEnabled, setCryDetectionEnabled] = useState(false);
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [locationTrackingStop, setLocationTrackingStop] = useState<(() => void) | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sitterLocationForMap, setSitterLocationForMap] = useState<LocationUpdate | null>(null);
  const [loadingSitterLocation, setLoadingSitterLocation] = useState(false);
  const [geocodedParentCoords, setGeocodedParentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const [interview, setInterview] = useState<{ meeting_link: string; scheduled_time: string } | null>(null);

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
      setSession(sessionData);
      if (sessionData.status === 'interview_scheduled' || sessionData.status === 'interview_completed') {
        const interviewRes = await getInterviewBySession(id);
        if (interviewRes.success && interviewRes.data) {
          setInterview({ meeting_link: interviewRes.data.meeting_link, scheduled_time: interviewRes.data.scheduled_time });
        } else {
          setInterview(null);
        }
      } else {
        setInterview(null);
      }
      setGpsTrackingEnabled(sessionData.gpsTrackingEnabled || false);
      setCryDetectionEnabled(sessionData.cryDetectionEnabled || false);
      setIsMonitoringActive(sessionData.monitoringEnabled || false);

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

  // Real-time subscriptions
  useEffect(() => {
    if (!id) return;

    // Subscribe to session updates
    const unsubscribeSession = subscribeToSession(id, (updatedSession) => {
      if (updatedSession) {
        setSession(updatedSession);
        setGpsTrackingEnabled(updatedSession.gpsTrackingEnabled || false);
        setCryDetectionEnabled(updatedSession.cryDetectionEnabled || false);
        setIsMonitoringActive(updatedSession.monitoringEnabled || false);
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
    });

    // Initial load
    loadSessionData();

    return () => {
      unsubscribeSession();
      unsubscribeGPS();
      unsubscribeAlerts();
    };
  }, [id, loadSessionData]);

  // Fetch sitter's current location once per session for map/distance (when session has parent coords)
  const sitterLocationFetchedForSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!session?.location || !id) return;
    const parentCoords = getParentCoords(session.location);
    if (!parentCoords) return;
    if (sitterLocationFetchedForSessionRef.current === id) return;
    sitterLocationFetchedForSessionRef.current = id;
    setLoadingSitterLocation(true);
    getCurrentLocation()
      .then((res) => {
        if (res.success && res.data) setSitterLocationForMap(res.data);
      })
      .finally(() => setLoadingSitterLocation(false));
  }, [id, session?.location]);

  // Geocode parent address when we have address but no coordinates (same as parent search when user types address)
  const geocodedForSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!session?.location || !id) return;
    if (getParentCoords(session.location)) {
      setGeocodedParentCoords(null);
      return;
    }
    let address = '';
    if (typeof session.location === 'string') {
      try {
        const parsed = JSON.parse(session.location) as any;
        if (parsed?.address) address = String(parsed.address).trim();
        else address = session.location.trim();
      } catch {
        address = session.location.trim();
      }
    } else if (session.location && typeof session.location === 'object' && (session.location as any).address) {
      address = String((session.location as any).address).trim();
    }
    if (address.length < 4 || geocodedForSessionRef.current === id) return;
    geocodedForSessionRef.current = id;
    setGeocodingAddress(true);
    Location.geocodeAsync(address)
      .then((results) => {
        if (results && results.length > 0) {
          const { latitude, longitude } = results[0];
          if (latitude != null && longitude != null) setGeocodedParentCoords({ latitude, longitude });
        }
      })
      .catch(() => {})
      .finally(() => setGeocodingAddress(false));
  }, [id, session?.location]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationTrackingStop) {
        locationTrackingStop();
      }
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [locationTrackingStop, recording]);

  // Handle start session (sitter only; BOOKED → LIVE)
  const handleStartSession = async () => {
    if (!session || !id) return;

    setActionLoading(true);
    const result = await startSession(id);
    setActionLoading(false);
    if (result.success && result.data) {
      setSession(result.data);
      Alert.alert('Session started', 'Monitoring features are now available.');
    } else {
      const msg = result.error?.message || 'Failed to start session';
      Alert.alert(
        msg.includes('assigned sitter') ? 'Cannot start' : msg.includes('already started') ? 'Already started' : 'Error',
        msg
      );
    }
  };

  // Handle toggle GPS tracking
  const handleToggleGPS = async (enabled: boolean) => {
    if (!session || !id) return;

    setGpsTrackingEnabled(enabled);

    if (enabled) {
      // Start location tracking
      const stopTracking = startLocationTracking(id, (location) => {
        setCurrentLocation(location);
        setLocationHistory((prev) => [...prev, location]);
        // Update in database
        if (user?.id) {
          updateGPSLocation(id, user.id, {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          });
        }
      });
      setLocationTrackingStop(() => stopTracking);
    } else {
      // Stop location tracking
      if (locationTrackingStop) {
        locationTrackingStop();
        setLocationTrackingStop(null);
      }
    }

    // Update session
    await updateSessionStatus(id, session.status, {
      gpsTrackingEnabled: enabled,
    } as any);
  };

  // Handle toggle cry detection
  const handleToggleCryDetection = async (enabled: boolean) => {
    if (!session || !id) return;

    setCryDetectionEnabled(enabled);

    // Update session
    await updateSessionStatus(id, session.status, {
      cryDetectionEnabled: enabled,
    } as any);
  };

  // Handle start monitoring
  const handleStartMonitoring = async () => {
    if (!session || !id || !user) return;

    setActionLoading(true);
    const toggleRes = await setSessionMonitoringEnabled(id, true);
    setActionLoading(false);
    if (!toggleRes.success || !toggleRes.data) {
      Alert.alert('Error', toggleRes.error?.message || 'Failed to enable monitoring.');
      return;
    }

    setSession(toggleRes.data);
    setIsMonitoringActive(true);

    // Auto-start monitoring components
    setGpsTrackingEnabled(true);
    setCryDetectionEnabled(true);
    handleToggleGPS(true);
    handleToggleCryDetection(true);
    startCryDetection();
  };

  // Handle stop monitoring
  const handleStopMonitoring = async () => {
    if (!session || !id) return;

    setActionLoading(true);
    const toggleRes = await setSessionMonitoringEnabled(id, false);
    setActionLoading(false);
    if (!toggleRes.success || !toggleRes.data) {
      Alert.alert('Error', toggleRes.error?.message || 'Failed to disable monitoring.');
      return;
    }
    setSession(toggleRes.data);
    setIsMonitoringActive(false);

    // Stop GPS tracking
    if (locationTrackingStop) {
      locationTrackingStop();
      setLocationTrackingStop(null);
    }

    // Stop cry detection
    if (recording) {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setIsRecording(false);
    }

    // Update session
    // (Backend state already updated via /monitoring)
  };

  // Start cry detection recording
  const startCryDetection = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required for cry detection');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);

      // Process audio chunks every 3 seconds
      const interval = setInterval(async () => {
        if (!newRecording || !session || !user) {
          clearInterval(interval);
          return;
        }

        try {
          const status = await newRecording.getStatusAsync();
          if (status.isRecording) {
            // Get recorded URI and convert to blob
            const uri = status.uri;
            const response = await fetch(uri);
            const blob = await response.blob();

            // Process cry detection
            if (session.childId && session.parentId) {
              await recordAndDetectCry(
                id!,
                session.childId,
                session.parentId,
                user.id,
                blob
              );
            }
          }
        } catch (err) {
          console.error('Error processing audio:', err);
        }
      }, 3000);

      // Cleanup interval when recording stops
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) {
          clearInterval(interval);
        }
      });
    } catch (err: any) {
      Alert.alert('Error', `Failed to start recording: ${err.message}`);
    }
  };

  // Handle end session (sitter or admin only; parent cannot end)
  const handleEndSession = async () => {
    if (!session || !id) return;

    // If sitter, send request-end instead of actually ending
    if (user?.role === 'sitter') {
      setActionLoading(true);
      const res = await requestSessionEnd(id);
      setActionLoading(false);
      if (res.success) {
        Alert.alert('Request sent', 'Your request to end the session has been sent to the parent.');
      } else {
        Alert.alert('Error', res.error?.message || 'Failed to send end-session request.');
      }
      return;
    }

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
            await handleStopMonitoring();
            const result = await endSession(id);
            setActionLoading(false);
            if (result.success && result.data) {
              setSession(result.data);
              Alert.alert('Success', 'Session ended successfully.');
            } else {
              Alert.alert('Error', result.error?.message || 'Failed to end session');
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

  const headerTitle = session?.status === 'requested' ? 'Session Request' : 'Active Session';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          showLogo={true} 
          title={session?.status === 'requested' ? 'Session Request' : 'Active Session'}
          onBack={handleBackToRequests}
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
        <SitterHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
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
          title="Session Request"
          onBack={handleBackToRequests}
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
        <SitterHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
        <ErrorDisplay
          error={{ message: error || 'Session not found' }}
          onRetry={loadSessionData}
        />
      </View>
    );
  }

  const cryAlerts = alerts.filter((a) => a.type === 'cry_detection');
  const lastCryDetection = cryAlerts.length > 0
    ? cryAlerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
    : undefined;

  const canStartSession = session.status === 'accepted' || session.status === 'booked';
  const isActive = session.status === 'active';
  const isRequested = session.status === 'requested';
  const isInterviewCompleted = session.status === 'interview_completed';
  const canAcceptSession = isRequested || isInterviewCompleted;

  // Handle accept (invite or broadcast request, or after interview)
  const handleAcceptRequest = async () => {
    if (!session || !id) return;
    setActionLoading(true);
    const result = await acceptSessionRequest(id);
    setActionLoading(false);
    if (result.success) {
      const updated = await getSessionById(id);
      if (updated.success && updated.data) setSession(updated.data);
      Alert.alert('Request accepted', 'You have accepted this session.');
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to accept request.');
    }
  };

  // Handle decline (invite or broadcast request)
  const handleDeclineRequest = async () => {
    if (!session || !id) return;
    setActionLoading(true);
    const result = await cancelSession(id, 'Declined by sitter');
    setActionLoading(false);
    if (result.success) {
      Alert.alert('Request declined', 'You have declined this session.', [
        { text: 'OK', onPress: () => router.replace('/(sitter)/requests') },
      ]);
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to decline request.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title={headerTitle} onBack={handleBackToRequests} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Session Info Card - Professional Design */}
        <Card style={styles.infoCard}>
          <View style={styles.sessionHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status, colors) }]}>
              <Text style={[styles.statusText, { color: colors.white }]}>
                {session.status === 'active' ? 'LIVE' : session.status === 'accepted' || session.status === 'booked' ? 'BOOKED' : session.status === 'payment_pending' ? 'PAYMENT PENDING' : session.status.toUpperCase().replace(/_/g, ' ')}
              </Text>
            </View>
            {session.location && (() => {
              // Helper to extract readable address
              const getReadableLocation = (location: any): string => {
                if (!location) return 'Location set';
                
                // If it's a string, check if it's JSON
                if (typeof location === 'string') {
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
                  if (location.coordinates) return 'Location set';
                }
                
                return 'Location set';
              };
              
              return (
                <View style={[styles.locationInfo, { backgroundColor: colors.primary + '10' }]}>
                  <Ionicons name="location" size={14} color={colors.primary} />
                  <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={2}>
                    {getReadableLocation(session.location)}
                  </Text>
                </View>
              );
            })()}
          </View>

          <View style={styles.sessionInfo}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIconContainer, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="time" size={14} color={colors.primary} />
              </View>
              <Text style={[styles.infoText, { color: colors.text }]}>
                {isRequested ? 'Date & time: ' : 'Started: '}{format(session.startTime, 'MMM dd, yyyy • h:mm a')}
              </Text>
            </View>
            {isActive && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: colors.success + '10' }]}>
                  <Ionicons name="hourglass" size={14} color={colors.success || '#10b981'} />
                </View>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  Duration: {formatDuration(session.startedAt ?? session.startTime)}
                </Text>
              </View>
            )}
            {session.hourlyRate && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: colors.warning + '10' }]}>
                  <Ionicons name="cash" size={14} color={colors.warning || '#f59e0b'} />
                </View>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  Rate: Rs. {session.hourlyRate.toFixed(0)}/hour
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Upcoming Interview: Join video call */}
        {session.status === 'interview_scheduled' && interview && (
          <Card style={styles.infoCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Interview</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 8 }]}>
              {new Date(interview.scheduled_time).toLocaleString()}
            </Text>
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={() => interview.meeting_link && Linking.openURL(interview.meeting_link)}
            >
              <Ionicons name="videocam" size={22} color={colors.white} />
              <Text style={[styles.startButtonText, { color: colors.white }]}>Join Video Call</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Session details: booking mode, duration, time slots (when requested) */}
        {isRequested && (
          <Card style={styles.infoCard}>
            <View style={styles.detailsSectionHeader}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
              <Text style={[styles.detailsSectionTitle, { color: colors.text }]}>
                Session details
              </Text>
            </View>
            <View style={styles.sessionInfo}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: colors.primary + '10' }]}>
                  <Ionicons name="time" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  Booking: {session.timeSlots && session.timeSlots.length > 0 ? 'Time slots' : 'Continuous'}
                </Text>
              </View>
              {(session.endTime || (session.timeSlots && session.timeSlots.length > 0)) && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: colors.success + '10' }]}>
                    <Ionicons name="hourglass" size={14} color={colors.success || '#10b981'} />
                  </View>
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    Duration: {formatExpectedDuration(session)}
                  </Text>
                </View>
              )}
              {session.endTime && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: colors.textSecondary + '20' }]}>
                    <Ionicons name="flag" size={14} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    End: {format(session.endTime, 'MMM dd, yyyy • h:mm a')}
                  </Text>
                </View>
              )}
            </View>
            {session.timeSlots && session.timeSlots.length > 0 && (
              <View style={styles.timeSlotsContainer}>
                <View style={styles.timeSlotsHeader}>
                  <Text style={[styles.timeSlotsTitle, { color: colors.text }]}>Time slots</Text>
                  {session.timeSlots.length > 4 && (
                    <Text style={[styles.timeSlotsCount, { color: colors.textSecondary }]}>
                      {session.timeSlots.length} slots
                    </Text>
                  )}
                </View>
                <ScrollView
                  style={styles.timeSlotsScrollContainer}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={session.timeSlots.length > 4}
                >
                  {session.timeSlots.map((slot, index) => {
                    let dateStr = slot.date;
                    let startStr = slot.startTime;
                    let endStr = slot.endTime;
                    try {
                      if (slot.date) {
                        const d = new Date(slot.date);
                        if (!isNaN(d.getTime())) dateStr = format(d, 'MMM dd, yyyy');
                      }
                      if (slot.startTime) {
                        const s = new Date(slot.startTime);
                        if (!isNaN(s.getTime())) startStr = format(s, 'h:mm a');
                      }
                      if (slot.endTime) {
                        const e = new Date(slot.endTime);
                        if (!isNaN(e.getTime())) endStr = format(e, 'h:mm a');
                      }
                    } catch (_) {}
                    return (
                      <View
                        key={index}
                        style={[styles.timeSlotRow, { borderLeftColor: colors.primary + '80' }]}
                      >
                        <View style={styles.timeSlotLeft}>
                          <Ionicons name="time-outline" size={16} color={colors.primary} />
                          <View style={styles.timeSlotDetails}>
                            <Text style={[styles.timeSlotDate, { color: colors.text }]}>{dateStr}</Text>
                            <Text style={[styles.timeSlotTimeText, { color: colors.textSecondary }]}>
                              {startStr} – {endStr}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.timeSlotRight}>
                          <Text style={[styles.timeSlotHours, { color: colors.primary }]}>
                            {slot.hours}h
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </Card>
        )}

        {/* Accept / Decline (when status = requested or after interview) */}
        {canAcceptSession && (
          <Card style={styles.actionCard}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>
              Session request
            </Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              {isInterviewCompleted
                ? 'Interview completed. Accept to confirm booking — parent will then pay to secure the session.'
                : 'Review the details above. Accept to book this session or decline if you\'re not available.'}
            </Text>
            <View style={styles.actionButtonRow}>
              <TouchableOpacity
                style={[
                  styles.requestActionButton,
                  styles.declineButton,
                  { borderColor: colors.error || '#ef4444', backgroundColor: 'transparent' },
                ]}
                onPress={handleDeclineRequest}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle-outline" size={22} color={colors.error || '#ef4444'} />
                <Text style={[styles.requestActionButtonText, { color: colors.error || '#ef4444' }]}>
                  Decline
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.requestActionButton,
                  styles.acceptButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleAcceptRequest}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color={colors.white} />
                    <Text style={[styles.requestActionButtonText, { color: colors.white }]}>
                      Accept
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Location & map: parent + sitter locations, distance, estimated travel time */}
        {session.location && (
          <Card style={styles.infoCard}>
            <View style={styles.locationMapHeader}>
              <Ionicons name="map" size={20} color={colors.primary} />
              <Text style={[styles.locationMapTitle, { color: colors.text }]}>
                Location & map
              </Text>
            </View>
            {(() => {
              const getReadableLocation = (location: any): string => {
                if (!location) return 'Location set';
                if (typeof location === 'string') {
                  try {
                    const parsed = JSON.parse(location);
                    if (parsed && typeof parsed === 'object') return parsed.address || parsed.city || location;
                  } catch { return location; }
                  return location;
                }
                if (typeof location === 'object') {
                  if (location.address) return location.address;
                  if (location.city) return location.city;
                  if (location.coordinates) return 'Location set';
                }
                return 'Location set';
              };
              const parentCoords = getParentCoords(session.location) || geocodedParentCoords;
              const sitterLoc = isActive && currentLocation ? currentLocation : sitterLocationForMap;
              const distanceMeters = parentCoords && sitterLoc
                ? haversineDistanceMeters(
                    sitterLoc.latitude,
                    sitterLoc.longitude,
                    parentCoords.latitude,
                    parentCoords.longitude
                  )
                : null;
              const distanceKm = distanceMeters != null ? distanceMeters / 1000 : null;
              const travelMin = distanceKm != null ? estimateTravelTimeMinutes(distanceKm) : null;

              return (
                <>
                  <View style={[styles.locationInfo, { backgroundColor: colors.primary + '10' }]}>
                    <Ionicons name="location" size={14} color={colors.primary} />
                    <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={2}>
                      Parent: {getReadableLocation(session.location)}
                    </Text>
                  </View>
                  {parentCoords && (
                    <>
                      {sitterLoc ? (
                        <>
                          <TwoPinMap
                            parentCoords={parentCoords}
                            sitterCoords={{ latitude: sitterLoc.latitude, longitude: sitterLoc.longitude }}
                            distanceKm={distanceKm ?? 0}
                            travelMin={travelMin ?? 0}
                          />
                        </>
                      ) : (
                        <View style={styles.locationPromptCard}>
                          <Text style={[styles.locationPromptTitle, { color: colors.text }]}>
                            Enable location to see map & distance
                          </Text>
                          <Text style={[styles.locationPromptHint, { color: colors.textSecondary }]}>
                            Allow location access to show your position and the parent on the map, and to calculate distance and travel time.
                          </Text>
                          {loadingSitterLocation ? (
                            <View style={styles.locationPromptLoading}>
                              <ActivityIndicator size="small" color={colors.primary} />
                              <Text style={[styles.locationPromptLoadingText, { color: colors.textSecondary }]}>
                                Getting your location…
                              </Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[styles.useMyLocationButton, { backgroundColor: colors.primary }]}
                              onPress={() => {
                                setLoadingSitterLocation(true);
                                getCurrentLocation()
                                  .then((res) => {
                                    if (res.success && res.data) setSitterLocationForMap(res.data);
                                    else Alert.alert('Location', 'Could not get location. Please enable location access in device settings.');
                                  })
                                  .finally(() => setLoadingSitterLocation(false));
                              }}
                            >
                              <Ionicons name="locate" size={22} color={colors.white} />
                              <Text style={[styles.useMyLocationButtonText, { color: colors.white }]}>
                                Use my location
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </>
                  )}
                  {!parentCoords && (
                    <>
                      {geocodingAddress ? (
                        <View style={styles.locationPromptCard}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={[styles.locationPromptHint, { color: colors.textSecondary }]}>
                            Looking up address for map…
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.locationHint, { color: colors.textSecondary }]}>
                          Address only — no coordinates for map or distance.
                        </Text>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </Card>
        )}

        {/* Start Session Button (if accepted) */}
        {canStartSession && (
          <Card style={styles.actionCard}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>
              Ready to start?
            </Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Once you start the session, monitoring features will become available.
            </Text>
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[styles.startButton, { backgroundColor: colors.primary }]}
                onPress={handleStartSession}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="play" size={20} color={colors.white} />
                    <Text style={[styles.startButtonText, { color: colors.white }]}>
                      Start Session
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Monitoring Controls (if active) */}
        {isActive && (
          <>
            <MonitoringControls
              gpsTrackingEnabled={gpsTrackingEnabled}
              cryDetectionEnabled={cryDetectionEnabled}
              onToggleGPS={handleToggleGPS}
              onToggleCryDetection={handleToggleCryDetection}
              onStartMonitoring={handleStartMonitoring}
              onStopMonitoring={handleStopMonitoring}
              isMonitoringActive={isMonitoringActive}
              isLoading={actionLoading}
            />

            {/* Enhanced GPS Tracking */}
            {gpsTrackingEnabled && (
              <EnhancedGPSMap
                sessionId={id!}
                currentLocation={currentLocation || undefined}
                locationHistory={locationHistory}
                isTracking={isMonitoringActive && gpsTrackingEnabled}
                geofenceCenter={session.location?.coordinates ? {
                  latitude: session.location.coordinates.latitude,
                  longitude: session.location.coordinates.longitude,
                } : undefined}
                geofenceRadius={100}
                onLocationPress={(location) => {
                  // Handle location press
                }}
                onGeofenceViolation={() => {
                  Alert.alert('Geofence Alert', 'You have left the designated area');
                }}
              />
            )}

            {/* Enhanced Cry Detection Interface */}
            {cryDetectionEnabled && session.childId && session.parentId && (
              <CryDetectionInterface
                sessionId={id!}
                childId={session.childId}
                parentId={session.parentId}
                sitterId={user?.id || ''}
                isEnabled={cryDetectionEnabled}
                onToggle={handleToggleCryDetection}
              />
            )}

            {/* Chatbot Access */}
            {session.childId && (
              <Card style={styles.chatbotCard}>
                <TouchableOpacity
                  style={[styles.chatbotButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    router.push(`/(sitter)/chatbot?sessionId=${id}&childId=${session.childId}`);
                  }}
                >
                  <Ionicons name="reader-outline" size={24} color={colors.white} />
                  <Text style={[styles.chatbotButtonText, { color: colors.white }]}>
                    Child Assistant
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.white} />
                </TouchableOpacity>
              </Card>
            )}

            {/* End Session Button */}
            <Card style={styles.endSessionCard}>
              <TouchableOpacity
                style={[styles.endSessionButton, { borderColor: colors.border }]}
                onPress={handleEndSession}
                disabled={actionLoading}
              >
                <Ionicons name="stop-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.endSessionText, { color: colors.textSecondary }]}>
                  End Session
                </Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        {/* Sitter: Completed session summary (duration + earnings) */}
        {session.status === 'completed' && (
          <Card style={styles.infoCard}>
            <Text style={[styles.detailsSectionTitle, { color: colors.text }]}>
              Session completed
            </Text>
            <View style={styles.sessionInfo}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: colors.success + '10' }]}>
                  <Ionicons name="time" size={14} color={colors.success || '#10b981'} />
                </View>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  Session duration: {session.startedAt && session.completedAt
                    ? formatDurationBetween(session.startedAt, session.completedAt)
                    : session.startTime && (session.completedAt ?? session.endTime)
                      ? formatDurationBetween(session.startTime, session.completedAt ?? session.endTime!)
                      : '—'}
                </Text>
              </View>
              {(session.totalAmount != null || session.hourlyRate != null) && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconContainer, { backgroundColor: colors.warning + '10' }]}>
                    <Ionicons name="cash" size={14} color={colors.warning || '#f59e0b'} />
                  </View>
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    Earnings: {session.totalAmount != null
                      ? `Rs. ${session.totalAmount.toFixed(0)}`
                      : session.hourlyRate != null
                        ? `Rs. ${session.hourlyRate.toFixed(0)}/hr`
                        : '—'}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Session Timeline */}
        <SessionTimeline session={session} role="sitter" />
      </ScrollView>

      <EmergencyCallButton session={session} role="sitter" />
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
    case 'booked':
      return colors.info;
    case 'payment_pending':
      return colors.warning;
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
  },
  sessionInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: '60%',
  },
  locationText: {
    fontSize: 12,
    flex: 1,
  },
  locationMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  locationMapTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  distanceTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  distanceTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  distanceTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationHint: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  locationPromptCard: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
  },
  locationPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationPromptHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  locationPromptLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  locationPromptLoadingText: {
    fontSize: 14,
  },
  useMyLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 4,
  },
  useMyLocationButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeSlotsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
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
    maxHeight: 240,
  },
  timeSlotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  timeSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  timeSlotDetails: {
    flex: 1,
    gap: 2,
  },
  timeSlotDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeSlotTimeText: {
    fontSize: 13,
  },
  timeSlotRight: {
    alignItems: 'flex-end',
  },
  timeSlotHours: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionCard: {
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  requestActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  declineButton: {
    borderWidth: 2,
  },
  acceptButton: {
    borderWidth: 0,
  },
  requestActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonContainer: {
    width: '100%',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  endSessionCard: {
    marginBottom: 16,
  },
  endSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  chatbotCard: {
    marginBottom: 16,
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
  endSessionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
