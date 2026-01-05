import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import Button from '@/src/components/ui/Button';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';

export default function ParentHomeScreen() {
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
      <Header showLogo={true} showBack={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          placeholder="Search sitters"
          placeholderTextColor={colors.textSecondary}
          style={[styles.search, { backgroundColor: colors.white, color: colors.text }]}
        />

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(parent)/search')}
          >
            <Text style={styles.quickText}>Book Sitter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(parent)/activities')}
          >
            <Text style={styles.quickText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => {}}
          >
            <Text style={styles.quickText}>Track</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Sessions</Text>
        <Card>
          <EmptyState
            icon="calendar-outline"
            title="No upcoming sessions"
            message="You don't have any upcoming sessions scheduled"
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Sessions</Text>
        <Card>
          <EmptyState
            icon="radio-outline"
            title="No active sessions"
            message="You don't have any active babysitting sessions at the moment"
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended Sitters</Text>
        <Card>
          <EmptyState
            icon="star-outline"
            title="Coming soon"
            message="Recommended babysitters will appear here"
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activities</Text>
        <Card>
          <EmptyState
            icon="time-outline"
            title="Nothing yet"
            message="Your recent activities will appear here"
          />
        </Card>
      </ScrollView>

      <TouchableOpacity
        style={[styles.chatbotButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(parent)/messages')}
      >
        <Ionicons name="chatbubbles" size={28} color={colors.white} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.emergencyButton, { backgroundColor: colors.emergency }]}
        onPress={() => {}}
      >
        <Ionicons name="call" size={26} color={colors.white} />
      </TouchableOpacity>

      <HamburgerMenu
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  search: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 20,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  quickButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickText: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
  },
  chatbotButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  emergencyButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
