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
  /** When true, render as inline bar button (no floating); use inside a bottom action bar */
  inline?: boolean;
  /** FAB position: 'left' | 'right' (matches home screen circles). Ignored when inline. */
  position?: 'left' | 'right';
}

export default function EmergencyCallButton({ session, role, inline, position = 'right' }: EmergencyCallButtonProps) {
  const { colors } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);

  if (session.status !== 'active') {
    return null;
  }

  const openSheet = () => setSheetVisible(true);

  const fabStyle = [
    styles.fab,
    { backgroundColor: colors.error ?? '#dc2626' },
    position === 'left' ? styles.fabLeft : styles.fabRight,
  ];

  return (
    <>
      <TouchableOpacity
        style={[inline ? styles.inlineButton : fabStyle]}
        onPress={openSheet}
        activeOpacity={0.9}
      >
        <Ionicons name="call" size={inline ? 22 : 26} color="#fff" />
        {inline && <Text style={[styles.fabLabel, styles.inlineLabel]}>Emergency</Text>}
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
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 100,
  },
  fabLeft: {
    left: 20,
  },
  fabRight: {
    right: 20,
  },
  fabLabel: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  inlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
  },
  inlineLabel: {
    fontSize: 14,
  },
});
