import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';

export default function RequestsScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Session Requests" />
      <EmptyState
        icon="mail-outline"
        title="No Requests"
        message="You don't have any session requests at the moment"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
