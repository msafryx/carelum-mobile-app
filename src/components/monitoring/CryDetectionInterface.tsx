/**
 * Cry Detection Interface Component
 * Audio recording interface with real-time detection display, alerts, and history
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Card from '@/src/components/ui/Card';
import { recordAndDetectCry, AudioLog } from '@/src/services/monitoring.service';
import { Alert as AlertType, getSessionAlerts } from '@/src/services/alert.service';
import { format, formatDistanceToNow } from 'date-fns';

interface CryDetectionInterfaceProps {
  sessionId: string;
  childId: string;
  parentId: string;
  sitterId: string;
  isEnabled: boolean;
  onToggle?: (enabled: boolean) => void;
}

export default function CryDetectionInterface({
  sessionId,
  childId,
  parentId,
  sitterId,
  isEnabled,
  onToggle,
}: CryDetectionInterfaceProps) {
  const { colors, spacing } = useTheme();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionHistory, setDetectionHistory] = useState<AudioLog[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertType[]>([]);
  const [currentDetection, setCurrentDetection] = useState<{
    label: 'crying' | 'normal';
    confidence: number;
    timestamp: Date;
  } | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkPermissions();
    loadDetectionHistory();
    loadRecentAlerts();
  }, [sessionId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const checkPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (err) {
      setHasPermission(false);
    }
  };

  const loadDetectionHistory = async () => {
    // Load from service or local storage
    // For now, we'll use alerts as history
  };

  const loadRecentAlerts = async () => {
    try {
      const result = await getSessionAlerts(sessionId);
      if (result.success && result.data) {
        const cryAlerts = result.data.filter(
          (alert) => alert.type === 'cry_detection'
        );
        setRecentAlerts(cryAlerts.slice(0, 10));
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission to use cry detection.',
        [{ text: 'OK', onPress: checkPermissions }]
      );
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Process audio chunks every 3 seconds
      const processInterval = setInterval(async () => {
        if (!newRecording || !isRecording) {
          clearInterval(processInterval);
          return;
        }

        try {
          const status = await newRecording.getStatusAsync();
          if (status.isRecording && status.durationMillis) {
            // Get recorded audio and process
            const uri = status.uri;
            const response = await fetch(uri);
            const blob = await response.blob();

            setIsProcessing(true);
            const result = await recordAndDetectCry(
              sessionId,
              childId,
              parentId,
              sitterId,
              blob
            );

            if (result.success && result.data) {
              const audioLog = result.data;
              setDetectionHistory((prev) => [audioLog, ...prev].slice(0, 20));

              if (audioLog.prediction) {
                setCurrentDetection({
                  label: audioLog.prediction.label,
                  confidence: audioLog.prediction.confidence,
                  timestamp: audioLog.prediction.processedAt,
                });

                if (audioLog.prediction.label === 'crying' && audioLog.alertSent) {
                  // Reload alerts
                  loadRecentAlerts();
                  
                  // Show notification
                  Alert.alert(
                    'Crying Detected',
                    `Crying detected with ${(audioLog.prediction.confidence * 100).toFixed(0)}% confidence.`,
                    [{ text: 'OK' }]
                  );
                }
              }
            }
            setIsProcessing(false);
          }
        } catch (err: any) {
          console.error('Error processing audio:', err);
          setIsProcessing(false);
        }
      }, 3000);

      // Cleanup on stop
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) {
          clearInterval(processInterval);
        }
      });
    } catch (err: any) {
      Alert.alert('Error', `Failed to start recording: ${err.message}`);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setCurrentDetection(null);
    } catch (err: any) {
      Alert.alert('Error', `Failed to stop recording: ${err.message}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isEnabled) {
    return (
      <Card style={styles.container}>
        <View style={styles.disabledContainer}>
          <Ionicons name="mic-off" size={48} color={colors.textSecondary} />
          <Text style={[styles.disabledText, { color: colors.textSecondary }]}>
            Cry detection is disabled
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
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* Recording Controls */}
      <Card style={styles.controlsCard}>
        <View style={styles.controlsHeader}>
          <View style={styles.controlsHeaderLeft}>
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={24}
              color={isRecording ? colors.error : colors.text}
            />
            <Text style={[styles.controlsTitle, { color: colors.text }]}>
              Audio Recording
            </Text>
          </View>
          {isRecording && (
            <View style={[styles.recordingIndicator, { backgroundColor: colors.error }]}>
              <View style={[styles.recordingDot, { backgroundColor: colors.white }]} />
              <Text style={[styles.recordingText, { color: colors.white }]}>
                REC
              </Text>
            </View>
          )}
        </View>

        {isRecording && (
          <View style={styles.recordingInfo}>
            <Text style={[styles.durationText, { color: colors.text }]}>
              {formatDuration(recordingDuration)}
            </Text>
            {isProcessing && (
              <View style={styles.processingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.processingText, { color: colors.textSecondary }]}>
                  Processing...
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.controlsButtons}>
          {!isRecording ? (
            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: colors.error }]}
              onPress={startRecording}
              disabled={!hasPermission}
            >
              <Ionicons name="mic" size={24} color={colors.white} />
              <Text style={[styles.recordButtonText, { color: colors.white }]}>
                Start Recording
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.stopButton, { backgroundColor: colors.textSecondary }]}
              onPress={stopRecording}
            >
              <Ionicons name="stop" size={24} color={colors.white} />
              <Text style={[styles.stopButtonText, { color: colors.white }]}>
                Stop Recording
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!hasPermission && (
          <View style={styles.permissionWarning}>
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={[styles.permissionText, { color: colors.warning }]}>
              Microphone permission required
            </Text>
          </View>
        )}
      </Card>

      {/* Current Detection */}
      {currentDetection && (
        <Card style={styles.detectionCard}>
          <Text style={[styles.detectionTitle, { color: colors.text }]}>
            Latest Detection
          </Text>
          <View style={styles.detectionContent}>
            <View
              style={[
                styles.detectionBadge,
                {
                  backgroundColor:
                    currentDetection.label === 'crying'
                      ? colors.error + '20'
                      : colors.success + '20',
                },
              ]}
            >
              <Ionicons
                name={currentDetection.label === 'crying' ? 'alert-circle' : 'checkmark-circle'}
                size={24}
                color={currentDetection.label === 'crying' ? colors.error : colors.success}
              />
              <View style={styles.detectionInfo}>
                <Text
                  style={[
                    styles.detectionLabel,
                    {
                      color:
                        currentDetection.label === 'crying' ? colors.error : colors.success,
                    },
                  ]}
                >
                  {currentDetection.label === 'crying' ? 'Crying Detected' : 'Normal'}
                </Text>
                <Text style={[styles.detectionConfidence, { color: colors.textSecondary }]}>
                  {(currentDetection.confidence * 100).toFixed(0)}% confidence
                </Text>
                <Text style={[styles.detectionTime, { color: colors.textSecondary }]}>
                  {formatDistanceToNow(currentDetection.timestamp, { addSuffix: true })}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      )}

      {/* Detection History */}
      {detectionHistory.length > 0 && (
        <Card style={styles.historyCard}>
          <Text style={[styles.historyTitle, { color: colors.text }]}>
            Detection History
          </Text>
          <ScrollView style={styles.historyList} nestedScrollEnabled>
            {detectionHistory.slice(0, 10).map((log, index) => (
              <View
                key={index}
                style={[
                  styles.historyItem,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Ionicons
                  name={log.prediction?.label === 'crying' ? 'alert-circle' : 'checkmark-circle'}
                  size={20}
                  color={log.prediction?.label === 'crying' ? colors.error : colors.success}
                />
                <View style={styles.historyItemContent}>
                  <Text style={[styles.historyItemLabel, { color: colors.text }]}>
                    {log.prediction?.label === 'crying' ? 'Crying' : 'Normal'}
                  </Text>
                  <Text style={[styles.historyItemTime, { color: colors.textSecondary }]}>
                    {format(log.recordedAt, 'h:mm a')} •{' '}
                    {(log.prediction?.confidence || 0) * 100}% confidence
                  </Text>
                </View>
                {log.alertSent && (
                  <Ionicons name="notifications" size={16} color={colors.primary} />
                )}
              </View>
            ))}
          </ScrollView>
        </Card>
      )}

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <Card style={styles.alertsCard}>
          <Text style={[styles.alertsTitle, { color: colors.text }]}>
            Recent Alerts ({recentAlerts.length})
          </Text>
          <ScrollView style={styles.alertsList} nestedScrollEnabled>
            {recentAlerts.map((alert) => (
              <View
                key={alert.id}
                style={[styles.alertItem, { borderBottomColor: colors.border }]}
              >
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <View style={styles.alertItemContent}>
                  <Text style={[styles.alertItemTitle, { color: colors.text }]}>
                    {alert.title}
                  </Text>
                  <Text style={[styles.alertItemMessage, { color: colors.textSecondary }]}>
                    {alert.message}
                  </Text>
                  <Text style={[styles.alertItemTime, { color: colors.textSecondary }]}>
                    {formatDistanceToNow(alert.createdAt, { addSuffix: true })}
                  </Text>
                </View>
                {alert.status === 'new' && (
                  <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.newBadgeText, { color: colors.white }]}>New</Text>
                  </View>
                )}
              </View>
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
  controlsCard: {
    marginBottom: 0,
  },
  controlsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  controlsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recordingInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  durationText: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  processingText: {
    fontSize: 12,
  },
  controlsButtons: {
    marginTop: 8,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  recordButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
  },
  permissionText: {
    fontSize: 12,
    flex: 1,
  },
  disabledContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  disabledText: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  enableButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detectionCard: {
    marginBottom: 0,
  },
  detectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detectionContent: {
    marginTop: 8,
  },
  detectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  detectionInfo: {
    flex: 1,
  },
  detectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  detectionConfidence: {
    fontSize: 14,
    marginBottom: 4,
  },
  detectionTime: {
    fontSize: 12,
  },
  historyCard: {
    marginBottom: 0,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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
  historyItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  historyItemTime: {
    fontSize: 12,
  },
  alertsCard: {
    marginBottom: 0,
  },
  alertsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  alertsList: {
    maxHeight: 200,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  alertItemContent: {
    flex: 1,
  },
  alertItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertItemMessage: {
    fontSize: 12,
    marginBottom: 4,
  },
  alertItemTime: {
    fontSize: 11,
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
