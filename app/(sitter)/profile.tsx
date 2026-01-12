import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { updateUserProfile } from '@/src/services/auth.service';
import { uploadFile } from '@/src/services/storage.service';
import { ensureUserRowExists } from '@/src/services/user-api.service';
import { supabase } from '@/src/config/supabase';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { User } from '@/src/types/user.types';
import { isSupabaseConfigured } from '@/src/config/supabase';

export default function SitterProfileScreen() {
  const { colors, spacing, setTheme, manualTheme } = useTheme();
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // State architecture: profile (DB source of truth) vs form (local editable state)
  const [profile, setProfile] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    phoneNumber: '',
    address: '',
    city: '',
    country: '',
    bio: '',
    profileImageUrl: null as string | null,
  });
  
  const [notifications, setNotifications] = useState({
    requests: true,
    messages: true,
  });
  const [menuVisible, setMenuVisible] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  /**
   * Fetch profile from auth + DB, ensure row exists
   */
  const fetchProfile = useCallback(async () => {
    if (!user || !supabase || fetchingRef.current) {
      return;
    }
    
    fetchingRef.current = true;
    setFetchingProfile(true);
    try {
      // Get auth user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.error('❌ Failed to get auth user:', authError);
        return;
      }

      // Set auth email (read-only)
      setAuthEmail(authUser.email || '');

      // Ensure user row exists in users table
      await ensureUserRowExists(
        authUser.id,
        authUser.email || '',
        authUser.user_metadata?.display_name || authUser.user_metadata?.full_name
      ).catch((err) => {
        console.warn('⚠️ Failed to ensure user row exists:', err);
      });

      // Refresh profile from API/cache
      await refreshProfile().catch((err) => {
        console.warn('⚠️ Failed to refresh profile:', err);
      });
    } catch (error: any) {
      console.error('❌ Error fetching profile:', error);
    } finally {
      fetchingRef.current = false;
      setFetchingProfile(false);
    }
  }, [user, refreshProfile]);

  // Sync profile state from userProfile (source-of-truth from DB)
  useEffect(() => {
    if (userProfile) {
      setProfile(userProfile);
      console.log('📥 Profile state updated from userProfile:', {
        id: userProfile.id,
        displayName: userProfile.displayName,
        email: userProfile.email,
        phoneNumber: (userProfile as any)?.phoneNumber,
        address: (userProfile as any)?.address,
        city: (userProfile as any)?.city,
        country: (userProfile as any)?.country,
        bio: (userProfile as any)?.bio,
      });
    }
  }, [userProfile]);

  // Sync form from profile - ONLY when NOT editing
  useEffect(() => {
    if (profile && !editing) {
      const displayName = profile.displayName?.trim() || profile.email?.split('@')[0] || '';
      setForm({
        displayName,
        email: profile.email || '',
        phoneNumber: (profile as any)?.phoneNumber || '',
        address: (profile as any)?.address || '',
        city: (profile as any)?.city || '',
        country: (profile as any)?.country || '',
        bio: (profile as any)?.bio || '',
        profileImageUrl: profile.profileImageUrl || null,
      });
      console.log('📝 Form synced from profile:', {
        displayName,
        email: profile.email,
        phoneNumber: (profile as any)?.phoneNumber,
        address: (profile as any)?.address,
        city: (profile as any)?.city,
        country: (profile as any)?.country,
        bio: (profile as any)?.bio,
      });
    }
  }, [profile, editing]);

  // Initial profile fetch on mount - ensure row exists and fetch from auth + DB
  // Only fetch once on mount, don't refetch on every render
  useEffect(() => {
    if (user?.id && !fetchingRef.current && !hasFetchedRef.current) {
      console.log('🔄 Initial profile fetch on mount...');
      hasFetchedRef.current = true;
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Subscribe to realtime changes for user profile
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;

    console.log('🔄 Setting up realtime subscription for user profile...');
    
    const channel = supabase
      .channel(`user-profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log('📢 User profile updated via realtime:', payload);
          // Only refresh if not editing (don't overwrite user input)
          if (!editing) {
            refreshProfile().catch((error) => {
              console.warn('⚠️ Failed to refresh profile after realtime update:', error);
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, [user?.id, editing, refreshProfile]);

  // Refresh profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id && !editing && !fetchingRef.current) {
        console.log('🔄 Profile screen focused, refreshing profile...');
        fetchProfile();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, editing])
  );

  const handlePickImage = async () => {
    if (!editing) return;
    
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
        
        try {
          // Convert to blob - handle both local file URIs and network URIs
          console.log('📸 Converting image to blob, URI:', asset.uri);
          const response = await fetch(asset.uri);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          console.log('✅ Blob created, size:', blob.size, 'bytes, type:', blob.type);
          
          if (blob.size === 0) {
            throw new Error('Image file is empty');
          }
          
          // Upload to Supabase Storage
          const imagePath = `profileImages/${user.id}/${Date.now()}.jpg`;
          console.log('📤 Starting upload to:', imagePath);
          const uploadResult = await uploadFile(imagePath, blob, 'image/jpeg', {
            maxSize: 5 * 1024 * 1024,
          });

          if (uploadResult.success && uploadResult.data) {
            // Update form state immediately
            setForm(prev => ({ ...prev, profileImageUrl: uploadResult.data! }));
            Alert.alert('Success', 'Profile picture selected! Click save to update.');
          } else {
            // Show helpful error message
            const errorMsg = uploadResult.error?.message || 'Failed to upload image';
            console.error('❌ Upload failed:', errorMsg);
            
            // Check if it's a bucket configuration issue
            if (errorMsg.includes('bucket') || errorMsg.includes('Storage') || errorMsg.includes('policy') || errorMsg.includes('RLS')) {
              Alert.alert(
                'Storage Setup Required',
                'Please set up Supabase Storage first:\n\n1. Go to Supabase Dashboard → Storage\n2. Create bucket "profile-images" (public)\n3. Set up RLS policies\n\nSee SUPABASE_STORAGE_SETUP.md for details.',
                [{ text: 'OK' }]
              );
            } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
              Alert.alert(
                'Network Error',
                'Failed to upload image. This might be:\n\n1. Network connectivity issue\n2. Supabase Storage policies not set up\n3. CORS configuration issue\n\nPlease check your internet connection and verify Storage policies in Supabase Dashboard.',
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert('Upload Error', errorMsg);
            }
          }
          setUploadingImage(false);
        } catch (fetchError: any) {
          console.error('❌ Error converting image to blob:', fetchError);
          setUploadingImage(false);
          Alert.alert('Error', `Failed to process image: ${fetchError.message || 'Unknown error'}`);
        }
      }
    } catch (error: any) {
      setUploadingImage(false);
      console.error('❌ Image picker error:', error);
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };

  const handleEdit = () => {
    console.log('✏️ Edit button pressed - setting editing mode');
    // Clone current profile into form - INSTANT, no network calls
    const sourceProfile = profile || userProfile;
    if (sourceProfile) {
      const displayName = sourceProfile.displayName?.trim() || sourceProfile.email?.split('@')[0] || '';
      setForm({
        displayName,
        email: sourceProfile.email || '',
        phoneNumber: (sourceProfile as any)?.phoneNumber || '',
        address: (sourceProfile as any)?.address || '',
        city: (sourceProfile as any)?.city || '',
        country: (sourceProfile as any)?.country || '',
        bio: (sourceProfile as any)?.bio || '',
        profileImageUrl: sourceProfile.profileImageUrl || null,
      });
      console.log('📝 Form initialized from profile:', { displayName, email: sourceProfile.email });
    } else {
      // If no profile yet, use auth email and empty form
      setForm({
        displayName: authEmail?.split('@')[0] || '',
        email: authEmail || '',
        phoneNumber: '',
        address: '',
        city: '',
        country: '',
        bio: '',
        profileImageUrl: null,
      });
      console.log('📝 Form initialized from auth email:', authEmail);
    }
    setEditing(true);
    console.log('✅ Editing mode enabled');
  };

  const handleCancel = () => {
    // Reset form back to current profile
    if (profile) {
      const displayName = profile.displayName?.trim() || profile.email?.split('@')[0] || '';
      setForm({
        displayName,
        email: profile.email || '',
        phoneNumber: (profile as any)?.phoneNumber || '',
        address: (profile as any)?.address || '',
        city: (profile as any)?.city || '',
        country: (profile as any)?.country || '',
        bio: (profile as any)?.bio || '',
        profileImageUrl: profile.profileImageUrl || null,
      });
    }
    setEditing(false);
  };

  const handleSave = async () => {
    if (!user || !supabase) {
      console.error('❌ No user found, cannot save profile');
      Alert.alert('Error', 'No user found. Please log in again.');
      return;
    }
    
    console.log('💾 Saving profile with data:', {
      displayName: form.displayName,
      phoneNumber: form.phoneNumber.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      bio: form.bio.trim() || null,
      profileImageUrl: form.profileImageUrl || undefined,
    });
    
    setSaving(true);
    try {
      const updates = {
        displayName: form.displayName.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        bio: form.bio.trim() || null,
        profileImageUrl: form.profileImageUrl || undefined,
      } as any;
      
      console.log('📤 Calling updateUserProfile with:', updates);
      let result = await updateUserProfile(updates);
      console.log('📥 updateUserProfile result:', result);
      
      // If API fails, try direct Supabase update as fallback
      if (!result.success) {
        console.log('⚠️ API update failed, trying direct Supabase update...');
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const supabaseUpdates: any = {};
            if (updates.displayName !== undefined) supabaseUpdates.display_name = updates.displayName;
            if (updates.phoneNumber !== undefined) supabaseUpdates.phone_number = updates.phoneNumber;
            if (updates.address !== undefined) supabaseUpdates.address = updates.address;
            if (updates.city !== undefined) supabaseUpdates.city = updates.city;
            if (updates.country !== undefined) supabaseUpdates.country = updates.country;
            if (updates.bio !== undefined) supabaseUpdates.bio = updates.bio;
            if (updates.profileImageUrl !== undefined) supabaseUpdates.photo_url = updates.profileImageUrl;
            supabaseUpdates.updated_at = new Date().toISOString();

            const { data: updatedData, error: updateError } = await supabase
              .from('users')
              .update(supabaseUpdates)
              .eq('id', authUser.id)
              .select()
              .single();

            if (updateError) {
              console.error('❌ Direct Supabase update failed:', updateError);
              Alert.alert('Error', `Failed to update profile: ${updateError.message}`);
              setSaving(false);
              return;
            }

            // Update auth metadata if display_name changed
            if (updates.displayName) {
              await supabase.auth.updateUser({
                data: {
                  display_name: updates.displayName,
                  full_name: updates.displayName,
                },
              }).catch((err) => {
                console.warn('⚠️ Failed to update auth metadata:', err);
              });
            }

            // Convert to User type
            const updatedUser: User = {
              id: updatedData.id,
              email: updatedData.email,
              displayName: updatedData.display_name,
              role: updatedData.role === 'sitter' ? 'babysitter' : updatedData.role,
              preferredLanguage: updatedData.preferred_language || 'en',
              userNumber: updatedData.user_number,
              phoneNumber: updatedData.phone_number,
              profileImageUrl: updatedData.photo_url,
              address: updatedData.address,
              city: updatedData.city,
              country: updatedData.country,
              createdAt: new Date(updatedData.created_at),
              updatedAt: new Date(updatedData.updated_at),
            } as User;

            // Add extended properties
            (updatedUser as any).bio = updatedData.bio;
            (updatedUser as any).theme = updatedData.theme || 'auto';
            (updatedUser as any).isVerified = updatedData.is_verified || false;
            (updatedUser as any).verificationStatus = updatedData.verification_status;
            (updatedUser as any).hourlyRate = updatedData.hourly_rate;

            result = { success: true, data: updatedUser };
            console.log('✅ Direct Supabase update successful');
          }
        } catch (directError: any) {
          console.error('❌ Direct Supabase update exception:', directError);
          Alert.alert('Error', `Failed to update profile: ${directError.message}`);
          setSaving(false);
          return;
        }
      }
      
      if (result.success && result.data) {
        console.log('✅ Profile update successful');
        // Update profile state with merged result
        setProfile(result.data);
        setEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
        // Refresh profile to ensure sync
        await refreshProfile().catch(() => {});
      } else {
        console.error('❌ Profile update failed:', result.error);
        Alert.alert('Error', result.error?.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('❌ Exception during profile update:', error);
      console.error('❌ Error details:', error.message, error.stack);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
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
        <View style={styles.profileCardWrapper}>
          <Card style={{ marginBottom: 0 }}>
            <View style={styles.section}>
              <TouchableOpacity
                onPress={editing ? handlePickImage : undefined}
                disabled={!editing || uploadingImage}
                style={styles.avatarContainer}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : form.profileImageUrl ? (
                  <Image source={{ uri: form.profileImageUrl }} style={styles.avatar} />
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
                    value={form.displayName}
                    onChangeText={(value) => setForm(prev => ({ ...prev, displayName: value }))}
                    placeholder="Full Name"
                    editable={true}
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    value={authEmail || form.email}
                    editable={false}
                    placeholder="Email Address (cannot be changed)"
                    style={[styles.input, { backgroundColor: colors.background + '80', color: colors.textSecondary, borderColor: colors.border }]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    value={form.phoneNumber}
                    onChangeText={(value) => setForm(prev => ({ ...prev, phoneNumber: value }))}
                    placeholder="Phone Number"
                    editable={true}
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    value={form.address}
                    onChangeText={(value) => setForm(prev => ({ ...prev, address: value }))}
                    placeholder="Address"
                    editable={true}
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    value={form.city}
                    onChangeText={(value) => setForm(prev => ({ ...prev, city: value }))}
                    placeholder="City"
                    editable={true}
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    value={form.country}
                    onChangeText={(value) => setForm(prev => ({ ...prev, country: value }))}
                    placeholder="Country"
                    editable={true}
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    value={form.bio}
                    onChangeText={(value) => setForm(prev => ({ ...prev, bio: value }))}
                    placeholder="Tell parents about your experience and skills..."
                    style={[styles.input, styles.bioInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    multiline
                    numberOfLines={4}
                    placeholderTextColor={colors.textSecondary}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.name, { color: colors.text }]}>
                    {form.displayName || profile?.email?.split('@')[0] || 'No name set'}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>{authEmail || form.email || 'No email'}</Text>
                  {form.phoneNumber && <Text style={{ color: colors.textSecondary }}>{form.phoneNumber}</Text>}
                  {form.address && <Text style={{ color: colors.textSecondary }}>{form.address}</Text>}
                  {(form.city || form.country) && (
                    <Text style={{ color: colors.textSecondary }}>
                      {[form.city, form.country].filter(Boolean).join(', ')}
                    </Text>
                  )}
                  <Text style={[styles.bio, { color: colors.textSecondary }]}>{form.bio || 'No bio added yet'}</Text>
                </>
              )}
            </View>
          </Card>
          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed && { opacity: 0.6 }
            ]}
            onPress={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('🔘 Edit/Save button PRESSED, editing:', editing, 'saving:', saving);
              if (editing) {
                handleSave();
              } else {
                handleEdit();
              }
            }}
            disabled={saving}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={editing ? "Save profile changes" : "Edit profile"}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={editing ? 'checkmark' : 'pencil'}
                size={22}
                color={colors.primary}
              />
            )}
          </Pressable>
          {editing && (
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && { opacity: 0.6 }
              ]}
              onPress={() => {
                console.log('Cancel pressed');
                handleCancel();
              }}
              disabled={saving}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Cancel editing"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={colors.error} />
            </Pressable>
          )}
        </View>

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
  profileCardWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  section: {
    alignItems: 'center',
    position: 'relative',
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
    top: 16,
    right: 16,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    zIndex: 1000,
    elevation: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 8,
      },
    }),
  },
  cancelButton: {
    position: 'absolute',
    top: 16,
    right: 70,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    zIndex: 1000,
    elevation: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 8,
      },
    }),
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
