/**
 * Sitter Session Detail Screen
 * Shows active session controls, monitoring interface, GPS tracking, and cry detection
 */
import EnhancedGPSMap from '@/src/components/gps/EnhancedGPSMap';
import TwoPinMap from '@/src/components/gps/TwoPinMap';
import CryDetectionInterface from '@/src/components/monitoring/CryDetectionInterface';
import EmergencyCallButton from '@/src/components/session/EmergencyCallButton';
import MonitoringControls from '@/src/components/session/MonitoringControls';
import SessionTimeline from '@/src/components/session/SessionTimeline';
import Card from '@/src/components/ui/Card';
import ErrorDisplay from '@/src/components/ui/ErrorDisplay';
import Header from '@/src/components/ui/Header';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import {
    Alert as AlertType,
    getSessionAlerts,
    subscribeToSessionAlerts,
} from '@/src/services/alert.service';
import { getInterviewBySession } from '@/src/services/interview.service';
import {
    estimateTravelTimeMinutes,
    getCurrentLocation,
    haversineDistanceMeters,
    startLocationTracking,
} from '@/src/services/location.service';
import {
    getSessionGPSTracking,
    recordAndDetectCry,
    subscribeToGPSUpdates,
    updateGPSLocation,
} from '@/src/services/monitoring.service';
import {
    acceptSessionRequest,
    cancelSession,
    getSessionById,
    requestSessionEnd,
    setSessionMonitoringEnabled,
    startSession,
    subscribeToSession,
    updateSessionStatus
} from '@/src/services/session.service';
import { LocationUpdate, Session } from '@/src/types/session.types';
import { findMostRecentRecordingUri } from '@/src/utils/audioFileUtils';
import { setCurrentRecording, stopCurrentRecordingIfAny } from '@/src/utils/audioRecordingSingleton';
import { formatExpectedDuration } from '@/src/utils/sessionSearchUtils';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { setAudioModeAsync } from 'expo-av/build/Audio';
import {
    Recording,
    RecordingOptionsPresets,
    requestPermissionsAsync as requestAudioPermissionsAsync,
} from 'expo-av/build/Audio/Recording';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

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
  const locationTrackingStopRef = useRef<(() => void) | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lastAudioChunkSentAt, setLastAudioChunkSentAt] = useState<number | null>(null);
  const [sitterLocationForMap, setSitterLocationForMap] = useState<LocationUpdate | null>(null);
  const [loadingSitterLocation, setLoadingSitterLocation] = useState(false);
  const [geocodedParentCoords, setGeocodedParentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const [interview, setInterview] = useState<{ meeting_link: string; scheduled_time: string } | null>(null);

  // Location history: only add when position changed (>= 15m) or at least every 5 minutes
  const lastHistoryUpdateRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const MIN_MOVE_METERS = 15;
  const HISTORY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const shouldAddToLocationHistory = (location: LocationUpdate): boolean => {
    const now = Date.now();
    const last = lastHistoryUpdateRef.current;
    if (!last) return true;
    const distance = haversineDistanceMeters(last.lat, last.lon, location.latitude, location.longitude);
    const elapsed = now - last.time;
    return distance >= MIN_MOVE_METERS || elapsed >= HISTORY_INTERVAL_MS;
  };

  const addToLocationHistoryIfNeeded = (location: LocationUpdate) => {
    setCurrentLocation(location);
    if (!shouldAddToLocationHistory(location)) return;
    lastHistoryUpdateRef.current = {
      lat: location.latitude,
      lon: location.longitude,
      time: Date.now(),
    };
    setLocationHistory((prev) => [...prev, location]);
    if (id && user?.id) {
      updateGPSLocation(id, user.id, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });
    }
  };

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
      const monEnabled = !!sessionData.monitoringEnabled;
      const gpsOn = sessionData.gpsTrackingEnabled ?? monEnabled ?? false;
      const cryOn = sessionData.cryDetectionEnabled ?? monEnabled ?? false;
      setGpsTrackingEnabled(gpsOn);
      setCryDetectionEnabled(cryOn);
      setIsMonitoringActive(monEnabled);
      isMonitoringActiveRef.current = monEnabled;

      // Process GPS tracking
      if (gpsResult.success && gpsResult.data) {
        const tracking = gpsResult.data;
        if (tracking.length > 0) {
          const latest = tracking[tracking.length - 1];
          const history = tracking.map((t) => ({
            latitude: t.location.latitude,
            longitude: t.location.longitude,
            timestamp: t.timestamp,
            accuracy: t.location.accuracy,
          }));
          setCurrentLocation({
            latitude: latest.location.latitude,
            longitude: latest.location.longitude,
            timestamp: latest.timestamp,
            accuracy: latest.location.accuracy,
          });
          setLocationHistory(history);
          lastHistoryUpdateRef.current = {
            lat: latest.location.latitude,
            lon: latest.location.longitude,
            time: new Date(latest.timestamp).getTime(),
          };
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
        const monEnabled = !!updatedSession.monitoringEnabled;
        setGpsTrackingEnabled(updatedSession.gpsTrackingEnabled ?? monEnabled ?? false);
        setCryDetectionEnabled(updatedSession.cryDetectionEnabled ?? monEnabled ?? false);
        setIsMonitoringActive(monEnabled);
        isMonitoringActiveRef.current = monEnabled;
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
  const lastAudioErrorLogRef = useRef<number>(0);
  const AUDIO_ERROR_LOG_INTERVAL_MS = 30000;
  const cryDetectionLoopRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const isMonitoringActiveRef = useRef(false);
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
      locationTrackingStopRef.current?.();
      locationTrackingStopRef.current = null;
      if (locationTrackingStop) {
        locationTrackingStop();
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
        setCurrentRecording(null);
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

  // When session loads with GPS already on, start location tracking. Stop when session is not active.
  // Use ref for stop callback so we never put it in deps (avoids "Maximum update depth exceeded").
  useEffect(() => {
    if (!id || !user?.id || !session) return;
    const isActive = session.status === 'active';
    if (!isActive || !gpsTrackingEnabled) {
      locationTrackingStopRef.current?.();
      locationTrackingStopRef.current = null;
      setLocationTrackingStop(null);
      return;
    }
    // Stop any previous tracking (e.g. from another session) before starting
    locationTrackingStopRef.current?.();
    locationTrackingStopRef.current = null;
    const stopTracking = startLocationTracking(id, (location) => {
      addToLocationHistoryIfNeeded(location);
    });
    locationTrackingStopRef.current = stopTracking;
    setLocationTrackingStop(() => stopTracking);
    return () => {
      stopTracking();
      locationTrackingStopRef.current = null;
      setLocationTrackingStop(null);
    };
  }, [id, user?.id, session?.id, session?.status, gpsTrackingEnabled]);

  // Handle toggle GPS tracking
  const handleToggleGPS = async (enabled: boolean) => {
    if (!session || !id) return;

    setGpsTrackingEnabled(enabled);

    if (enabled) {
      lastHistoryUpdateRef.current = null; // reset so first fix is recorded
      const stopTracking = startLocationTracking(id, (location) => {
        addToLocationHistoryIfNeeded(location);
      });
      setLocationTrackingStop(() => stopTracking);
    } else {
      if (locationTrackingStop) {
        locationTrackingStop();
        locationTrackingStopRef.current = null;
        setLocationTrackingStop(null);
      }
    }

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

  // Handle start monitoring (GPS + microphone → AI cry detection; alerts go to parent & sitter)
  const handleStartMonitoring = async () => {
    if (!session || !id || !user) return;

    setActionLoading(true);
    const toggleRes = await setSessionMonitoringEnabled(id, true);
    if (!toggleRes.success || !toggleRes.data) {
      setActionLoading(false);
      Alert.alert('Error', toggleRes.error?.message || 'Failed to enable monitoring.');
      return;
    }

    setSession(toggleRes.data);
    setIsMonitoringActive(true);
    isMonitoringActiveRef.current = true;
    setGpsTrackingEnabled(true);
    setCryDetectionEnabled(true);
    handleToggleGPS(true);
    handleToggleCryDetection(true);

    // Start cry detection (sets isRecording true after previous loop exits so REC shows reliably after Stop → Start)
    try {
      await startCryDetection();
    } catch (err: any) {
      setIsRecording(false);
      setActionLoading(false);
      Alert.alert(
        'Cry detection could not start',
        err?.message || 'Microphone or recording failed. GPS tracking is still on.'
      );
      return;
    }
    setActionLoading(false);
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
    isMonitoringActiveRef.current = false;
    setGpsTrackingEnabled(false);
    setCryDetectionEnabled(false);

    // Stop GPS tracking
    if (locationTrackingStop) {
      locationTrackingStop();
      setLocationTrackingStop(null);
    }

    // Stop cry detection (chunked loop will exit when cancelled)
    cryDetectionLoopRef.current.cancelled = true;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (_) {}
      setCurrentRecording(null);
      setRecording(null);
    }
    setIsRecording(false);
    setLastAudioChunkSentAt(null);

    // Update session
    // (Backend state already updated via /monitoring)
  };

  // Start cry detection: chunked recording every 5s. Show REC when monitoring starts (including after Stop → Start).
  const startCryDetection = async () => {
    try {
      const { status } = await requestAudioPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required for cry detection');
        return;
      }

      await setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      await stopCurrentRecordingIfAny();
      // Let any previous loop see cancelled and exit before we start (so it doesn't clear isRecording later)
      cryDetectionLoopRef.current.cancelled = true;
      await new Promise((r) => setTimeout(r, 400));
      cryDetectionLoopRef.current = { cancelled: false };
      setIsRecording(true);

      const CHUNK_SEC = 5;
      const loop = async () => {
        while (!cryDetectionLoopRef.current.cancelled && session && user && id) {
          const sess = session;
          const { recording: chunkRecording } = await Recording.createAsync(
            RecordingOptionsPresets.HIGH_QUALITY
          );
          setCurrentRecording(chunkRecording);
          setRecording(chunkRecording);

          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, CHUNK_SEC * 1000);
            chunkRecording.setOnRecordingStatusUpdate((s) => {
              if (!s.isRecording) clearTimeout(t);
            });
          });
          if (cryDetectionLoopRef.current.cancelled) break;

          let uri: string | null = null;
          try {
            const st = await chunkRecording.getStatusAsync();
            uri = (st?.uri && typeof st.uri === 'string') ? st.uri : null;
          } catch (_) {}
          if (!uri) {
            const r = chunkRecording as any;
            uri = (r._uri && typeof r._uri === 'string') ? r._uri : (typeof r.getURI === 'function' ? r.getURI() : null) || null;
          }
          if (!uri) {
            uri = await new Promise<string | null>((resolve) => {
              let done = false;
              const tryResolve = (u: string | null) => {
                if (!done) {
                  done = true;
                  resolve(u || null);
                }
              };
              chunkRecording.setOnRecordingStatusUpdate(async (s) => {
                if (!s.isRecording && !done) {
                  const fromCallback = (s.uri && typeof s.uri === 'string') ? s.uri : null;
                  if (fromCallback) {
                    tryResolve(fromCallback);
                    return;
                  }
                  await new Promise((r) => setTimeout(r, 100));
                  if (done) return;
                  try {
                    const st = await chunkRecording.getStatusAsync();
                    const u = (st?.uri && typeof st.uri === 'string') ? st.uri : null;
                    tryResolve(u);
                  } catch (_) {
                    tryResolve(null);
                  }
                }
              });
              chunkRecording.stopAndUnloadAsync().then(() => {
                if (done) return;
                try {
                  const getUri = (chunkRecording as any).getURI;
                  if (typeof getUri === 'function') {
                    const u = getUri();
                    if (u && typeof u === 'string') {
                      tryResolve(u);
                      return;
                    }
                  }
                } catch (_) {}
                tryResolve(null);
              });
            });
          } else {
            await chunkRecording.stopAndUnloadAsync();
          }
          if (!uri) {
            const r = chunkRecording as any;
            if (r._uri && typeof r._uri === 'string') uri = r._uri;
            else if (typeof r.getURI === 'function') {
              const u = r.getURI();
              if (u && typeof u === 'string') uri = u;
            }
          }
          setCurrentRecording(null);
          setRecording(null);

          if (!uri) {
            uri = await findMostRecentRecordingUri(15000);
          }
          if (cryDetectionLoopRef.current.cancelled) break;
          if (uri && sess.childId && sess.parentId) {
            const mime = uri.toLowerCase().endsWith('.m4a') ? 'audio/mp4' : 'audio/wav';
            await new Promise((r) => setTimeout(r, 400));
            if (cryDetectionLoopRef.current.cancelled) break;
            try {
              const res = await recordAndDetectCry(
                id!,
                sess.childId,
                sess.parentId,
                user.id,
                { uri, mimeType: mime },
                { createAlert: isMonitoringActiveRef.current }
              );
              if (res.success) setLastAudioChunkSentAt(Date.now());
            } catch (err: any) {
              const now = Date.now();
              if (now - lastAudioErrorLogRef.current >= AUDIO_ERROR_LOG_INTERVAL_MS) {
                lastAudioErrorLogRef.current = now;
                console.error('Error processing audio:', err?.message ?? err);
              }
            }
          }
        }
        // Only clear REC when this loop exited because monitoring was stopped (not when a new loop took over)
        if (cryDetectionLoopRef.current.cancelled) setIsRecording(false);
      };
      loop();
    } catch (err: any) {
      Alert.alert('Error', `Failed to start recording: ${err.message}`);
    }
  };

  // Sitter can only request end (parent is notified). This screen is sitter-only so we always use request-end.
  const handleEndSession = async () => {
    if (!session || !id) return;

    Alert.alert(
      'Request to end session',
      'The parent will be notified. Only the parent can actually end the session and complete payment. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send request',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            const res = await requestSessionEnd(id);
            setActionLoading(false);
            if (res.success) {
              Alert.alert('Request sent', 'The parent has been notified. They will end the session from their app when ready.');
            } else {
              Alert.alert('Error', res.error?.message || 'Failed to send request.');
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

  const canStartSession =
    session.status === 'accepted' ||
    session.status === 'booked' ||
    session.status === 'payment_pending';
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
                recordingStartedByMonitoring={isMonitoringActive && isRecording}
                lastChunkSentAtFromMonitoring={lastAudioChunkSentAt}
              />
            )}

            {/* Session Timeline – before End Session (space above so it doesn’t overlap Cry alerts) */}
            <View style={styles.timelineWrap}>
              <SessionTimeline session={session} role="sitter" />
            </View>

            {/* Request to end session (sitter notifies parent; parent ends and pays) */}
            <Card style={styles.endSessionCard}>
              <TouchableOpacity
                style={[styles.endSessionButton, { borderColor: colors.error || '#dc2626', backgroundColor: (colors.error || '#dc2626') + '08' }]}
                onPress={handleEndSession}
                disabled={actionLoading}
              >
                <Ionicons name="hand-left-outline" size={20} color={colors.error || '#dc2626'} />
                <Text style={[styles.endSessionText, { color: colors.error || '#dc2626' }]}>
                  Request to end session
                </Text>
              </TouchableOpacity>
              <Text style={[styles.endSessionHint, { color: colors.textSecondary }]}>
                Parent will be notified and will end the session from their app.
              </Text>
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
      </ScrollView>

      {/* Two circles: left = Emergency, right = Assistant (same as home screen) */}
      {session.status === 'active' && session.childId && (
        <TouchableOpacity
          style={[styles.fabCircle, styles.fabCircleRight, { backgroundColor: colors.primary }]}
          onPress={() => router.push(`/(sitter)/chatbot?sessionId=${id}&childId=${session.childId}` as any)}
          activeOpacity={0.9}
        >
          <Ionicons name="chatbubbles" size={28} color={colors.white} />
        </TouchableOpacity>
      )}
      <EmergencyCallButton session={session} role="sitter" position="left" />
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
    paddingBottom: 100,
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
  timelineWrap: {
    marginTop: 24,
  },
  endSessionCard: {
    marginTop: 8,
    marginBottom: 16,
  },
  endSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
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
  endSessionHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
