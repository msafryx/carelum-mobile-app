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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { updateUserProfile } from '@/src/services/auth.service';
import { uploadFile } from '@/src/services/storage.service';
import * as ImagePicker from 'expo-image-picker';

export default function SitterProfileScreen() {
  const { colors, spacing, setTheme, manualTheme } = useTheme();
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [name, setName] = useState(userProfile?.displayName || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [phone, setPhone] = useState((userProfile as any)?.phoneNumber || '');
  const [bio, setBio] = useState((userProfile as any)?.bio || '');
  const [profileImage, setProfileImage] = useState<string | null>(userProfile?.profileImageUrl || null);
  const [notifications, setNotifications] = useState({
    requests: true,
    messages: true,
  });
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.displayName || '');
      setEmail(userProfile.email || '');
      setPhone((userProfile as any)?.phoneNumber || '');
      setBio((userProfile as any)?.bio || '');
      setProfileImage(userProfile.profileImageUrl || null);
    }
  }, [userProfile]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a profile picture');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && user) {
        setUploadingImage(true);
        const asset = result.assets[0];
        
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        
        const imagePath = `profileImages/${user.id}/${Date.now()}.jpg`;
        const uploadResult = await uploadFile(imagePath, blob, 'image/jpeg', {
          maxSize: 5 * 1024 * 1024,
        });

        if (uploadResult.success && uploadResult.data) {
          setProfileImage(uploadResult.data);
          await updateUserProfile({ profileImageUrl: uploadResult.data });
          await refreshProfile();
          Alert.alert('Success', 'Profile picture updated!');
        } else {
          Alert.alert('Error', uploadResult.error?.message || 'Failed to upload image');
        }
        setUploadingImage(false);
      }
    } catch (error: any) {
      setUploadingImage(false);
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const result = await updateUserProfile({
        displayName: name,
        phoneNumber: phone,
        bio: bio,
        profileImageUrl: profileImage || undefined,
      });
      
      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully!');
        setEditing(false);
        await refreshProfile();
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update profile');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

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
            <TouchableOpacity
              onPress={editing ? handlePickImage : undefined}
              disabled={!editing || uploadingImage}
              style={styles.avatarContainer}
            >
              {uploadingImage ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatar} />
              ) : (
                <Image source={require('@/assets/images/adult.webp')} style={styles.avatar} />
              )}
              {editing && (
                <View style={[styles.avatarOverlay, { backgroundColor: colors.primary + '80' }]}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            {editing ? (
              <>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Full Name"
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email Address"
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone Number"
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell parents about your experience and skills..."
                  style={[styles.input, styles.bioInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            ) : (
              <>
                <Text style={[styles.name, { color: colors.text }]}>{name || 'No name set'}</Text>
                <Text style={{ color: colors.textSecondary }}>{email || 'No email'}</Text>
                <Text style={{ color: colors.textSecondary }}>{phone || 'No phone number'}</Text>
                <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio || 'No bio added yet'}</Text>
              </>
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={editing ? handleSave : () => setEditing(true)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={editing ? 'checkmark' : 'pencil'}
                  size={22}
                  color={colors.primary}
                />
              )}
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
            onPress={() => router.push('/(sitter)/settings')}
          >
            <Ionicons name="settings-outline" size={24} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.menuItem]}
            onPress={() => router.push('/(sitter)/activities')}
          >
            <Ionicons name="list-outline" size={24} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>View Sessions</Text>
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
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
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
