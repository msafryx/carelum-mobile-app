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
import SessionTimeline from '@/src/components/session/SessionTimeline';
import { useAuth } from '@/src/hooks/useAuth';
import {
  getSessionById,
  subscribeToSession,
  startSession,
  completeSession,
  updateSessionStatus,
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
import { Ionicons } from '@expo/vector-icons';
import * as Audio from 'expo-av';
import { format } from 'date-fns';

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

  // Handle start session
  const handleStartSession = async () => {
    if (!session || !id) return;

    setActionLoading(true);
    const result = await startSession(id);
    if (result.success) {
      Alert.alert('Success', 'Session started');
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to start session');
    }
    setActionLoading(false);
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

    setIsMonitoringActive(true);

    // Start GPS if enabled
    if (gpsTrackingEnabled) {
      handleToggleGPS(true);
    }

    // Start cry detection if enabled
    if (cryDetectionEnabled) {
      startCryDetection();
    }

    // Update session
    await updateSessionStatus(id, session.status, {
      monitoringEnabled: true,
    } as any);
  };

  // Handle stop monitoring
  const handleStopMonitoring = async () => {
    if (!session || !id) return;

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
    await updateSessionStatus(id, session.status, {
      monitoringEnabled: false,
    } as any);
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

            // Stop all monitoring
            await handleStopMonitoring();

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
          title="Active Session"
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
          title="Active Session"
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

  const canStartSession = session.status === 'accepted';
  const isActive = session.status === 'active';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Active Session" onBack={handleBackToRequests} />
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
                {session.status.toUpperCase()}
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
                Started: {format(session.startTime, 'MMM dd, yyyy • h:mm a')}
              </Text>
            </View>
            {isActive && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: colors.success + '10' }]}>
                  <Ionicons name="hourglass" size={14} color={colors.success || '#10b981'} />
                </View>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  Duration: {formatDuration(session.startTime)}
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
                  <Ionicons name="chatbubbles" size={24} color={colors.white} />
                  <Text style={[styles.chatbotButtonText, { color: colors.white }]}>
                    Ask AI Assistant
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

        {/* Session Timeline */}
        <SessionTimeline session={session} />
      </ScrollView>
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
