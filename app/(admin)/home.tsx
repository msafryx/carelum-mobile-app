import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import Button from '@/src/components/ui/Button';
import { useRouter } from 'expo-router';

export default function AdminHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} showBack={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Button
            title="Verification Queue"
            onPress={() => router.push('/(admin)/verifications')}
            style={styles.button}
          />
        </Card>

        <Card>
          <Button
            title="Manage Users"
            onPress={() => router.push('/(admin)/users')}
            style={styles.button}
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
  button: {
    marginBottom: 8,
  },
});
