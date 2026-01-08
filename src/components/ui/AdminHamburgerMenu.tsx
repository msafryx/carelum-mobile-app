import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { signOut } from '@/src/services/auth.service';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AdminHamburgerMenu({ visible, onClose }: Props) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const drawerPosition = useRef(new Animated.Value(250)).current;

  useEffect(() => {
    Animated.timing(drawerPosition, {
      toValue: visible ? 0 : 250,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, drawerPosition]);

  const go = (screen: string) => {
    onClose();
    router.push(`/(admin)/${screen}` as any);
  };

  const handleLogout = async () => {
    onClose();
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.drawer,
                {
                  backgroundColor: colors.white,
                  transform: [{ translateX: drawerPosition }],
                },
              ]}
            >
              <View style={styles.header}>
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
                <Text style={[styles.headerText, { color: colors.text }]}>Admin Menu</Text>
              </View>

              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('home')}
              >
                <Ionicons name="home" size={24} color={colors.text} style={styles.icon} />
                <Text style={[styles.text, { color: colors.text }]}>Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('verifications')}
              >
                <Ionicons name="document-check-outline" size={24} color={colors.text} style={styles.icon} />
                <Text style={[styles.text, { color: colors.text }]}>Verification Queue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('users')}
              >
                <Ionicons name="people" size={24} color={colors.text} style={styles.icon} />
                <Text style={[styles.text, { color: colors.text }]}>Manage Users</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('statistics')}
              >
                <Ionicons name="stats-chart" size={24} color={colors.text} style={styles.icon} />
                <Text style={[styles.text, { color: colors.text }]}>Statistics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('profile')}
              >
                <Ionicons name="person-circle" size={24} color={colors.text} style={styles.icon} />
                <Text style={[styles.text, { color: colors.text }]}>Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('settings')}
              >
                <Ionicons name="settings" size={24} color={colors.text} style={styles.icon} />
                <Text style={[styles.text, { color: colors.text }]}>Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out" size={24} color={colors.error} style={styles.icon} />
                <Text style={[styles.text, { color: colors.error }]}>Logout</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
  },
  drawer: {
    width: 250,
    paddingTop: 60,
    position: 'absolute',
    right: 0,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    marginRight: 15,
  },
  text: {
    fontSize: 16,
  },
});
