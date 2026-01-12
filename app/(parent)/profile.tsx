import Card from '@/src/components/ui/Card';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import Header from '@/src/components/ui/Header';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { deleteUser } from '@/src/services/admin.service';
import { signOut, updateUserProfile } from '@/src/services/auth.service';
import { deleteChild, getParentChildren, saveChild } from '@/src/services/child.service';
import { getAll, STORAGE_KEYS } from '@/src/services/local-storage.service';
import { uploadFile } from '@/src/services/storage.service';
import { syncAllDataFromSupabase } from '@/src/services/sync.service';
import { ensureUserRowExists } from '@/src/services/user-api.service';
import { Child } from '@/src/types/child.types';
import { User } from '@/src/types/user.types';
import { calculateAge } from '@/src/utils/formatters';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
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
  
  // Source-of-truth: Last fetched profile from DB
  const [profile, setProfile] = useState<User | null>(null);
  
  // Form state: Editable local state for inputs
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    phoneNumber: '',
    address: '',
    city: '',
    country: '',
    profileImageUrl: null as string | null,
  });
  
  // Auth email (read-only, from auth user)
  const [authEmail, setAuthEmail] = useState<string>('');
  
  // UI state
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [showChildModal, setShowChildModal] = useState(false);
  const [uploadingChildImage, setUploadingChildImage] = useState<string | null>(null);
  const [childForm, setChildForm] = useState({
    name: '',
    age: '',
    dateOfBirth: null as Date | null,
    gender: '' as 'male' | 'female' | 'other' | '',
    photoUrl: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notifications, setNotifications] = useState({
    booking: true,
    sitter: true,
  });
  const [twoFA, setTwoFA] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Removed fetchingProfile - profile loads in background without blocking UI
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
    // Profile loads in background - no UI blocking
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
      // Profile loaded in background
    }
  }, [user]); // Removed refreshProfile from dependencies

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
        profileImageUrl: profile.profileImageUrl || null,
      });
      console.log('📝 Form synced from profile:', {
        displayName,
        email: profile.email,
        phoneNumber: (profile as any)?.phoneNumber,
        address: (profile as any)?.address,
        city: (profile as any)?.city,
        country: (profile as any)?.country,
      });
    }
  }, [profile, editing]);


  // Load children from AsyncStorage first, then Firebase
  useEffect(() => {
    loadChildren();
  }, [user]);

  // Removed automatic refresh on focus - user can manually refresh by pulling down
  // Realtime updates handle background sync without UI interruption

  // Initial profile fetch on mount - ensure row exists and fetch from auth + DB
  // Only fetch once on mount, don't refetch on every render
  useEffect(() => {
    if (user?.id && !fetchingRef.current && !hasFetchedRef.current) {
      console.log('🔄 Initial profile fetch on mount...');
      hasFetchedRef.current = true;
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id, not the whole user object or fetchProfile

  // Subscribe to realtime changes for user profile
  useEffect(() => {
    if (!user?.id || !supabase) return;

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
          // Only refresh if NOT editing (don't overwrite user's typing)
          if (!editing && !fetchingRef.current) {
      refreshProfile().catch((error) => {
              console.warn('⚠️ Failed to refresh profile after realtime update:', error);
      });
          } else {
            console.log('⏸️ Skipping realtime update - user is editing or already fetching');
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime subscription...');
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, editing]); // Only depend on user.id and editing, not refreshProfile

  // Removed automatic periodic refresh - user can manually refresh by pulling down
  // Realtime updates and focus-based refresh handle background updates

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
      // Always try to load from Supabase first to get real IDs
      // This ensures temp IDs are replaced with real IDs from DB
      const supabaseResult = await getParentChildren(user.id);
      
      if (supabaseResult.success && supabaseResult.data && supabaseResult.data.length > 0) {
        // CRITICAL: Deduplicate by ID to prevent duplicates
        const childrenMap = new Map<string, Child>();
        for (const child of supabaseResult.data) {
          if (child.id && !child.id.startsWith('temp_')) {
            childrenMap.set(child.id, child);
          }
        }
        const uniqueChildren = Array.from(childrenMap.values());
        setChildren(uniqueChildren);
        console.log(`✅ Loaded ${uniqueChildren.length} children from Supabase (deduplicated by ID)`);
        setLoadingChildren(false);
        return;
      }
      
      // Fallback to AsyncStorage if Supabase has no data
      const result = await getAll(STORAGE_KEYS.CHILDREN);
      if (result.success && result.data) {
        const userChildren = (result.data as any[]).filter((c: any) => c.parentId === user.id);
        
        // CRITICAL: Deduplicate by ID (prefer real IDs, remove temp IDs)
        const childrenMap = new Map<string, Child>();
        
        for (const c of userChildren) {
          // Skip temp IDs
          if (c.id && c.id.startsWith('temp_')) {
            continue;
          }
          
          // Use ID as key for deduplication
          if (c.id) {
            childrenMap.set(c.id, {
              ...c,
              createdAt: new Date(c.createdAt || Date.now()),
              updatedAt: new Date(c.updatedAt || Date.now()),
              dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : undefined,
            } as Child);
          }
        }
        
        const formattedChildren = Array.from(childrenMap.values());
        setChildren(formattedChildren);
        console.log(`✅ Loaded ${formattedChildren.length} children from AsyncStorage (deduplicated by ID, temp IDs filtered)`);
      } else {
        setChildren([]);
      }
    } catch (error: any) {
      console.error('❌ Failed to load children:', error.message);
      setChildren([]);
    } finally {
      setLoadingChildren(false);
    }
  };

  const handleAddChild = () => {
    setEditingChild(null);
    setChildForm({ name: '', age: '', dateOfBirth: null, gender: '', photoUrl: '' });
    setShowDatePicker(false);
    setShowChildModal(true);
  };

  const handleEditChild = (child: Child) => {
    setEditingChild(child);
    setChildForm({
      name: child.name,
      age: child.age.toString(),
      dateOfBirth: child.dateOfBirth || null,
      gender: child.gender || '',
      photoUrl: child.photoUrl || '',
    });
    setShowDatePicker(false);
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
        
        // Use actual child ID if available, otherwise use 'new'
        const actualChildId = childId && !childId.startsWith('temp_') ? childId : 'new';
        const imagePath = `childImages/${user.id}/${actualChildId}_${Date.now()}.jpg`;
        const uploadResult = await uploadFile(imagePath, blob, 'image/jpeg', {
          maxSize: 5 * 1024 * 1024,
        });

        if (uploadResult.success && uploadResult.data) {
          // If picking photo from list (not in modal), update child directly
          if (childId && !showChildModal) {
            // Find the child and update it directly
            const childToUpdate = children.find(c => c.id === childId);
            if (childToUpdate) {
              const updatedChild: Child = {
                ...childToUpdate,
                photoUrl: uploadResult.data,
                updatedAt: new Date(),
              };
              
              // Update in state immediately with new photo URL and deduplicate
              setChildren(prev => {
                const updated = prev.map(c => 
                  c.id === childId ? { ...updatedChild, photoUrl: uploadResult.data } : c
                );
                // Deduplicate by ID to prevent duplicates
                const childrenMap = new Map<string, Child>();
                for (const child of updated) {
                  if (child.id && !child.id.startsWith('temp_')) {
                    childrenMap.set(child.id, child);
                  }
                }
                return Array.from(childrenMap.values());
              });
              
              // Save to database in background
              saveChild({ ...updatedChild, photoUrl: uploadResult.data }).then(result => {
                if (result.success && result.data) {
                  console.log('✅ Child photo updated in database');
                  // Update state with the saved child (has real ID and photo URL)
                  setChildren(prev => {
                    const childrenMap = new Map<string, Child>();
                    // Add all existing children
                    for (const child of prev) {
                      if (child.id && !child.id.startsWith('temp_')) {
                        childrenMap.set(child.id, child);
                      }
                    }
                    // Update with the saved child
                    if (result.data) {
                      childrenMap.set(result.data.id, result.data);
                    }
                    return Array.from(childrenMap.values());
                  });
                } else {
                  console.warn('⚠️ Failed to save photo update:', result.error);
                  // Revert state on failure
                  setChildren(prev => {
                    const childrenMap = new Map<string, Child>();
                    for (const child of prev) {
                      if (child.id && !child.id.startsWith('temp_')) {
                        childrenMap.set(child.id, child.id === childId ? childToUpdate : child);
                      }
                    }
                    return Array.from(childrenMap.values());
                  });
                  Alert.alert('Error', 'Photo uploaded but failed to save. Please try again.');
                }
              }).catch(err => {
                console.error('❌ Error saving photo update:', err);
                // Revert state on error
                setChildren(prev => {
                  const childrenMap = new Map<string, Child>();
                  for (const child of prev) {
                    if (child.id && !child.id.startsWith('temp_')) {
                      childrenMap.set(child.id, child.id === childId ? childToUpdate : child);
                    }
                  }
                  return Array.from(childrenMap.values());
                });
                Alert.alert('Error', 'Failed to save photo update.');
              });
              
              Alert.alert('Success', 'Child photo updated!');
            }
          } else {
            // If in modal, just update the form
            setChildForm({ ...childForm, photoUrl: uploadResult.data });
            Alert.alert('Success', 'Child photo uploaded!');
          }
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
    
    if (!childForm.name.trim()) {
      Alert.alert('Error', 'Please fill in child\'s name');
      return;
    }

    // Calculate age from date of birth if available, otherwise use manual age
    let calculatedAge = 0;
    if (childForm.dateOfBirth) {
      calculatedAge = calculateAge(childForm.dateOfBirth);
    } else if (childForm.age.trim()) {
      calculatedAge = parseInt(childForm.age) || 0;
    }
    
    if (calculatedAge <= 0) {
      Alert.alert('Error', 'Please provide date of birth or age');
      return;
    }

    setLoading(true);
    try {
      // CRITICAL: Preserve child ID when editing to prevent creating duplicates
      // Check if this child already exists in the children array by name (fallback check)
      let childId = editingChild ? editingChild.id : '';
      
      // If no editingChild but childForm has a name, check if child exists
      if (!childId && childForm.name.trim()) {
        const existingChild = children.find(c => 
          c.name.trim().toLowerCase() === childForm.name.trim().toLowerCase() &&
          c.parentId === user.id
        );
        if (existingChild) {
          childId = existingChild.id;
          console.log('🔍 Found existing child by name, using ID:', childId);
        }
      }
      
      const childData: Child = {
        id: childId, // Preserve ID for updates, empty for new children
        parentId: user.id,
        name: childForm.name.trim(),
        age: calculatedAge, // Use calculated age
        dateOfBirth: childForm.dateOfBirth || undefined,
        gender: childForm.gender || undefined,
        photoUrl: childForm.photoUrl || undefined,
        childNumber: editingChild?.childNumber, // Preserve child number
        parentNumber: editingChild?.parentNumber, // Preserve parent number
        sitterNumber: editingChild?.sitterNumber, // Preserve sitter number
        createdAt: editingChild?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      
      console.log('💾 Saving child:', { 
        name: childData.name, 
        id: childData.id, 
        parentId: childData.parentId,
        isEdit: !!editingChild,
        hasPhoto: !!childData.photoUrl,
        isNew: !childId || childId.trim() === ''
      });

      // Save to Supabase (via saveChild service)
      console.log('💾 Saving child:', { name: childData.name, id: childData.id, parentId: childData.parentId });
      const result = await saveChild(childData);
      console.log('💾 Save result:', result);
      
      if (result.success && result.data) {
        console.log('✅ Child saved successfully:', result.data);
        Alert.alert('Success', editingChild ? 'Child updated successfully!' : 'Child added successfully!');
        setShowChildModal(false);
        setEditingChild(null);
        setChildForm({ name: '', age: '', dateOfBirth: null, gender: '', photoUrl: '' });
        setShowDatePicker(false);
        await loadChildren();
      } else {
        console.error('❌ Failed to save child:', result.error);
        Alert.alert('Error', result.error?.message || 'Failed to save child. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Exception saving child:', error);
      Alert.alert('Error', error.message || 'Failed to save child. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChild = async (childId: string, childName: string) => {
    if (!childId || childId.trim() === '') {
      Alert.alert('Error', 'Invalid child ID');
      return;
    }

    Alert.alert(
      'Delete Child',
      `Are you sure you want to delete ${childName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('🗑️ Deleting child:', childId, 'Name:', childName);
            setLoading(true);
            try {
              // Delete from storage/Supabase first (wait for it to complete)
              const result = await deleteChild(childId);
              console.log('🗑️ Delete result:', result);
              
              if (result.success) {
                // Remove from local state after successful delete
                setChildren(prev => {
                  const childrenMap = new Map<string, Child>();
                  for (const child of prev) {
                    if (child.id && child.id !== childId && !child.id.startsWith('temp_')) {
                      childrenMap.set(child.id, child);
                    }
                  }
                  return Array.from(childrenMap.values());
                });
                
                // Reload children to ensure sync
                await loadChildren();
                Alert.alert('Success', 'Child deleted successfully');
              } else {
                // If delete failed, show error and reload to restore state
                console.error('❌ Delete failed:', result.error);
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
          maxSize: 5 * 1024 * 1024, // 5MB
        });

        if (uploadResult.success && uploadResult.data) {
          // Update form state immediately
          setForm(prev => ({ ...prev, profileImageUrl: uploadResult.data || null }));
          
          // If editing, also save to DB
          if (editing) {
          await updateUserProfile({
            profileImageUrl: uploadResult.data,
          });
          await refreshProfile();
          }
          
          Alert.alert('Success', 'Profile picture updated!');
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
        // Reload children
        await loadChildren();
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

  const handleSync = async () => {
    if (!user) return;
    
    setSyncing(true);
    try {
      const result = await syncAllDataFromSupabase(user.id);
      
      if (result.success && result.data) {
        const { users, children, instructions, sessions, alerts, messages } = result.data;
        await loadChildren();
        await refreshProfile();
        Alert.alert(
          'Sync Complete',
          `Synced:\n• ${users} user profile\n• ${children} children\n• ${instructions} instructions\n• ${sessions} sessions\n• ${alerts} alerts\n• ${messages} messages`
        );
      } else {
        Alert.alert('Sync Error', result.error?.message || 'Failed to sync data');
      }
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      Alert.alert('Sync Error', error.message || 'Failed to sync data');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete:\n\n• Your profile\n• All your children\'s profiles\n• All sessions and bookings\n• All messages and alerts\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            
            setLoading(true);
            try {
              // Delete user profile from database
              const result = await deleteUser(user.id);
              
              if (result.success) {
                // Sign out and navigate to login
                await signOut();
                router.replace('/(auth)/login');
                Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
              } else {
                Alert.alert('Error', result.error?.message || 'Failed to delete account. Please try again.');
              }
            } catch (error: any) {
              console.error('❌ Delete account error:', error);
              Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
            } finally {
              setLoading(false);
            }
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
      <Header showLogo={true} title="Profile" showBack={true} />
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loadingChildren}
            onRefresh={async () => {
              // Refresh both profile and children when user pulls down
              await Promise.all([
                fetchProfile().catch(err => console.warn('⚠️ Profile refresh failed:', err)),
                loadChildren()
              ]);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        scrollEventThrottle={16}
      >
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Sync</Text>
          <TouchableOpacity
            onPress={handleSync}
            style={[styles.syncButton, { backgroundColor: colors.primary }]}
            disabled={syncing || loading}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sync" size={20} color="#fff" />
            )}
            <Text style={styles.syncButtonText}>
              {syncing ? 'Syncing...' : 'Sync All Data'}
            </Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(parent)/settings')}
          >
            <Ionicons name="settings-outline" size={24} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(parent)/activities')}
          >
            <Ionicons name="list-outline" size={24} color={colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>View Sessions</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
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
                    <Image 
                      source={{ uri: child.photoUrl }} 
                      style={styles.childAvatar}
                      key={`${child.id}-${child.photoUrl}`} // Force re-render when photoUrl or child changes
                    />
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
                    {child.dateOfBirth ? (
                      <Text style={[styles.childDetail, { color: colors.textSecondary }]}>
                        Age: {calculateAge(child.dateOfBirth)} years
                      </Text>
                    ) : child.age ? (
                      <Text style={[styles.childDetail, { color: colors.textSecondary }]}>
                        Age: {child.age} years
                      </Text>
                    ) : null}
                    {child.dateOfBirth && (
                      <Text style={[styles.childDetail, { color: colors.textSecondary }]}>
                        • Born: {child.dateOfBirth.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </Text>
                    )}
                    {child.gender && (
                      <Text style={[styles.childDetail, { color: colors.textSecondary }]}>
                        • {child.gender.charAt(0).toUpperCase() + child.gender.slice(1)}
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

        {/* Delete Account - At the bottom */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={[styles.deleteAccountButton, { borderColor: colors.error }]}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.deleteAccountText, { color: colors.error }]}>Delete Account</Text>
          </TouchableOpacity>
        </Card>

        {/* Add/Edit Child Modal */}
        <Modal
          visible={showChildModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowChildModal(false);
            setEditingChild(null);
            setChildForm({ name: '', age: '', dateOfBirth: null, gender: '', photoUrl: '' });
            setShowDatePicker(false);
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
                    setChildForm({ name: '', age: '', dateOfBirth: null, gender: '', photoUrl: '' });
                    setShowDatePicker(false);
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
                    <Image 
                      source={{ uri: childForm.photoUrl }} 
                      style={styles.modalAvatar}
                      key={childForm.photoUrl} // Force re-render when photoUrl changes
                    />
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
                {/* Date of Birth with Date Picker */}
                <View style={styles.datePickerContainer}>
                  <Text style={[styles.datePickerLabel, { color: colors.text }]}>Date of Birth</Text>
                  {Platform.OS === 'web' ? (
                    <View style={[styles.datePickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Ionicons name="calendar" size={22} color={colors.primary} style={styles.datePickerIcon} />
                      <View style={{ flex: 1 }}>
                        {/* @ts-ignore - Web-specific input */}
                        <input
                          type="date"
                          value={childForm.dateOfBirth ? childForm.dateOfBirth.toISOString().split('T')[0] : ''}
                          onChange={(e: any) => {
                            const date = e.target.value ? new Date(e.target.value) : null;
                            setChildForm({ 
                              ...childForm, 
                              dateOfBirth: date,
                              age: date ? calculateAge(date).toString() : ''
                            });
                          }}
                          max={new Date().toISOString().split('T')[0]}
                          min="1900-01-01"
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            fontSize: 16,
                            fontWeight: 500,
                            color: childForm.dateOfBirth ? colors.text : colors.textSecondary,
                            backgroundColor: 'transparent',
                            padding: 0,
                            fontFamily: 'inherit',
                          }}
                        />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        console.log('📅 Opening date picker...');
                        setShowDatePicker(true);
                      }}
                      style={[styles.datePickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Ionicons name="calendar" size={22} color={colors.primary} style={styles.datePickerIcon} />
                      <Text style={[styles.datePickerText, { color: childForm.dateOfBirth ? colors.text : colors.textSecondary }]}>
                        {childForm.dateOfBirth 
                          ? childForm.dateOfBirth.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                          : 'Select Date of Birth'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {showDatePicker && Platform.OS !== 'web' && (
                    <DateTimePicker
                      value={childForm.dateOfBirth || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        console.log('📅 Date picker event:', event.type, selectedDate);
                        if (Platform.OS === 'android') {
                          setShowDatePicker(false);
                        }
                        if (event.type === 'set' && selectedDate) {
                          setChildForm({ 
                            ...childForm, 
                            dateOfBirth: selectedDate,
                            age: calculateAge(selectedDate).toString()
                          });
                          if (Platform.OS === 'android') {
                            setShowDatePicker(false);
                          }
                        } else if (event.type === 'dismissed') {
                          setShowDatePicker(false);
                        }
                      }}
                    />
                  )}
                </View>
                
                {/* Age (auto-calculated from date of birth, but can be manually edited) - Below Date of Birth */}
                <TextInput
                  value={childForm.age}
                  onChangeText={(text) => setChildForm({ ...childForm, age: text })}
                  placeholder="Age * (auto-calculated from date of birth)"
                  keyboardType="number-pad"
                  style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholderTextColor={colors.textSecondary}
                  editable={true} // Allow manual override if needed
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
  input: {
    width: '100%',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
  },
  profileCardWrapper: {
    position: 'relative',
    marginBottom: 16,
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
  datePickerContainer: {
    marginBottom: 12,
  },
  datePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  datePickerIcon: {
    marginRight: 4,
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '600',
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
