/**
 * Reusable emergency call bottom sheet (used on session screen and home).
 * Parent: Call Sitter, Call Emergency, Call Child Emergency Contact.
 * Sitter: Call Parent, Call Child Emergency Contact, Call Doctor, Call Emergency.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
} from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { EmergencyInfo, getSessionEmergencyInfo, logEmergencyCall } from '@/src/services/session.service';

export type EmergencySheetRole = 'parent' | 'sitter';

type Action = 'sitter' | 'parent' | 'emergency' | 'child_contact' | 'doctor';

function getOptions(role: EmergencySheetRole): { action: Action; label: string }[] {
  if (role === 'parent') {
    return [
      { action: 'sitter', label: 'Call Sitter' },
      { action: 'emergency', label: 'Call Emergency' },
      { action: 'child_contact', label: 'Call Child Emergency Contact' },
    ];
  }
  return [
    { action: 'parent', label: 'Call Parent' },
    { action: 'child_contact', label: 'Call Child Emergency Contact' },
    { action: 'doctor', label: 'Call Doctor' },
    { action: 'emergency', label: 'Call Emergency Services' },
  ];
}

function getPhoneForAction(
  action: Action,
  info: {
    emergencyNumber: string;
    sitterPhone?: string | null;
    parentPhone?: string | null;
    childEmergencyContactPhone?: string | null;
    doctorPhone?: string | null;
  }
): string | null {
  switch (action) {
    case 'emergency':
      return info.emergencyNumber || '911';
    case 'sitter':
      return info.sitterPhone ?? null;
    case 'parent':
      return info.parentPhone ?? null;
    case 'child_contact':
      return info.childEmergencyContactPhone ?? null;
    case 'doctor':
      return info.doctorPhone ?? null;
    default:
      return null;
  }
}

interface EmergencyCallSheetProps {
  sessionId: string;
  role: EmergencySheetRole;
  visible: boolean;
  onClose: () => void;
}

export default function EmergencyCallSheet({ sessionId, role, visible, onClose }: EmergencyCallSheetProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [emergencyInfo, setEmergencyInfo] = useState<EmergencyInfo | null>(null);

  useEffect(() => {
    if (visible && sessionId) {
      setEmergencyInfo(null);
      setLoadingOptions(true);
      getSessionEmergencyInfo(sessionId).then((res) => {
        setLoadingOptions(false);
        if (res.success && res.data) setEmergencyInfo(res.data);
        else Alert.alert('Error', res.error?.message ?? 'Could not load emergency contacts.');
      });
    }
  }, [visible, sessionId]);

  const handleOption = async (action: Action) => {
    setLoading(true);
    await logEmergencyCall(sessionId, action);
    setLoading(false);
    const info =
      emergencyInfo ?? {
        emergencyNumber: '911',
        sitterPhone: null,
        parentPhone: null,
        childEmergencyContactPhone: null,
        doctorPhone: null,
      };
    const phone = getPhoneForAction(action, info);
    onClose();
    if (phone) Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
    else Alert.alert('Number not available', 'This contact’s phone number is not set.');
  };

  const options = getOptions(role);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Emergency call</Text>
          {loadingOptions ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : (
            options.map((opt) => (
              <TouchableOpacity
                key={opt.action}
                style={[styles.option, { borderColor: colors.border }]}
                onPress={() => handleOption(opt.action)}
                disabled={loading}
              >
                <Ionicons name="call-outline" size={22} color={colors.primary} />
                <Text style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  loader: { marginVertical: 24 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  cancelText: {
    fontSize: 16,
  },
});
