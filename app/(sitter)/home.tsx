import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import Button from '@/src/components/ui/Button';
import { useRouter } from 'expo-router';

export default function SitterHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} showBack={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <EmptyState
            icon="person-outline"
            title="Welcome!"
            message="Complete your profile to start receiving requests"
            actionLabel="Set Up Profile"
            onAction={() => router.push('/(sitter)/profile-setup')}
          />
        </Card>

        <Card>
          <EmptyState
            icon="mail-outline"
            title="No Requests"
            message="You don't have any session requests at the moment"
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
});
