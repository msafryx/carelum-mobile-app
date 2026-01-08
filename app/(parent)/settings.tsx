import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { signOut } from '@/src/services/auth.service';

export default function ParentSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  
  const [notifications, setNotifications] = useState({
    sessionAlerts: true,
    cryDetection: true,
    gpsUpdates: true,
    messages: true,
    bookingUpdates: true,
  });
  
  const [privacy, setPrivacy] = useState({
    shareLocation: true,
    showProfile: true,
    allowMessages: true,
  });

  const [session, setSession] = useState({
    autoStartTracking: true,
    enableCryDetection: true,
    enableGPS: true,
  });

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.burgerButton}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="menu" size={30} color={colors.text} />
      </TouchableOpacity>
      <Header showLogo={true} title="Settings" showBack={true} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Session Alerts</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Get notified about session updates
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.sessionAlerts}
              onValueChange={(v) => setNotifications({ ...notifications, sessionAlerts: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="warning-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Cry Detection</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Alerts when crying is detected
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.cryDetection}
              onValueChange={(v) => setNotifications({ ...notifications, cryDetection: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="location-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>GPS Updates</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Real-time location updates
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.gpsUpdates}
              onValueChange={(v) => setNotifications({ ...notifications, gpsUpdates: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Messages</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  New message notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.messages}
              onValueChange={(v) => setNotifications({ ...notifications, messages: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="calendar-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Booking Updates</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Session request notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.bookingUpdates}
              onValueChange={(v) => setNotifications({ ...notifications, bookingUpdates: v })}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Settings</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="radio-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Auto-Start Tracking</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Automatically enable GPS when session starts
                </Text>
              </View>
            </View>
            <Switch
              value={session.autoStartTracking}
              onValueChange={(v) => setSession({ ...session, autoStartTracking: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="mic-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Cry Detection</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Enable AI cry detection during sessions
                </Text>
              </View>
            </View>
            <Switch
              value={session.enableCryDetection}
              onValueChange={(v) => setSession({ ...session, enableCryDetection: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="location-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>GPS Tracking</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Track sitter location during sessions
                </Text>
              </View>
            </View>
            <Switch
              value={session.enableGPS}
              onValueChange={(v) => setSession({ ...session, enableGPS: v })}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="location-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Share Location</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Allow sitters to see your location
                </Text>
              </View>
            </View>
            <Switch
              value={privacy.shareLocation}
              onValueChange={(v) => setPrivacy({ ...privacy, shareLocation: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="eye-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Show Profile</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Make your profile visible to sitters
                </Text>
              </View>
            </View>
            <Switch
              value={privacy.showProfile}
              onValueChange={(v) => setPrivacy({ ...privacy, showProfile: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Allow Messages</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Let sitters message you
                </Text>
              </View>
            </View>
            <Switch
              value={privacy.allowMessages}
              onValueChange={(v) => setPrivacy({ ...privacy, allowMessages: v })}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(parent)/activities')}
          >
            <Ionicons name="list-outline" size={20} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>View Sessions</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(parent)/profile')}
          >
            <Ionicons name="person-outline" size={20} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => Alert.alert('Help & Support', 'Contact support at support@carelum.com')}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.error }]}>Log Out</Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>App Version</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>User Number</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>
              {userProfile?.userNumber || 'N/A'}
            </Text>
          </View>
        </Card>
      </ScrollView>
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
    padding: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
    fontSize: 18,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 20,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  switchIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  labelContainer: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
