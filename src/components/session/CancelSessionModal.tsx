/**
 * Cancel Session Modal - Uber-like cancellation with reason selection
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Session } from '@/src/types/session.types';

interface CancelSessionModalProps {
  visible: boolean;
  session: Session | null;
  onClose: () => void;
  onConfirm: (reason: string, customReason?: string) => Promise<void>;
  loading?: boolean;
}

const CANCELLATION_REASONS = [
  {
    id: 'change_plans',
    label: 'Change of plans',
    icon: 'calendar-outline',
    description: 'My plans have changed',
  },
  {
    id: 'found_other_sitter',
    label: 'Found another sitter',
    icon: 'person-outline',
    description: 'I found a different sitter',
  },
  {
    id: 'no_longer_needed',
    label: 'No longer needed',
    icon: 'close-circle-outline',
    description: 'I don\'t need this session anymore',
  },
  {
    id: 'sitter_too_far',
    label: 'Sitter too far',
    icon: 'location-outline',
    description: 'The sitter is too far away',
  },
  {
    id: 'wrong_time',
    label: 'Wrong time',
    icon: 'time-outline',
    description: 'I selected the wrong time',
  },
  {
    id: 'emergency',
    label: 'Emergency',
    icon: 'alert-circle-outline',
    description: 'I have an emergency',
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'ellipsis-horizontal-outline',
    description: 'Other reason',
  },
];

export default function CancelSessionModal({
  visible,
  session,
  onClose,
  onConfirm,
  loading = false,
}: CancelSessionModalProps) {
  const { colors, spacing } = useTheme();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleReasonSelect = (reasonId: string) => {
    setSelectedReason(reasonId);
    if (reasonId === 'other') {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
      setCustomReason('');
    }
  };

  const handleConfirm = async () => {
    if (!selectedReason) {
      Alert.alert('Select Reason', 'Please select a reason for cancellation');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      Alert.alert('Enter Reason', 'Please enter a reason for cancellation');
      return;
    }

    const reason = selectedReason === 'other' 
      ? customReason.trim() 
      : CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || '';

    await onConfirm(reason, selectedReason === 'other' ? customReason : undefined);
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason('');
    setShowCustomInput(false);
    onClose();
  };

  const getCancellationWarning = () => {
    if (!session) return '';
    
    if (session.status === 'requested') {
      return 'You can cancel this request at no cost.';
    } else if (session.status === 'accepted') {
      return 'Cancelling an accepted session may result in a cancellation fee.';
    } else if (session.status === 'active') {
      return 'Cancelling an active session may result in charges.';
    }
    return '';
  };

  const canCancel = session && ['requested', 'accepted', 'active'].includes(session.status);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Cancel Session</Text>
            <TouchableOpacity onPress={handleClose} disabled={loading} style={[styles.closeButton, { backgroundColor: colors.border }]}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {session && (
            <View style={[styles.sessionInfo, { backgroundColor: colors.border }]}>
              <Text style={[styles.sessionInfoText, { color: colors.text }]}>
                {session.childId ? 'Session for your child' : 'Session'}
              </Text>
              <Text style={[styles.sessionInfoText, { color: colors.textSecondary }]}>
                {new Date(session.startTime).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}

          {getCancellationWarning() && (
            <View style={[styles.warning, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="information-circle" size={20} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.warning }]}>
                {getCancellationWarning()}
              </Text>
            </View>
          )}

          <Text style={[styles.subtitle, { color: colors.text }]}>
            Why are you cancelling?
          </Text>

          <ScrollView style={styles.reasonsList} showsVerticalScrollIndicator={false}>
            {CANCELLATION_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonItem,
                  {
                    backgroundColor: selectedReason === reason.id 
                      ? colors.primary + '20' 
                      : colors.card,
                    borderColor: selectedReason === reason.id 
                      ? colors.primary 
                      : colors.border,
                  },
                ]}
                onPress={() => handleReasonSelect(reason.id)}
                disabled={loading}
              >
                <View style={styles.reasonContent}>
                  <Ionicons
                    name={reason.icon as any}
                    size={24}
                    color={selectedReason === reason.id ? colors.primary : colors.textSecondary}
                  />
                  <View style={styles.reasonText}>
                    <Text style={[styles.reasonLabel, { color: colors.text }]}>
                      {reason.label}
                    </Text>
                    <Text style={[styles.reasonDescription, { color: colors.textSecondary }]}>
                      {reason.description}
                    </Text>
                  </View>
                </View>
                {selectedReason === reason.id && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showCustomInput && (
            <View style={styles.customReasonContainer}>
              <Text style={[styles.customReasonLabel, { color: colors.text }]}>
                Please tell us more
              </Text>
              <TextInput
                style={[
                  styles.customReasonInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Enter your reason..."
                placeholderTextColor={colors.textSecondary}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
                numberOfLines={3}
                editable={!loading}
              />
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Keep Session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                {
                  backgroundColor: colors.error || '#ef4444',
                  opacity: loading ? 0.6 : 1,
                },
              ]}
              onPress={handleConfirm}
              disabled={loading || !selectedReason}
            >
              {loading ? (
                <Text style={styles.confirmButtonText}>Cancelling...</Text>
              ) : (
                <Text style={styles.confirmButtonText}>Cancel Session</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sessionInfo: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    // backgroundColor set inline per theme (colors.border) for dark/light visibility
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  sessionInfoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    flex: 1,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  reasonsList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  reasonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reasonText: {
    marginLeft: 12,
    flex: 1,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reasonDescription: {
    fontSize: 14,
  },
  customReasonContainer: {
    marginBottom: 16,
  },
  customReasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  customReasonInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
