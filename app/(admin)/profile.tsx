import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import Button from '@/src/components/ui/Button';
import AdminHamburgerMenu from '@/src/components/ui/AdminHamburgerMenu';
import { useAuth } from '@/src/hooks/useAuth';
import { updateUserProfile } from '@/src/services/auth.service';
import { signOut } from '@/src/services/auth.service';
import { useRouter } from 'expo-router';

export default function AdminProfileScreen() {
  const { colors, setTheme, manualTheme } = useTheme();
  const { userProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState(userProfile?.displayName || 'Admin User');
  const [email, setEmail] = useState(userProfile?.email || 'admin@carelum.com');
  const [phone, setPhone] = useState('');
  
  const [notifications, setNotifications] = useState({
    verifications: true,
    userReports: true,
    systemAlerts: true,
    weeklyReports: false,
  });
  
  const [twoFA, setTwoFA] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(30); // minutes

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.displayName);
      setEmail(userProfile.email);
    }
  }, [userProfile]);

  const handleSave = async () => {
    setLoading(true);
    const result = await updateUserProfile({
      displayName: name,
    });
    
    if (result.success) {
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to update profile');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
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
      <Header showLogo={true} title="Admin Profile" showBack={true} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.section}>
            <Image
              source={require('@/assets/images/adult.webp')}
              style={styles.avatar}
            />
            {editing ? (
              <>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Display Name"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={email}
                  editable={false}
                  style={[styles.input, { backgroundColor: colors.background + '80', color: colors.textSecondary, borderColor: colors.border }]}
                  placeholder="Email (cannot be changed)"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={styles.buttonRow}>
                  <Button
                    title="Cancel"
                    onPress={() => setEditing(false)}
                    variant="outline"
                    style={styles.cancelButton}
                  />
                  <Button
                    title="Save"
                    onPress={handleSave}
                    loading={loading}
                    style={styles.saveButton}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
                <Text style={[styles.email, { color: colors.textSecondary }]}>{email}</Text>
                {phone && <Text style={[styles.phone, { color: colors.textSecondary }]}>{phone}</Text>}
                <View style={styles.badge}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                  <Text style={[styles.badgeText, { color: colors.success }]}>Administrator</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setEditing(true)}
                >
                  <Ionicons name="pencil" size={22} color={colors.primary} />
                  <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit Profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="moon-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <Text style={[styles.switchLabel, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={manualTheme === 'dark'}
              onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="document-check-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <Text style={[styles.switchLabel, { color: colors.text }]}>Verification Requests</Text>
            </View>
            <Switch
              value={notifications.verifications}
              onValueChange={(v) => setNotifications((n) => ({ ...n, verifications: v }))}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="warning-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <Text style={[styles.switchLabel, { color: colors.text }]}>User Reports</Text>
            </View>
            <Switch
              value={notifications.userReports}
              onValueChange={(v) => setNotifications((n) => ({ ...n, userReports: v }))}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <Text style={[styles.switchLabel, { color: colors.text }]}>System Alerts</Text>
            </View>
            <Switch
              value={notifications.systemAlerts}
              onValueChange={(v) => setNotifications((n) => ({ ...n, systemAlerts: v }))}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="stats-chart-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <Text style={[styles.switchLabel, { color: colors.text }]}>Weekly Reports</Text>
            </View>
            <Switch
              value={notifications.weeklyReports}
              onValueChange={(v) => setNotifications((n) => ({ ...n, weeklyReports: v }))}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Security</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <Text style={[styles.switchLabel, { color: colors.text }]}>Two-Factor Authentication</Text>
            </View>
            <Switch value={twoFA} onValueChange={setTwoFA} />
          </View>
          <TouchableOpacity
            style={[styles.menuItem, { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 12, paddingTop: 12 }]}
            onPress={() => router.push('/(admin)/settings')}
          >
            <Ionicons name="settings-outline" size={20} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Security Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(admin)/settings')}
          >
            <Ionicons name="settings-outline" size={20} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => Alert.alert('Help', 'Contact support at admin@carelum.com')}
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
            <Text style={[styles.menuText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
      <AdminHamburgerMenu
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
  section: {
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#51cf6610',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 8,
    gap: 6,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
    fontSize: 18,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchIcon: {
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 16,
    flex: 1,
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
});
