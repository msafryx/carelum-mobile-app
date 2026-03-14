/**
 * Emergency call floating button for LIVE sessions.
 * Uses EmergencyCallSheet for the options modal.
 */
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@/src/types/session.types';
import EmergencyCallSheet from './EmergencyCallSheet';

type Role = 'parent' | 'sitter';

interface EmergencyCallButtonProps {
  session: Session;
  role: Role;
}

export default function EmergencyCallButton({ session, role }: EmergencyCallButtonProps) {
  const { colors } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);

  if (session.status !== 'active') {
    return null;
  }

  const openSheet = () => setSheetVisible(true);

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.error ?? '#dc2626' }]}
        onPress={openSheet}
        activeOpacity={0.9}
      >
        <Ionicons name="call" size={28} color="#fff" />
        <Text style={styles.fabLabel}>Emergency</Text>
      </TouchableOpacity>
      <EmergencyCallSheet
        sessionId={session.id}
        role={role}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 100,
  },
  fabLabel: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
});
