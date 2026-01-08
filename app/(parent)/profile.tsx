import Card from '@/src/components/ui/Card';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import Header from '@/src/components/ui/Header';
import { useTheme } from '@/src/config/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { updateUserProfile } from '@/src/services/auth.service';
import { deleteChild, getParentChildren, saveChild } from '@/src/services/child.service';
import { getAll, STORAGE_KEYS } from '@/src/services/local-storage.service';
import { uploadFile } from '@/src/services/storage.service';
import { Child } from '@/src/types/child.types';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ProfileScreen() {
  const { colors, spacing, setTheme, manualTheme } = useTheme();
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(userProfile?.displayName || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [phone, setPhone] = useState((userProfile as any)?.phoneNumber || '');
  const [profileImage, setProfileImage] = useState<string | null>(userProfile?.profileImageUrl || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [showChildModal, setShowChildModal] = useState(false);
  const [uploadingChildImage, setUploadingChildImage] = useState<string | null>(null);
  const [childForm, setChildForm] = useState({
    name: '',
    age: '',
    dateOfBirth: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    photoUrl: '',
  });
  const [notifications, setNotifications] = useState({
    booking: true,
    sitter: true,
  });
  const [twoFA, setTwoFA] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Load profile data from AsyncStorage/Firebase
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.displayName || '');
      setEmail(userProfile.email || '');
      setPhone((userProfile as any)?.phoneNumber || '');
      setProfileImage(userProfile.profileImageUrl || null);
    }
  }, [userProfile]);

  // Load children from AsyncStorage first, then Firebase
  useEffect(() => {
    loadChildren();
  }, [user]);

  // Refresh children when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 Profile screen focused, refreshing children...');
        loadChildren();
      }
    }, [user])
  );

  // Set up interval to check for changes (every 5 seconds)
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      console.log('🔄 Periodic refresh: checking for children updates...');
      loadChildren();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Listen for children updates from real-time sync (cross-platform)
  useEffect(() => {
    if (!user) return;
    
    let unsubscribe: (() => void) | undefined;
    let handleWebEvent: (() => void) | undefined;
    
    // Import the emitter (works on all platforms)
    import('@/src/hooks/useRealtimeSync').then((module) => {
      if (module.childrenUpdateEmitter) {
        console.log('✅ Event emitter imported successfully');
        unsubscribe = module.childrenUpdateEmitter.on(() => {
          console.log('📢 Children updated event received, refreshing children...');
          loadChildren();
        });
        console.log('✅ Event listener registered');
      } else {
        console.warn('⚠️ childrenUpdateEmitter not found in module');
      }
    }).catch((error) => {
      console.error('❌ Failed to import childrenUpdateEmitter:', error);
    });
    
    // Also listen on web for CustomEvent (web only)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      handleWebEvent = () => {
        console.log('📢 Web children updated event received, refreshing...');
        loadChildren();
      };
      window.addEventListener('childrenUpdated', handleWebEvent);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (handleWebEvent && Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('childrenUpdated', handleWebEvent);
      }
    };
  }, [user]);

  const loadChildren = async () => {
    if (!user) return;
    setLoadingChildren(true);
    
    try {
      // Try AsyncStorage first
      const result = await getAll(STORAGE_KEYS.CHILDREN);
      if (result.success && result.data) {
        const userChildren = result.data.filter((c: any) => c.parentId === user.id);
        if (userChildren.length > 0) {
          const formattedChildren: Child[] = userChildren.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt || Date.now()),
            updatedAt: new Date(c.updatedAt || Date.now()),
            dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : undefined,
          }));
          setChildren(formattedChildren);
          console.log('✅ Children loaded from AsyncStorage');
          setLoadingChildren(false);
          return;
        }
      }
      
      // Fallback to Supabase
      const supabaseResult = await getParentChildren(user.id);
      if (supabaseResult.success && supabaseResult.data) {
        setChildren(supabaseResult.data);
        console.log('✅ Children loaded from Supabase');
      }
    } catch (error: any) {
      console.error('❌ Failed to load children:', error.message);
    } finally {
      setLoadingChildren(false);
    }
  };

  const handleAddChild = () => {
    setEditingChild(null);
    setChildForm({ name: '', age: '', dateOfBirth: '', gender: '', photoUrl: '' });
    setShowChildModal(true);
  };

  const handleEditChild = (child: Child) => {
    setEditingChild(child);
    setChildForm({
      name: child.name,
      age: child.age.toString(),
      dateOfBirth: child.dateOfBirth?.toISOString().split('T')[0] || '',
      gender: child.gender || '',
      photoUrl: child.photoUrl || '',
    });
    setShowChildModal(true);
  };

  const handlePickChildImage = async (childId?: string) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && user) {
        const asset = result.assets[0];
        setUploadingChildImage(childId || 'new');
        
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        
        const imagePath = `childImages/${user.id}/${childId || 'new'}_${Date.now()}.jpg`;
        const uploadResult = await uploadFile(imagePath, blob, 'image/jpeg', {
          maxSize: 5 * 1024 * 1024,
        });

        if (uploadResult.success && uploadResult.data) {
          setChildForm({ ...childForm, photoUrl: uploadResult.data });
          Alert.alert('Success', 'Child photo uploaded!');
        } else {
          Alert.alert('Error', uploadResult.error?.message || 'Failed to upload image');
        }
        setUploadingChildImage(null);
      }
    } catch (error: any) {
      setUploadingChildImage(null);
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };

  const handleSaveChild = async () => {
    if (!user) return;
    
    if (!childForm.name.trim() || !childForm.age.trim()) {
      Alert.alert('Error', 'Please fill in name and age');
      return;
    }

    setLoading(true);
    try {
      const childData: Child = {
        id: editingChild?.id || '',
        parentId: user.id,
        name: childForm.name.trim(),
        age: parseInt(childForm.age) || 0,
        dateOfBirth: childForm.dateOfBirth ? new Date(childForm.dateOfBirth) : undefined,
        gender: childForm.gender || undefined,
        photoUrl: childForm.photoUrl || undefined,
        createdAt: editingChild?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      const result = await saveChild(childData);
      
      if (result.success && result.data) {
        Alert.alert('Success', editingChild ? 'Child updated successfully!' : 'Child added successfully!');
        setShowChildModal(false);
        setEditingChild(null);
        setChildForm({ name: '', age: '', dateOfBirth: '', gender: '', photoUrl: '' });
        await loadChildren();
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to save child');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save child');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChild = async (childId: string, childName: string) => {
    Alert.alert(
      'Delete Child',
      `Are you sure you want to delete ${childName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('🗑️ Deleting child:', childId);
            setLoading(true);
            try {
              // Remove from local state immediately for instant UI update
              setChildren(prev => prev.filter(c => c.id !== childId));
              
              // Then delete from storage/Supabase
              const result = await deleteChild(childId);
              console.log('🗑️ Delete result:', result);
              
              if (result.success) {
                // Reload children to ensure sync
                await loadChildren();
                Alert.alert('Success', 'Child deleted successfully');
              } else {
                // If delete failed, reload to restore state
                await loadChildren();
                Alert.alert('Error', result.error?.message || 'Failed to delete child');
              }
            } catch (error: any) {
              // If error, reload to restore state
              await loadChildren();
              console.error('❌ Delete error:', error);
              Alert.alert('Error', error.message || 'Failed to delete child');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

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
        
        // Convert to blob
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        
        // Upload to Supabase Storage
        const imagePath = `profileImages/${user.id}/${Date.now()}.jpg`;
        const uploadResult = await uploadFile(imagePath, blob, 'image/jpeg', {
          maxSize: 5 * 1024 * 1024, // 5MB
        });

        if (uploadResult.success && uploadResult.data) {
          setProfileImage(uploadResult.data);
          // Update profile with new image URL
          await updateUserProfile({
            profileImageUrl: uploadResult.data,
          });
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
        profileImageUrl: profileImage || undefined,
      });
      
      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully!');
        setEditing(false);
        // Refresh profile to show updated data
        await refreshProfile();
        // Reload children
        await loadChildren();
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
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loadingChildren}
            onRefresh={loadChildren}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
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
              </>
            ) : (
              <>
                <Text style={[styles.name, { color: colors.text }]}>{name || 'No name set'}</Text>
                <Text style={{ color: colors.textSecondary }}>{email || 'No email'}</Text>
                <Text style={{ color: colors.textSecondary }}>{phone || 'No phone number'}</Text>
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

        <Card>
          <View style={styles.childrenHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Children</Text>
            <TouchableOpacity
              onPress={handleAddChild}
              style={[styles.addChildButton, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addChildButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {loadingChildren ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : children.length === 0 ? (
            <View style={styles.emptyChildren}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No children added yet
              </Text>
              <TouchableOpacity
                onPress={handleAddChild}
                style={[styles.addChildButtonLarge, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.addChildButtonText}>Add Your First Child</Text>
              </TouchableOpacity>
            </View>
          ) : (
            children.map((child) => (
              <View key={child.id} style={[styles.childRow, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => handlePickChildImage(child.id)}
                  style={styles.childAvatarContainer}
                >
                  {child.photoUrl ? (
                    <Image source={{ uri: child.photoUrl }} style={styles.childAvatar} />
                  ) : (
                    <View style={[styles.childAvatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="person" size={24} color={colors.primary} />
                    </View>
                  )}
                  <View style={[styles.childAvatarOverlay, { backgroundColor: colors.primary + '80' }]}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View style={styles.childInfo}>
                  <Text style={[styles.childName, { color: colors.text }]}>{child.name}</Text>
                  <View style={styles.childDetails}>
                    {child.age && (
                      <Text style={[styles.childDetail, { color: colors.textSecondary }]}>
                        Age: {child.age}
                      </Text>
                    )}
                    {child.gender && (
                      <Text style={[styles.childDetail, { color: colors.textSecondary }]}>
                        • {child.gender}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.childActions}>
                  <TouchableOpacity
                    onPress={() => router.push('/(parent)/instructions')}
                    style={styles.childActionButton}
                  >
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleEditChild(child)}
                    style={styles.childActionButton}
                  >
                    <Ionicons name="pencil" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteChild(child.id, child.name)}
                    style={styles.childActionButton}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Add/Edit Child Modal */}
        <Modal
          visible={showChildModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowChildModal(false);
            setEditingChild(null);
            setChildForm({ name: '', age: '', dateOfBirth: '', gender: '', photoUrl: '' });
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingChild ? 'Edit Child' : 'Add Child'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowChildModal(false);
                    setEditingChild(null);
                    setChildForm({ name: '', age: '', dateOfBirth: '', gender: '', photoUrl: '' });
                  }}
                >
                  <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                <TouchableOpacity
                  onPress={() => handlePickChildImage(editingChild?.id)}
                  style={styles.modalAvatarContainer}
                >
                  {uploadingChildImage ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                  ) : childForm.photoUrl ? (
                    <Image source={{ uri: childForm.photoUrl }} style={styles.modalAvatar} />
                  ) : (
                    <View style={[styles.modalAvatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="camera" size={32} color={colors.primary} />
                    </View>
                  )}
                  <View style={[styles.modalAvatarOverlay, { backgroundColor: colors.primary + '80' }]}>
                    <Ionicons name="camera" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
                
                <TextInput
                  value={childForm.name}
                  onChangeText={(text) => setChildForm({ ...childForm, name: text })}
                  placeholder="Child's Name *"
                  style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={childForm.age}
                  onChangeText={(text) => setChildForm({ ...childForm, age: text })}
                  placeholder="Age *"
                  keyboardType="number-pad"
                  style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={childForm.dateOfBirth}
                  onChangeText={(text) => setChildForm({ ...childForm, dateOfBirth: text })}
                  placeholder="Date of Birth (YYYY-MM-DD)"
                  style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={styles.genderContainer}>
                  <Text style={[styles.genderLabel, { color: colors.text }]}>Gender</Text>
                  <View style={styles.genderOptions}>
                    {(['male', 'female', 'other'] as const).map((gender) => (
                      <TouchableOpacity
                        key={gender}
                        onPress={() => setChildForm({ ...childForm, gender })}
                        style={[
                          styles.genderOption,
                          {
                            backgroundColor: childForm.gender === gender ? colors.primary : colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.genderOptionText,
                            { color: childForm.gender === gender ? '#fff' : colors.text },
                          ]}
                        >
                          {gender.charAt(0).toUpperCase() + gender.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleSaveChild}
                  disabled={loading}
                  style={[styles.modalSaveButton, { backgroundColor: colors.primary }]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  childInfo: {
    marginLeft: 12,
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  childAge: {
    fontSize: 14,
  },
  childrenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addChildButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addChildButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  addChildButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  emptyChildren: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  loader: {
    paddingVertical: 20,
  },
  childAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  childAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  childAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  childDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  childDetail: {
    fontSize: 12,
    marginRight: 4,
  },
  childActions: {
    flexDirection: 'row',
    gap: 8,
  },
  childActionButton: {
    padding: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalScrollContent: {
    padding: 16,
  },
  modalAvatarContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  modalAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  modalInput: {
    width: '100%',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  genderContainer: {
    marginBottom: 12,
  },
  genderLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
