/**
 * Monitoring Controls Component
 * For sitter to control monitoring features during active session
 */
import React, { useState } from 'react';
import { View, StyleSheet, Text, Switch, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Card from '@/src/components/ui/Card';
import Button from '@/src/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

interface MonitoringControlsProps {
  gpsTrackingEnabled: boolean;
  cryDetectionEnabled: boolean;
  onToggleGPS: (enabled: boolean) => void;
  onToggleCryDetection: (enabled: boolean) => void;
  onStartMonitoring?: () => void;
  onStopMonitoring?: () => void;
  isMonitoringActive?: boolean;
  isLoading?: boolean;
}

export default function MonitoringControls({
  gpsTrackingEnabled,
  cryDetectionEnabled,
  onToggleGPS,
  onToggleCryDetection,
  onStartMonitoring,
  onStopMonitoring,
  isMonitoringActive = false,
  isLoading = false,
}: MonitoringControlsProps) {
  const { colors, spacing } = useTheme();

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="settings-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Monitoring Controls</Text>
      </View>

      <View style={styles.controlsContainer}>
        {/* GPS Tracking Toggle */}
        <View style={styles.controlRow}>
          <View style={styles.controlLeft}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <View style={styles.controlTextContainer}>
              <Text style={[styles.controlLabel, { color: colors.text }]}>
                GPS Tracking
              </Text>
              <Text style={[styles.controlDescription, { color: colors.textSecondary }]}>
                Share your location with parent
              </Text>
            </View>
          </View>
          <Switch
            value={gpsTrackingEnabled}
            onValueChange={onToggleGPS}
            disabled={isLoading}
            trackColor={{ false: colors.border, true: colors.primary + '80' }}
            thumbColor={gpsTrackingEnabled ? colors.primary : colors.textSecondary}
          />
        </View>

        {/* Cry Detection Toggle */}
        <View style={styles.controlRow}>
          <View style={styles.controlLeft}>
            <Ionicons name="mic" size={20} color={colors.primary} />
            <View style={styles.controlTextContainer}>
              <Text style={[styles.controlLabel, { color: colors.text }]}>
                Cry Detection
              </Text>
              <Text style={[styles.controlDescription, { color: colors.textSecondary }]}>
                Monitor and detect crying sounds
              </Text>
            </View>
          </View>
          <Switch
            value={cryDetectionEnabled}
            onValueChange={onToggleCryDetection}
            disabled={isLoading}
            trackColor={{ false: colors.border, true: colors.primary + '80' }}
            thumbColor={cryDetectionEnabled ? colors.primary : colors.textSecondary}
          />
        </View>
      </View>

      {/* Start/Stop Monitoring Button */}
      {!isMonitoringActive ? (
        <Button
          title="Start Monitoring"
          onPress={onStartMonitoring}
          disabled={isLoading}
          loading={isLoading}
          style={styles.actionButton}
        />
      ) : (
        <Button
          title="Stop Monitoring"
          onPress={onStopMonitoring}
          variant="outline"
          disabled={isLoading}
          loading={isLoading}
          style={styles.actionButton}
        />
      )}

      {isMonitoringActive && (
        <View style={[styles.activeIndicator, { backgroundColor: colors.success + '20' }]}>
          <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.activeText, { color: colors.success }]}>
            Monitoring Active
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  controlsContainer: {
    gap: 16,
    marginBottom: 16,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  controlTextContainer: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  controlDescription: {
    fontSize: 12,
  },
  actionButton: {
    width: '100%',
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
