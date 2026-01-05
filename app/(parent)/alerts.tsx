import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';

export default function AlertsScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Alerts" />
      <EmptyState
        icon="notifications-outline"
        title="No Alerts"
        message="You're all caught up! Alerts will appear here when crying is detected."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
