import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';

export default function UsersScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Manage Users" />
      <EmptyState
        icon="people-outline"
        title="User Management"
        message="View and manage all users in the system"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
