import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { useRouter } from 'expo-router';

export default function SitterProfileScreen() {
  const { colors, spacing, setTheme, manualTheme } = useTheme();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('Jane Sitter');
  const [email, setEmail] = useState('jane@example.com');
  const [phone, setPhone] = useState('555-1234');
  const [bio, setBio] = useState('Experienced babysitter with 5 years of childcare experience.');
  const [notifications, setNotifications] = useState({
    requests: true,
    messages: true,
  });
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.burgerButton}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="menu" size={30} color={colors.text} />
      </TouchableOpacity>
      <Header showLogo={true} title="Profile" showBack={true} />
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
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  keyboardType="email-address"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  style={[styles.input, styles.bioInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={colors.textSecondary}
                  placeholder="Bio"
                />
              </>
            ) : (
              <>
                <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
                <Text style={{ color: colors.textSecondary }}>{email}</Text>
                <Text style={{ color: colors.textSecondary }}>{phone}</Text>
                <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text>
              </>
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(!editing)}
            >
              <Ionicons
                name={editing ? 'checkmark' : 'pencil'}
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Dark Mode</Text>
            <Switch
              value={manualTheme === 'dark'}
              onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Request Notifications</Text>
            <Switch
              value={notifications.requests}
              onValueChange={(v) => setNotifications((n) => ({ ...n, requests: v }))}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Message Notifications</Text>
            <Switch
              value={notifications.messages}
              onValueChange={(v) => setNotifications((n) => ({ ...n, messages: v }))}
            />
          </View>
        </Card>

        <Card>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(sitter)/profile-setup')}
          >
            <Ionicons name="create-outline" size={24} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(sitter)/verification-status')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Verification Status</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
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
  section: {
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  bio: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
  },
  input: {
    width: '100%',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  editButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 10,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  switchLabel: {
    fontSize: 16,
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
