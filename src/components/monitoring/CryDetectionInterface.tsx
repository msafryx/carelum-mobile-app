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
import { setAudioModeAsync } from 'expo-av/build/Audio';
import {
  Recording,
  RecordingOptionsPresets,
  requestPermissionsAsync as requestAudioPermissionsAsync,
} from 'expo-av/build/Audio/Recording';
import Card from '@/src/components/ui/Card';
import { recordAndDetectCry, AudioLog } from '@/src/services/monitoring.service';
import { Alert as AlertType, getSessionAlerts } from '@/src/services/alert.service';
import { readFileUriToBlob } from '@/src/utils/audioFileUtils';
import { stopCurrentRecordingIfAny, setCurrentRecording } from '@/src/utils/audioRecordingSingleton';
import { format, formatDistanceToNow } from 'date-fns';

interface CryDetectionInterfaceProps {
  sessionId: string;
  childId: string;
  parentId: string;
  sitterId: string;
  isEnabled: boolean;
  onToggle?: (enabled: boolean) => void;
  /** When true, recording was started by "Start Monitoring" – show active state and hide Start button */
  recordingStartedByMonitoring?: boolean;
  /** Timestamp (ms) when session last sent audio to AI (for monitoring flow) – so user sees "audio transferred" */
  lastChunkSentAtFromMonitoring?: number | null;
}

