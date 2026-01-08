/**
 * Cry Detection Indicator Component
 * Shows cry detection status and alerts
 */
import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Card from '@/src/components/ui/Card';
import Badge from '@/src/components/ui/Badge';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/src/services/alert.service';

interface CryDetectionIndicatorProps {
  isEnabled: boolean;
  isActive: boolean;
  lastDetection?: Date;
  alertCount?: number;
  recentAlerts?: Alert[];
  onViewAlerts?: () => void;
  onToggle?: (enabled: boolean) => void;
}

export default function CryDetectionIndicator({
  isEnabled,
  isActive,
  lastDetection,
  alertCount = 0,
  recentAlerts = [],
  onViewAlerts,
  onToggle,
}: CryDetectionIndicatorProps) {
  const { colors, spacing } = useTheme();

  const getStatusColor = () => {
    if (!isEnabled) return colors.textSecondary;
    if (alertCount > 0) return colors.emergency;
    if (isActive) return colors.success;
    return colors.warning;
  };

  const getStatusText = () => {
    if (!isEnabled) return 'Disabled';
    if (alertCount > 0) return 'Crying Detected';
    if (isActive) return 'Monitoring';
    return 'Standby';
  };

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons 
            name={isEnabled && isActive ? "mic" : "mic-off"} 
            size={20} 
            color={getStatusColor()} 
          />
          <Text style={[styles.title, { color: colors.text }]}>Cry Detection</Text>
        </View>
        <Badge 
          label={getStatusText()} 
          variant={alertCount > 0 ? 'error' : isActive ? 'success' : 'default'} 
        />
      </View>

      {isEnabled ? (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {alertCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Alerts
              </Text>
            </View>
            {lastDetection && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {lastDetection.toLocaleTimeString()}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Last Detection
                </Text>
              </View>
            )}
          </View>

          {alertCount > 0 && (
            <TouchableOpacity
              style={[styles.alertButton, { backgroundColor: colors.emergency + '20' }]}
              onPress={onViewAlerts}
            >
              <Ionicons name="alert-circle" size={18} color={colors.emergency} />
              <Text style={[styles.alertButtonText, { color: colors.emergency }]}>
                View {alertCount} Alert{alertCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}

          {onToggle && (
            <TouchableOpacity
              style={[styles.toggleButton, { borderColor: colors.border }]}
              onPress={() => onToggle(!isActive)}
            >
              <Text style={[styles.toggleText, { color: colors.primary }]}>
                {isActive ? 'Pause Monitoring' : 'Resume Monitoring'}
              </Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={styles.disabledContainer}>
          <Text style={[styles.disabledText, { color: colors.textSecondary }]}>
            Cry detection is disabled for this session
          </Text>
          {onToggle && (
            <TouchableOpacity
              style={[styles.enableButton, { backgroundColor: colors.primary }]}
              onPress={() => onToggle(true)}
            >
              <Text style={[styles.enableButtonText, { color: colors.white }]}>
                Enable Cry Detection
              </Text>
            </TouchableOpacity>
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
  statsContainer: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  alertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  alertButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disabledContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  disabledText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  enableButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
