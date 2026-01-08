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
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import Button from '@/src/components/ui/Button';
import AdminHamburgerMenu from '@/src/components/ui/AdminHamburgerMenu';

export default function AdminSettingsScreen() {
  const { colors } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  
  const [security, setSecurity] = useState({
    requireStrongPassword: true,
    sessionTimeout: true,
    ipWhitelist: false,
    auditLog: true,
  });
  
  const [system, setSystem] = useState({
    maintenanceMode: false,
    allowNewRegistrations: true,
    autoApproveSitters: false,
    enableEmailNotifications: true,
  });

  const handleMaintenanceToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable Maintenance Mode',
        'This will disable the app for all users except admins. Continue?',
        [
          { text: 'Cancel', onPress: () => {} },
          { text: 'Enable', onPress: () => setSystem({ ...system, maintenanceMode: true }) },
        ]
      );
    } else {
      setSystem({ ...system, maintenanceMode: value });
    }
  };

  const handleAutoApproveToggle = (value: boolean) => {
    Alert.alert(
      value ? 'Enable Auto-Approval' : 'Disable Auto-Approval',
      value
        ? 'Sitters will be automatically verified without admin review. Continue?'
        : 'Sitters will require admin verification. Continue?',
      [
        { text: 'Cancel', onPress: () => {} },
        { text: 'Confirm', onPress: () => setSystem({ ...system, autoApproveSitters: value }) },
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Security Settings</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Require Strong Password</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Enforce password complexity rules
                </Text>
              </View>
            </View>
            <Switch
              value={security.requireStrongPassword}
              onValueChange={(v) => setSecurity({ ...security, requireStrongPassword: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="time-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Session Timeout</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Auto-logout after inactivity
                </Text>
              </View>
            </View>
            <Switch
              value={security.sessionTimeout}
              onValueChange={(v) => setSecurity({ ...security, sessionTimeout: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>IP Whitelist</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Restrict admin access to specific IPs
                </Text>
              </View>
            </View>
            <Switch
              value={security.ipWhitelist}
              onValueChange={(v) => setSecurity({ ...security, ipWhitelist: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="document-text-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Audit Log</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Track all admin actions
                </Text>
              </View>
            </View>
            <Switch
              value={security.auditLog}
              onValueChange={(v) => setSecurity({ ...security, auditLog: v })}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>System Settings</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="construct-outline" size={20} color={colors.warning} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Maintenance Mode</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Disable app for non-admin users
                </Text>
              </View>
            </View>
            <Switch
              value={system.maintenanceMode}
              onValueChange={handleMaintenanceToggle}
              trackColor={{ false: colors.border, true: colors.warning }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="person-add-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Allow New Registrations</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Enable user registration
                </Text>
              </View>
            </View>
            <Switch
              value={system.allowNewRegistrations}
              onValueChange={(v) => setSystem({ ...system, allowNewRegistrations: v })}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Auto-Approve Sitters</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Automatically verify new sitters
                </Text>
              </View>
            </View>
            <Switch
              value={system.autoApproveSitters}
              onValueChange={handleAutoApproveToggle}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.text} style={styles.switchIcon} />
              <View style={styles.labelContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Email Notifications</Text>
                <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                  Send system email notifications
                </Text>
              </View>
            </View>
            <Switch
              value={system.enableEmailNotifications}
              onValueChange={(v) => setSystem({ ...system, enableEmailNotifications: v })}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>
          
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => Alert.alert('Export Data', 'Export all user data as CSV')}
          >
            <Ionicons name="download-outline" size={20} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Export Data</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => Alert.alert('Backup Database', 'Create a backup of all data')}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Backup Database</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem]}
            onPress={() => {
              Alert.alert(
                'Clear Cache',
                'This will clear all cached data. Continue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Success', 'Cache cleared') },
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.error }]}>Clear Cache</Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>App Version</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Build Number</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>2024.01.15</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Last Updated</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>January 2024</Text>
          </View>
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
