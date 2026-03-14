/**
 * Location & map: Open in Maps button, distance and estimated travel time.
 * No in-app map preview — user opens Maps to view; distance and time are calculated and shown here.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';

interface TwoPinMapProps {
  parentCoords: { latitude: number; longitude: number };
  sitterCoords: { latitude: number; longitude: number };
  distanceKm: number;
  travelMin: number;
}

export default function TwoPinMap({
  parentCoords,
  sitterCoords,
  distanceKm,
  travelMin,
}: TwoPinMapProps) {
  const { colors } = useTheme();

  const openInMapsUrl = useMemo(() => {
    const lat1 = parentCoords.latitude;
    const lon1 = parentCoords.longitude;
    const lat2 = sitterCoords.latitude;
    const lon2 = sitterCoords.longitude;
    return Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${lat1},${lon1}&saddr=${lat2},${lon2}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat1},${lon1}&origin=${lat2},${lon2}`;
  }, [parentCoords.latitude, parentCoords.longitude, sitterCoords.latitude, sitterCoords.longitude]);

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.border + '40', borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.openMapsButton, { backgroundColor: colors.primary }]}
          onPress={() => Linking.openURL(openInMapsUrl)}
        >
          <Ionicons name="map" size={20} color="#fff" />
          <Text style={styles.openMapsButtonText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="navigate" size={18} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.text }]}>
            Distance: {distanceKm.toFixed(1)} km
          </Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: (colors.success || '#10b981') + '18' }]}>
          <Ionicons name="time" size={18} color={colors.success || '#10b981'} />
          <Text style={[styles.statText, { color: colors.text }]}>
            Est. travel: ~{travelMin} min
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  openMapsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  statText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
