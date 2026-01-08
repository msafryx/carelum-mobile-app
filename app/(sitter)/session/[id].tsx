/**
 * Sitter Session Detail Screen
 * Shows active session controls, monitoring interface, GPS tracking, and cry detection
 */
import React, { useState, useEffect, useCallback } from 'react';
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
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import ErrorDisplay from '@/src/components/ui/ErrorDisplay';
import GPSMapView from '@/src/components/session/GPSMapView';
import CryDetectionIndicator from '@/src/components/session/CryDetectionIndicator';
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
} from '@/src/services/location.service';
import { Session } from '@/src/types/session.types';
import { LocationUpdate } from '@/src/types/session.types';
import { Alert as AlertType } from '@/src/services/alert.service';
import { Ionicons } from '@expo/vector-icons';
import * as Audio from 'expo-av';

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

export default function SitterSessionDetailScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationUpdate[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Monitoring state
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(false);
  const [cryDetectionEnabled, setCryDetectionEnabled] = useState(false);
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [locationTrackingStop, setLocationTrackingStop] = useState<(() => void) | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

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
        <Header showLogo={true} title="Active Session" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showLogo={true} title="Active Session" />
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
      <Header showLogo={true} title="Active Session" />
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
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status, colors) }]}>
              <Text style={[styles.statusText, { color: colors.white }]}>
                {session.status.toUpperCase()}
              </Text>
            </View>
            {session.location && (
              <View style={styles.locationInfo}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                  {session.location.address || 'Location set'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.sessionInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Started: {session.startTime.toLocaleString()}
              </Text>
            </View>
            {isActive && (
              <View style={styles.infoRow}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Duration: {formatDuration(session.startTime)}
                </Text>
              </View>
            )}
            {session.hourlyRate && (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Rate: ${session.hourlyRate}/hour
                </Text>
              </View>
            )}
          </View>
        </Card>

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

            {/* GPS Tracking */}
            {gpsTrackingEnabled && (
              <GPSMapView
                sessionId={id!}
                currentLocation={currentLocation || undefined}
                locationHistory={locationHistory}
                isTracking={isMonitoringActive && gpsTrackingEnabled}
              />
            )}

            {/* Cry Detection */}
            {cryDetectionEnabled && (
              <CryDetectionIndicator
                isEnabled={cryDetectionEnabled}
                isActive={isMonitoringActive && isRecording}
                lastDetection={lastCryDetection}
                alertCount={cryAlerts.length}
                recentAlerts={cryAlerts.slice(0, 5)}
                onToggle={(enabled) => {
                  if (enabled) {
                    startCryDetection();
                  } else {
                    if (recording) {
                      recording.stopAndUnloadAsync();
                      setRecording(null);
                      setIsRecording(false);
                    }
                  }
                }}
              />
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
    gap: 8,
  },
  infoText: {
    fontSize: 14,
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
  endSessionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
