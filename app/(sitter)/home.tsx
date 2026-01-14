import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import Header from '@/src/components/ui/Header';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/src/hooks/useAuth';

export default function SitterHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleProfilePress = () => {
    // Always route to profile setup from homepage
    router.push('/(sitter)/profile-setup');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        showLogo={true} 
        title="Dashboard" 
        showBack={false}
        rightComponent={
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={30} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(sitter)/requests')}
          >
            <Ionicons name="mail" size={24} color="#fff" />
            <Text style={styles.quickText}>Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(sitter)/activities')}
          >
            <Ionicons name="calendar" size={24} color="#fff" />
            <Text style={styles.quickText}>Sessions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={handleProfilePress}
          >
            <Ionicons name="person" size={24} color="#fff" />
            <Text style={styles.quickText}>Profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending Requests</Text>
        <Card>
          <EmptyState
            icon="mail-outline"
            title="No pending requests"
            message="You don't have any new session requests at the moment"
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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Sessions</Text>
        <Card>
          <EmptyState
            icon="calendar-outline"
            title="No upcoming sessions"
            message="You don't have any upcoming sessions scheduled"
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
        style={[styles.messagesButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(sitter)/messages')}
      >
        <Ionicons name="chatbubbles" size={28} color={colors.white} />
      </TouchableOpacity>

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
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 100,
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
    gap: 4,
  },
  quickText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
  },
  messagesButton: {
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
});
