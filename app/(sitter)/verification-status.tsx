import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';

export default function VerificationStatusScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Verification Status" />
      <EmptyState
        icon="checkmark-circle-outline"
        title="Verification Status"
        message="View your verification status and documents"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
