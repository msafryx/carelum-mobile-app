/**
 * Enhanced GPS Map Component
 * Full map integration with real-time location updates, history, and geofencing
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/src/components/ui/Card';
import { LocationUpdate } from '@/src/types/session.types';
import { format, formatDistanceToNow } from 'date-fns';

// Platform-specific imports - Metro will automatically use .native.ts or .web.ts
import { MapView, Marker, Polyline, Circle } from './maps';

const { width, height } = Dimensions.get('window');

interface EnhancedGPSMapProps {
  sessionId: string;
  currentLocation?: LocationUpdate;
  locationHistory?: LocationUpdate[];
  isTracking?: boolean;
  geofenceCenter?: { latitude: number; longitude: number };
  geofenceRadius?: number; // in meters
  onLocationPress?: (location: LocationUpdate) => void;
  onGeofenceViolation?: () => void;
}

export default function EnhancedGPSMap({
  currentLocation,
  locationHistory = [],
  isTracking = false,
  geofenceCenter,
  geofenceRadius = 100, // Default 100m radius
  onLocationPress,
  onGeofenceViolation,
}: EnhancedGPSMapProps) {
  const { colors, spacing } = useTheme();
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [showHistory, setShowHistory] = useState(true);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  }, [currentLocation]);

  // Check geofence violations
  useEffect(() => {
    if (currentLocation && geofenceCenter && geofenceRadius && onGeofenceViolation) {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        geofenceCenter.latitude,
        geofenceCenter.longitude
      );

      if (distance > geofenceRadius) {
        onGeofenceViolation();
      }
    }
  }, [currentLocation, geofenceCenter, geofenceRadius]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const getHistoryCoordinates = () => {
    return locationHistory.map((loc) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));
  };

  const getTotalDistance = () => {
    if (locationHistory.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < locationHistory.length; i++) {
      total += calculateDistance(
        locationHistory[i - 1].latitude,
        locationHistory[i - 1].longitude,
        locationHistory[i].latitude,
        locationHistory[i].longitude
      );
    }
    return total;
  };

  if (!mapReady) {
    return (
      <Card style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading map...
          </Text>
        </View>
      </Card>
    );
  }

  const initialRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

  return (
    <View style={styles.container}>
      <Card style={styles.mapCard}>
        {/* Map Controls - Only show on native */}
        {Platform.OS !== 'web' && MapView && (
          <View style={styles.mapControls}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.white }]}
              onPress={() => setMapType(mapType === 'standard' ? 'satellite' : mapType === 'satellite' ? 'hybrid' : 'standard')}
            >
              <Ionicons
                name={mapType === 'standard' ? 'map' : mapType === 'satellite' ? 'globe' : 'layers'}
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.white }]}
              onPress={() => setShowHistory(!showHistory)}
            >
              <Ionicons
                name={showHistory ? 'eye' : 'eye-off'}
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
          {currentLocation && Platform.OS !== 'web' && MapView && (
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
                  mapRef.current.animateToRegion(
                    {
                      latitude: currentLocation.latitude,
                      longitude: currentLocation.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    },
                    500
                  );
                }
              }}
            >
              <Ionicons name="locate" size={20} color={colors.white} />
            </TouchableOpacity>
          )}
          </View>
        )}

        {/* Map View - Only render on native platforms */}
        {Platform.OS !== 'web' && MapView ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            mapType={mapType}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={true}
            showsScale={true}
          >
            {/* Geofence Circle */}
            {geofenceCenter && geofenceRadius && Circle && (
              <Circle
                center={{
                  latitude: geofenceCenter.latitude,
                  longitude: geofenceCenter.longitude,
                }}
                radius={geofenceRadius}
                strokeColor={colors.primary + '80'}
                fillColor={colors.primary + '20'}
                strokeWidth={2}
              />
            )}

            {/* Location History Path */}
            {showHistory && locationHistory.length > 1 && Polyline && (
              <Polyline
                coordinates={getHistoryCoordinates()}
                strokeColor={colors.primary}
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
            )}

            {/* History Markers */}
            {showHistory &&
              Marker &&
              locationHistory.map((loc, index) => (
                <Marker
                  key={`history-${index}`}
                  coordinate={{
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                  }}
                  title={`Location ${index + 1}`}
                  description={format(loc.timestamp, 'h:mm a')}
                  pinColor={colors.textSecondary}
                />
              ))}

            {/* Current Location Marker */}
            {currentLocation && Marker && (
              <Marker
                coordinate={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                }}
                title="Current Location"
                description={format(currentLocation.timestamp, 'h:mm a')}
                pinColor={isTracking ? colors.success : colors.primary}
                onPress={() => onLocationPress?.(currentLocation)}
              >
                <View style={[styles.currentMarker, { backgroundColor: colors.primary }]}>
                  <View style={[styles.markerDot, { backgroundColor: colors.white }]} />
                </View>
              </Marker>
            )}

            {/* Geofence Center Marker */}
            {geofenceCenter && Marker && (
              <Marker
                coordinate={{
                  latitude: geofenceCenter.latitude,
                  longitude: geofenceCenter.longitude,
                }}
                title="Geofence Center"
                pinColor={colors.warning}
              />
            )}
          </MapView>
        ) : (
          /* Web Fallback - Show location data without map */
          <>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="location" size={20} color={colors.primary} />
                <Text style={[styles.title, { color: colors.text }]}>Location Tracking</Text>
              </View>
              <View style={[styles.statusIndicator, { backgroundColor: isTracking ? colors.success : colors.border }]}>
                <Text style={[styles.statusText, { color: colors.white }]}>
                  {isTracking ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <View style={[styles.mapContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <View style={styles.mapPlaceholder}>
                <Ionicons name="map" size={48} color={colors.textSecondary} />
                <Text style={[styles.mapText, { color: colors.textSecondary }]}>
                  Map View (Native Only)
                </Text>
                {currentLocation && (
                  <>
                    <Text style={[styles.coordinatesText, { color: colors.textSecondary }]}>
                      {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                    </Text>
                    {locationHistory.length > 0 && (
                      <Text style={[styles.historyText, { color: colors.textSecondary }]}>
                        {locationHistory.length} location points tracked
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          </>
        )}

        {/* Status Overlay */}
        <View style={[styles.statusOverlay, { backgroundColor: colors.white }]}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isTracking ? colors.success : colors.border },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isTracking ? colors.white : colors.textSecondary },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isTracking ? colors.white : colors.text },
                ]}
              >
                {isTracking ? 'Tracking Active' : 'Tracking Inactive'}
              </Text>
            </View>
            {currentLocation?.accuracy && (
              <Text style={[styles.accuracyText, { color: colors.textSecondary }]}>
                ±{currentLocation.accuracy.toFixed(0)}m
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* Location Info */}
      {currentLocation && (
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Current Location
            </Text>
          </View>
          <View style={styles.infoContent}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Coordinates:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Last Update:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {formatDistanceToNow(currentLocation.timestamp, { addSuffix: true })}
              </Text>
            </View>
            {currentLocation.accuracy && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Accuracy:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {currentLocation.accuracy.toFixed(0)} meters
                </Text>
              </View>
            )}
            {locationHistory.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Total Distance:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {(getTotalDistance() / 1000).toFixed(2)} km
                </Text>
              </View>
            )}
            {locationHistory.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Location Points:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {locationHistory.length}
                </Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Location History List */}
      {locationHistory.length > 0 && (
        <Card style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: colors.text }]}>
              Location History ({locationHistory.length})
            </Text>
            <TouchableOpacity onPress={() => setShowHistory(!showHistory)}>
              <Ionicons
                name={showHistory ? 'eye' : 'eye-off'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.historyList} nestedScrollEnabled>
            {locationHistory.slice(0, 10).map((loc, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.historyItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  onLocationPress?.(loc);
                  mapRef.current?.animateToRegion(
                    {
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    },
                    500
                  );
                }}
              >
                <Ionicons name="location" size={16} color={colors.primary} />
                <View style={styles.historyItemContent}>
                  <Text style={[styles.historyItemCoordinates, { color: colors.text }]}>
                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </Text>
                  <Text style={[styles.historyItemTime, { color: colors.textSecondary }]}>
                    {format(loc.timestamp, 'MMM dd, h:mm a')}
                  </Text>
                </View>
                {loc.accuracy && (
                  <Text style={[styles.historyItemAccuracy, { color: colors.textSecondary }]}>
                    ±{loc.accuracy.toFixed(0)}m
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  mapCard: {
    marginBottom: 0,
    overflow: 'hidden',
  },
  mapControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1000,
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 3.84px rgba(0, 0, 0, 0.25)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }),
  },
  map: {
    width: '100%',
    height: 300,
  },
  statusOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accuracyText: {
    fontSize: 12,
  },
  infoCard: {
    marginBottom: 0,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoContent: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  historyCard: {
    marginBottom: 0,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  historyList: {
    maxHeight: 200,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemCoordinates: {
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  historyItemTime: {
    fontSize: 12,
  },
  historyItemAccuracy: {
    fontSize: 11,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  currentMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
