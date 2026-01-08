/**
 * Session Controls Component
 * Provides session action buttons (end session, emergency, etc.)
 */
import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Card from '@/src/components/ui/Card';
import Button from '@/src/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { SessionStatus } from '@/src/types/session.types';

interface SessionControlsProps {
  sessionStatus: SessionStatus;
  onEndSession?: () => void;
  onEmergency?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  canEndSession?: boolean;
}

export default function SessionControls({
  sessionStatus,
  onEndSession,
  onEmergency,
  onCancel,
  isLoading = false,
  canEndSession = true,
}: SessionControlsProps) {
  const { colors, spacing } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleEndSession = () => {
    if (showConfirm) {
      onEndSession?.();
      setShowConfirm(false);
    } else {
      Alert.alert(
        'End Session',
        'Are you sure you want to end this session? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Session',
            style: 'destructive',
            onPress: () => {
              setShowConfirm(true);
              onEndSession?.();
            },
          },
        ]
      );
    }
  };

  const handleEmergency = () => {
    Alert.alert(
      'Emergency Alert',
      'This will send an emergency alert to all parties. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: onEmergency,
        },
      ]
    );
  };

  const isActive = sessionStatus === 'active';
  const isCompleted = sessionStatus === 'completed';
  const isCancelled = sessionStatus === 'cancelled';

  if (isCompleted || isCancelled) {
    return (
      <Card style={styles.container}>
        <View style={styles.completedContainer}>
          <Ionicons
            name={isCompleted ? 'checkmark-circle' : 'close-circle'}
            size={48}
            color={isCompleted ? colors.success : colors.textSecondary}
          />
          <Text style={[styles.completedText, { color: colors.text }]}>
            Session {isCompleted ? 'Completed' : 'Cancelled'}
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Session Controls</Text>

      <View style={styles.controlsContainer}>
        {isActive && (
          <>
            {canEndSession && (
              <Button
                title="End Session"
                onPress={handleEndSession}
                variant="outline"
                disabled={isLoading}
                loading={isLoading}
                style={styles.button}
              />
            )}

            {onEmergency && (
              <TouchableOpacity
                style={[styles.emergencyButton, { backgroundColor: colors.emergency }]}
                onPress={handleEmergency}
                disabled={isLoading}
              >
                <Ionicons name="warning" size={20} color={colors.white} />
                <Text style={[styles.emergencyText, { color: colors.white }]}>
                  Emergency Alert
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {sessionStatus === 'requested' && onCancel && (
          <Button
            title="Cancel Request"
            onPress={onCancel}
            variant="outline"
            disabled={isLoading}
            style={styles.button}
          />
        )}

        {sessionStatus === 'accepted' && (
          <View style={styles.waitingContainer}>
            <Ionicons name="hourglass-outline" size={24} color={colors.warning} />
            <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
              Waiting for session to start
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  controlsContainer: {
    gap: 12,
  },
  button: {
    width: '100%',
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  emergencyText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  completedText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  waitingText: {
    fontSize: 14,
  },
});
