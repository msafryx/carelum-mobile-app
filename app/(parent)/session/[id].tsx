/**
 * Parent Session Detail Screen
 * Shows active session details, GPS tracking, cry detection alerts, and session controls
 */
import EnhancedAlertsView from '@/src/components/alerts/EnhancedAlertsView';
import EnhancedGPSMap from '@/src/components/gps/EnhancedGPSMap';
import CryDetectionIndicator from '@/src/components/session/CryDetectionIndicator';
import SessionControls from '@/src/components/session/SessionControls';
import SessionTimeline from '@/src/components/session/SessionTimeline';
import Card from '@/src/components/ui/Card';
import ErrorDisplay from '@/src/components/ui/ErrorDisplay';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import Header from '@/src/components/ui/Header';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import {
  Alert as AlertType,
  getSessionAlerts,
  markAlertAsViewed,
  subscribeToSessionAlerts,
} from '@/src/services/alert.service';
import { getChildById } from '@/src/services/child.service';
import { getUserById } from '@/src/services/admin.service';
import {
  getSessionGPSTracking,
  subscribeToGPSUpdates,
} from '@/src/services/monitoring.service';
import {
  completeSession,
  getSessionById,
  subscribeToSession,
  cancelSession,
} from '@/src/services/session.service';
import CancelSessionModal from '@/src/components/session/CancelSessionModal';
import { Child } from '@/src/types/child.types';
import { LocationUpdate, Session } from '@/src/types/session.types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function SessionDetailScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [child, setChild] = useState<Child | null>(null);
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

      // Load child data
      if (sessionData.childId) {
        const childResult = await getChildById(sessionData.childId);
        if (childResult.success && childResult.data) {
          setChild(childResult.data);
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
              {child && (
                <Text style={[styles.childName, { color: colors.text }]}>
                  {child.name}
                </Text>
              )}
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
            {session.status === 'requested' && session.endTime && (
              <View style={styles.infoRow}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Expected Duration: {Math.round((session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60))} hours
                </Text>
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
});
