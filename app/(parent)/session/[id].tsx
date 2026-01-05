import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';

export default function SessionDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Session Details" />
      <EmptyState
        icon="time-outline"
        title="Session View"
        message={`Session ID: ${id}. This will show active session details, GPS tracking, and monitoring.`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
