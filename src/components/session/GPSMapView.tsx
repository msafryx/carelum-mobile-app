/**
 * GPS Map View Component
 * Displays session location tracking on a map
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Card from '@/src/components/ui/Card';
import { LocationUpdate } from '@/src/types/session.types';
import { Ionicons } from '@expo/vector-icons';

interface GPSMapViewProps {
  sessionId: string;
  currentLocation?: LocationUpdate;
  locationHistory?: LocationUpdate[];
  isTracking?: boolean;
  onLocationPress?: (location: LocationUpdate) => void;
}

export default function GPSMapView({
  currentLocation,
  locationHistory = [],
  isTracking = false,
  onLocationPress,
}: GPSMapViewProps) {
  const { colors, spacing } = useTheme();
  const [mapReady, setMapReady] = useState(false);

  // For now, we'll use a placeholder map view
  // In production, integrate with react-native-maps or expo-maps
  useEffect(() => {
    // Simulate map loading
    setTimeout(() => setMapReady(true), 500);
  }, []);

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

  return (
    <Card style={styles.container}>
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
        {currentLocation ? (
          <View style={styles.mapContent}>
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map" size={48} color={colors.textSecondary} />
              <Text style={[styles.mapText, { color: colors.textSecondary }]}>
                Map View
              </Text>
              <Text style={[styles.coordinatesText, { color: colors.textSecondary }]}>
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </Text>
              {locationHistory.length > 0 && (
                <Text style={[styles.historyText, { color: colors.textSecondary }]}>
                  {locationHistory.length} location points tracked
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.noLocationContainer}>
            <Ionicons name="location-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.noLocationText, { color: colors.textSecondary }]}>
              No location data available
            </Text>
          </View>
        )}
      </View>

      {currentLocation && (
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Last update: {currentLocation.timestamp.toLocaleTimeString()}
            </Text>
          </View>
          {currentLocation.accuracy && (
            <View style={styles.infoRow}>
              <Ionicons name="locate-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Accuracy: {currentLocation.accuracy.toFixed(0)}m
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  mapContent: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  coordinatesText: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  historyText: {
    fontSize: 11,
    marginTop: 8,
  },
  noLocationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noLocationText: {
    fontSize: 14,
    marginTop: 8,
  },
  infoContainer: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
  },
});
