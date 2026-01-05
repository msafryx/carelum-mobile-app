import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';

export default function VerificationsScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Verification Queue" />
      <EmptyState
        icon="document-outline"
        title="No Pending Verifications"
        message="All verification requests have been processed"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
