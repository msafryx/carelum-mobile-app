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

export default function SitterHamburgerMenu({ visible, onClose }: Props) {
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
    // Use replace to switch tabs, push for other screens
    if (['profile', 'activities', 'messages', 'notifications', 'home', 'requests'].includes(screen.toLowerCase())) {
      router.replace(`/(sitter)/${screen.toLowerCase()}` as any);
    } else {
      router.push(`/(sitter)/${screen.toLowerCase()}` as any);
    }
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
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('profile')}
              >
                <Ionicons
                  name="person-circle"
                  size={24}
                  color={colors.text}
                  style={styles.icon}
                />
                <Text style={[styles.text, { color: colors.text }]}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('requests')}
              >
                <Ionicons
                  name="mail"
                  size={24}
                  color={colors.text}
                  style={styles.icon}
                />
                <Text style={[styles.text, { color: colors.text }]}>Session Requests</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('activities')}
              >
                <Ionicons
                  name="calendar"
                  size={24}
                  color={colors.text}
                  style={styles.icon}
                />
                <Text style={[styles.text, { color: colors.text }]}>My Sessions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('messages')}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={24}
                  color={colors.text}
                  style={styles.icon}
                />
                <Text style={[styles.text, { color: colors.text }]}>Messages</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('profile-setup')}
              >
                <Ionicons
                  name="create-outline"
                  size={24}
                  color={colors.text}
                  style={styles.icon}
                />
                <Text style={[styles.text, { color: colors.text }]}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('verification-status')}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={24}
                  color={colors.text}
                  style={styles.icon}
                />
                <Text style={[styles.text, { color: colors.text }]}>Verification</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => go('settings')}
              >
                <Ionicons
                  name="settings"
                  size={24}
                  color={colors.text}
                  style={styles.icon}
                />
                <Text style={[styles.text, { color: colors.text }]}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={handleLogout}
              >
                <Ionicons
                  name="log-out"
                  size={24}
                  color={colors.error}
                  style={styles.icon}
                />
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
