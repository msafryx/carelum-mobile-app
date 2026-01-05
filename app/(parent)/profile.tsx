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
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';

export default function ProfileScreen() {
  const { colors, spacing, setTheme, manualTheme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('Jane Parent');
  const [email, setEmail] = useState('jane@example.com');
  const [phone, setPhone] = useState('555-1234');
  const [notifications, setNotifications] = useState({
    booking: true,
    sitter: true,
  });
  const [twoFA, setTwoFA] = useState(false);
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
              </>
            ) : (
              <>
                <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
                <Text style={{ color: colors.textSecondary }}>{email}</Text>
                <Text style={{ color: colors.textSecondary }}>{phone}</Text>
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
            <Text style={[styles.switchLabel, { color: colors.text }]}>Booking Reminders</Text>
            <Switch
              value={notifications.booking}
              onValueChange={(v) => setNotifications((n) => ({ ...n, booking: v }))}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>New Sitter Alerts</Text>
            <Switch
              value={notifications.sitter}
              onValueChange={(v) => setNotifications((n) => ({ ...n, sitter: v }))}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Security</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Two-Factor Authentication</Text>
            <Switch value={twoFA} onValueChange={setTwoFA} />
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
  input: {
    width: '100%',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
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
});