export default function CryDetectionInterface({
  sessionId,
  childId,
  parentId,
  sitterId,
  isEnabled,
  onToggle,
  recordingStartedByMonitoring = false,
  lastChunkSentAtFromMonitoring = null,
}: CryDetectionInterfaceProps) {
  const { colors, spacing } = useTheme();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const effectivelyRecording = isRecording || recordingStartedByMonitoring;
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastChunkSentAt, setLastChunkSentAt] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null); // set each tick so we never hang on "first clip"
  const [chunksSentCount, setChunksSentCount] = useState(0);
  const [, setTransferTick] = useState(0); // force re-render every 1s to update "X s ago"
  const [detectionHistory, setDetectionHistory] = useState<AudioLog[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertType[]>([]);
  const [currentDetection, setCurrentDetection] = useState<{
    label: 'crying' | 'normal';
    confidence: number;
    timestamp: Date;
  } | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [lastSendError, setLastSendError] = useState<string | null>(null);

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

  // Update "Last sent X s ago" every second when recording
  useEffect(() => {
    if (!effectivelyRecording) return;
    const t = setInterval(() => setTransferTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [effectivelyRecording]);

  // On unmount, stop recording so expo-av singleton is cleared
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
        setCurrentRecording(null);
      }
    };
  }, [recording]);

  const checkPermissions = async () => {
    try {
      const { status } = await requestAudioPermissionsAsync();
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

  const recordingLoopRef = React.useRef<{ cancelled: boolean }>({ cancelled: false });

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
      await setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      await stopCurrentRecordingIfAny();
      recordingLoopRef.current = { cancelled: false };
      setLastSendError(null);

      const CHUNK_SEC = 5;
      setRecordingDuration(0);
      const loop = async () => {
        while (!recordingLoopRef.current.cancelled) {
          const { recording: chunkRecording } = await Recording.createAsync(
            RecordingOptionsPresets.HIGH_QUALITY
          );
          setCurrentRecording(chunkRecording);
          setRecording(chunkRecording);
          setIsRecording(true);

          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, CHUNK_SEC * 1000);
            chunkRecording.setOnRecordingStatusUpdate((s) => {
              if (!s.isRecording) clearTimeout(t);
            });
          });
          if (recordingLoopRef.current.cancelled) break;

          const now = Date.now();
          setLastActivityAt(now);
          setIsProcessing(true);

          let uri: string | null = null;
          try {
            const status = await chunkRecording.getStatusAsync();
            uri = (status?.uri && typeof status.uri === 'string') ? status.uri : null;
          } catch (_) {}
          if (!uri) {
            uri = await new Promise<string | null>((resolve) => {
              let done = false;
              const tryResolve = (u: string | null) => {
                if (!done) {
                  done = true;
                  resolve(u || null);
                }
              };
              chunkRecording.setOnRecordingStatusUpdate(async (s) => {
                if (!s.isRecording && !done) {
                  const fromCallback = (s.uri && typeof s.uri === 'string') ? s.uri : null;
                  if (fromCallback) {
                    tryResolve(fromCallback);
                    return;
                  }
                  await new Promise((r) => setTimeout(r, 100));
                  if (done) return;
                  try {
                    const status = await chunkRecording.getStatusAsync();
                    const u = (status?.uri && typeof status.uri === 'string') ? status.uri : null;
                    tryResolve(u);
                  } catch (_) {
                    tryResolve(null);
                  }
                }
              });
              chunkRecording.stopAndUnloadAsync().then(() => {
                if (!done) tryResolve(null);
              });
            });
          } else {
            await chunkRecording.stopAndUnloadAsync();
          }
          setCurrentRecording(null);
          setRecording(null);

          if (uri) {
            const blob = await readFileUriToBlob(uri, 'audio/wav').catch(() => null);
            if (blob) {
              try {
                const result = await recordAndDetectCry(
                  sessionId,
                  childId,
                  parentId,
                  sitterId,
                  blob
                );
                if (result.success && result.data) {
                  setLastSendError(null);
                  setLastChunkSentAt(Date.now()); // only when actually sent and checked
                  setChunksSentCount((n) => n + 1);
                  const audioLog = result.data;
                  setDetectionHistory((prev) => [audioLog, ...prev].slice(0, 20));
                  if (audioLog.prediction) {
                    setCurrentDetection({
                      label: audioLog.prediction.label,
                      confidence: audioLog.prediction.confidence,
                      timestamp: audioLog.prediction.processedAt,
                    });
                    if (audioLog.prediction.label === 'crying' && audioLog.alertSent) {
                      loadRecentAlerts();
                      Alert.alert(
                        'Crying Detected',
                        `Crying detected with ${(audioLog.prediction.confidence * 100).toFixed(0)}% confidence.`,
                        [{ text: 'OK' }]
                      );
                    }
                  }
                } else {
                  setLastSendError(result.error?.message || 'Send failed');
                }
              } catch (err: any) {
                console.error('Error sending clip:', err);
                setLastSendError(err?.message || 'Network request failed');
              }
            } else {
              setLastSendError('Could not read audio file');
            }
          } else {
            setLastSendError('Could not get recording file');
          }
          setIsProcessing(false);
          if (recordingLoopRef.current.cancelled) break;
        }
        setIsRecording(false);
      };
      loop();
    } catch (err: any) {
      Alert.alert('Error', `Failed to start recording: ${err.message}`);
    }
  };

  const stopRecording = async () => {
    recordingLoopRef.current.cancelled = true;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (_) {}
      setCurrentRecording(null);
      setRecording(null);
    }
    setIsRecording(false);
    setRecordingDuration(0);
    setCurrentDetection(null);
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
              Cry Detection
            </Text>
          </View>
          {effectivelyRecording && (
            <View style={[styles.recordingIndicator, { backgroundColor: colors.error }]}>
              <View style={[styles.recordingDot, { backgroundColor: colors.white }]} />
              <Text style={[styles.recordingText, { color: colors.white }]}>
                REC
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.flowExplanation, { color: colors.textSecondary }]}>
          {effectivelyRecording
            ? 'Audio is sent to AI every 5 seconds. If crying is detected, an alert is sent to the parent and you.'
            : 'Start recording to capture audio. Our AI analyzes it and sends alerts to you and the parent when crying is detected.'}
        </Text>

        <View style={[styles.howItWorksCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.howItWorksTitle, { color: colors.text }]}>How it works</Text>
          <Text style={[styles.howItWorksStep, { color: colors.textSecondary }]}>
            1. Recording runs → 2. Every 5 s a clip is sent to our AI → 3. If crying is detected (confidence &gt; 60%), an alert is created → 4. You and the parent see it here and in Notifications / Track.
          </Text>
        </View>

        {recordingStartedByMonitoring && (
          <View style={[styles.monitoringActiveRow, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={[styles.monitoringActiveText, { color: colors.primary }]}>
              Listening… (started with Monitoring). Use "Stop Monitoring" above to stop.
            </Text>
          </View>
        )}

        {/* Audio transfer status: clear states so we never hang on "first clip" */}
        {effectivelyRecording && (
          <View style={[styles.transferStatusRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
            <View style={styles.transferStatusText}>
              {isProcessing ? (
                <Text style={[styles.transferStatusLabel, { color: colors.primary }]}>
                  Sending to AI…
                </Text>
              ) : lastChunkSentAt != null || lastChunkSentAtFromMonitoring != null ? (
                <>
                  <Text style={[styles.transferStatusLabel, { color: colors.text }]}>
                    Last sent & checked: {formatDistanceToNow(new Date(Math.max(lastChunkSentAt ?? 0, lastChunkSentAtFromMonitoring ?? 0)), { addSuffix: true })}
                  </Text>
                  {chunksSentCount > 0 && (
                    <Text style={[styles.transferStatusCount, { color: colors.textSecondary }]}>
                      {chunksSentCount} clip{chunksSentCount !== 1 ? 's' : ''} sent & checked
                    </Text>
                  )}
                  {currentDetection && (
                    <Text style={[styles.transferStatusCount, { color: currentDetection.label === 'crying' ? colors.error : colors.textSecondary }]}>
                      Last result: {currentDetection.label} ({(currentDetection.confidence * 100).toFixed(0)}%)
                    </Text>
                  )}
                </>
              ) : lastSendError ? (
                <>
                  <Text style={[styles.transferStatusLabel, { color: colors.error }]} numberOfLines={2}>
                    {lastSendError}
                  </Text>
                  {(lastSendError.includes('Network') || lastSendError.includes('request failed') || lastSendError.includes('Send failed')) && (
                    <Text style={[styles.transferStatusCount, { color: colors.error }]}>
                      On phone: use computer IP in .env (e.g. EXPO_PUBLIC_AI_SERVICE_URL=http://192.168.x.x:8001)
                    </Text>
                  )}
                </>
              ) : lastActivityAt != null ? (
                <Text style={[styles.transferStatusLabel, { color: colors.textSecondary }]}>
                  Preparing audio…
                </Text>
              ) : (
                <Text style={[styles.transferStatusLabel, { color: colors.textSecondary }]}>
                  Capturing audio… first clip in ~5 s
                </Text>
              )}
            </View>
          </View>
        )}

        {isRecording && (
          <View style={styles.recordingInfo}>
            <Text style={[styles.durationText, { color: colors.text }]}>
              {formatDuration(recordingDuration)}
            </Text>
            {isProcessing && (
              <View style={styles.processingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.processingText, { color: colors.textSecondary }]}>
                  Sending to AI...
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.controlsButtons}>
          {!effectivelyRecording ? (
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
          ) : recordingStartedByMonitoring ? null : (
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
      <Card style={styles.alertsCard}>
        <Text style={[styles.alertsTitle, { color: colors.text }]}>
          Cry alerts {recentAlerts.length > 0 ? `(${recentAlerts.length})` : ''}
        </Text>
        {recentAlerts.length === 0 ? (
          <Text style={[styles.noAlertsYet, { color: colors.textSecondary }]}>
            When the AI detects crying, an alert is saved and sent to you and the parent. Alerts will appear here and in the Notifications tab.
          </Text>
        ) : (
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
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginTop: 4,
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
  flowExplanation: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  howItWorksCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  howItWorksTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  howItWorksStep: {
    fontSize: 12,
    lineHeight: 16,
  },
  noAlertsYet: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  monitoringActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  monitoringActiveText: {
    fontSize: 13,
    flex: 1,
  },
  transferStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  transferStatusText: {
    flex: 1,
  },
  transferStatusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  transferStatusCount: {
    fontSize: 12,
    marginTop: 2,
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
