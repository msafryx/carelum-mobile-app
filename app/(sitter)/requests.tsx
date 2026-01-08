import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import Badge from '@/src/components/ui/Badge';
import { useRouter } from 'expo-router';

export default function SitterRequestsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.burgerButton}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="menu" size={30} color={colors.text} />
      </TouchableOpacity>
      <Header showLogo={true} title="Session Requests" showBack={true} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <EmptyState
            icon="mail-outline"
            title="No Requests"
            message="You don't have any session requests at the moment. Complete your profile to start receiving requests."
            actionLabel="Complete Profile"
            onAction={() => router.push('/(sitter)/profile-setup')}
          />
        </Card>
      </ScrollView>
      <SitterHamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  burgerButton: {
    position: 'absolute',
    top: 60,
    right: 10,
    zIndex: 1000,
    padding: 8,
  },
  content: {
    padding: 16,
  },
});
