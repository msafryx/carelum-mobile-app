import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';

export default function ProfileSetupScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Profile Setup" />
      <EmptyState
        icon="person-outline"
        title="Complete Your Profile"
        message="Add your bio, hourly rate, and upload verification documents"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
