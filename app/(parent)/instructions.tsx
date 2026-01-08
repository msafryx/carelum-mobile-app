import Button from '@/src/components/ui/Button';
import Card from '@/src/components/ui/Card';
import Header from '@/src/components/ui/Header';
import Input from '@/src/components/ui/Input';
import { useTheme } from '@/src/config/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { deleteChild, getParentChildren, saveChild, saveChildInstructions } from '@/src/services/child.service';
import { uploadFile } from '@/src/services/storage.service';
import { Child, ChildInstructions } from '@/src/types/child.types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
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
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function InstructionsScreen() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [instructions, setInstructions] = useState<Record<string, ChildInstructions>>({});
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showChildModal, setShowChildModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);

  // Load children on mount
  useEffect(() => {
    loadChildren();
  }, [user]);

  // Refresh children when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 Instructions screen focused, refreshing children...');
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
    setLoading(true);
    try {
      const result = await getParentChildren(user.id);
      if (result.success && result.data) {
        setChildren(result.data);
        console.log(`✅ Loaded ${result.data.length} children`);
      }
    } catch (error: any) {
      console.error('❌ Failed to load children:', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Child form state
  const [childForm, setChildForm] = useState({
    name: '',
    age: '',
    dateOfBirth: null as Date | null,
    gender: '' as 'male' | 'female' | 'other' | '',
    photoUrl: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploadingChildImage, setUploadingChildImage] = useState(false);

  // Instructions form state
  const [instructionsForm, setInstructionsForm] = useState({
    feedingSchedule: '',
    napSchedule: '',
    bedtime: '',
    dietaryRestrictions: '',
    allergies: '',
    medications: '',
    favoriteActivities: '',
    comfortItems: '',
    routines: '',
    specialNeeds: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    doctorName: '',
    doctorPhone: '',
    doctorClinic: '',
    additionalNotes: '',
  });

  const handleAddChild = () => {
    setEditingChild(null);
    setChildForm({ name: '', age: '', dateOfBirth: null, gender: '', photoUrl: '' });
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
    setShowChildModal(true);
  };

  const handlePickChildImage = async () => {
    try {
      console.log('📸 Starting image picker...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload photos');
        return;
      }

      console.log('✅ Permission granted, launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        console.log('❌ User canceled image picker');
        return;
      }

      if (!result.assets || !result.assets[0] || !user) {
        console.log('❌ No asset selected or user not logged in');
        Alert.alert('Error', 'Please select an image and ensure you are logged in');
        return;
      }

      const asset = result.assets[0];
      console.log('📤 Selected image:', asset.uri);
      setUploadingChildImage(true);
      
      try {
        const imagePath = `childImages/${user.id}/${editingChild?.id || 'new'}_${Date.now()}.jpg`;
        console.log('☁️ Uploading to Supabase Storage:', imagePath);
        
        let fileData: Blob | Uint8Array | ArrayBuffer;
        
        // On web, convert to blob. On native, fetch and convert to Uint8Array
        if (Platform.OS === 'web') {
          console.log('🔄 Converting image to blob (web)...');
          const response = await fetch(asset.uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          fileData = await response.blob();
          console.log('✅ Blob created, size:', (fileData as Blob).size);
        } else {
          // Native: Fetch the file and convert to Uint8Array
          console.log('🔄 Reading file for native upload...');
          try {
            const response = await fetch(asset.uri);
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.statusText}`);
            }
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            fileData = new Uint8Array(arrayBuffer);
            console.log('✅ File converted to Uint8Array, size:', fileData.length);
          } catch (fetchError: any) {
            console.error('❌ Failed to read file:', fetchError);
            throw new Error(`Failed to read image file: ${fetchError.message}`);
          }
        }
        
        const uploadResult = await uploadFile(imagePath, fileData, 'image/jpeg', {
          maxSize: 5 * 1024 * 1024,
        });

        if (uploadResult.success && uploadResult.data) {
          console.log('✅ Upload successful, URL:', uploadResult.data);
          setChildForm({ ...childForm, photoUrl: uploadResult.data });
          Alert.alert('Success', 'Profile picture uploaded successfully!');
        } else {
          console.error('❌ Upload failed:', uploadResult.error);
          Alert.alert('Upload Failed', uploadResult.error?.message || 'Failed to upload image. Please try again.');
        }
      } catch (uploadError: any) {
        console.error('❌ Upload error:', uploadError);
        Alert.alert('Upload Error', uploadError.message || 'Failed to upload image. Please check your connection and try again.');
      } finally {
        setUploadingChildImage(false);
      }
    } catch (error: any) {
      console.error('❌ Image picker error:', error);
      setUploadingChildImage(false);
      Alert.alert('Error', error.message || 'Failed to pick image. Please try again.');
    }
  };

  const handleSaveChild = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to add children');
      return;
    }

    if (!childForm.name.trim() || !childForm.age.trim()) {
      Alert.alert('Error', 'Please fill in name and age');
      return;
    }

    setLoading(true);
    try {
      const childData: Child = {
        id: editingChild?.id || '',
        parentId: user.id, // Use actual user ID
        name: childForm.name.trim(),
        age: parseInt(childForm.age) || 0,
        dateOfBirth: childForm.dateOfBirth || undefined,
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
        setChildForm({ name: '', age: '', dateOfBirth: null, gender: '', photoUrl: '' });
        // Reload children to get updated list
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

  const handleDeleteChild = async (childId: string, childName?: string) => {
    Alert.alert(
      'Delete Child',
      `Are you sure you want to delete ${childName || 'this child'}? This action cannot be undone.`,
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
              const newInstructions = { ...instructions };
              delete newInstructions[childId];
              setInstructions(newInstructions);
              
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
                console.error('❌ Delete failed:', result.error);
                Alert.alert('Error', result.error?.message || 'Failed to delete child. Please try again.');
              }
            } catch (error: any) {
              // If error, reload to restore state
              await loadChildren();
              console.error('❌ Delete error:', error);
              Alert.alert('Error', error.message || 'Failed to delete child. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEditInstructions = (child: Child) => {
    setSelectedChild(child);
    const existing = instructions[child.id];
    if (existing) {
      setInstructionsForm({
        feedingSchedule: existing.feedingSchedule || '',
        napSchedule: existing.napSchedule || '',
        bedtime: existing.bedtime || '',
        dietaryRestrictions: existing.dietaryRestrictions || '',
        allergies: existing.allergies?.join(', ') || '',
        medications: existing.medications?.map(m => `${m.name} - ${m.dosage} at ${m.time}`).join('\n') || '',
        favoriteActivities: existing.favoriteActivities?.join(', ') || '',
        comfortItems: existing.comfortItems?.join(', ') || '',
        routines: existing.routines || '',
        specialNeeds: existing.specialNeeds || '',
        emergencyContactName: existing.emergencyContacts?.[0]?.name || '',
        emergencyContactPhone: existing.emergencyContacts?.[0]?.phone || '',
        emergencyContactRelation: existing.emergencyContacts?.[0]?.relationship || '',
        doctorName: existing.doctorInfo?.name || '',
        doctorPhone: existing.doctorInfo?.phone || '',
        doctorClinic: existing.doctorInfo?.clinic || '',
        additionalNotes: existing.additionalNotes || '',
      });
    } else {
      setInstructionsForm({
        feedingSchedule: '',
        napSchedule: '',
        bedtime: '',
        dietaryRestrictions: '',
        allergies: '',
        medications: '',
        favoriteActivities: '',
        comfortItems: '',
        routines: '',
        specialNeeds: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        doctorName: '',
        doctorPhone: '',
        doctorClinic: '',
        additionalNotes: '',
      });
    }
    setShowInstructionsModal(true);
  };

  const handleSaveInstructions = async () => {
    if (!selectedChild || !user) {
      Alert.alert('Error', 'Please select a child and ensure you are logged in');
      return;
    }

    setLoading(true);
    try {
      const instructionsData: ChildInstructions = {
        id: instructions[selectedChild.id]?.id || '',
        childId: selectedChild.id,
        parentId: user.id, // Use actual user ID
        feedingSchedule: instructionsForm.feedingSchedule || undefined,
        napSchedule: instructionsForm.napSchedule || undefined,
        bedtime: instructionsForm.bedtime || undefined,
        dietaryRestrictions: instructionsForm.dietaryRestrictions || undefined,
        allergies: instructionsForm.allergies
          ? instructionsForm.allergies.split(',').map(a => a.trim()).filter(Boolean)
          : undefined,
        medications: instructionsForm.medications
          ? instructionsForm.medications.split('\n').map(m => {
              const parts = m.split(' - ');
              const timeParts = parts[1]?.split(' at ') || [];
              return {
                name: parts[0] || '',
                dosage: timeParts[0] || '',
                time: timeParts[1] || '',
              };
            }).filter(m => m.name)
          : undefined,
        favoriteActivities: instructionsForm.favoriteActivities
          ? instructionsForm.favoriteActivities.split(',').map(a => a.trim()).filter(Boolean)
          : undefined,
        comfortItems: instructionsForm.comfortItems
          ? instructionsForm.comfortItems.split(',').map(i => i.trim()).filter(Boolean)
          : undefined,
        routines: instructionsForm.routines || undefined,
        specialNeeds: instructionsForm.specialNeeds || undefined,
        emergencyContacts: instructionsForm.emergencyContactName
          ? [{
              name: instructionsForm.emergencyContactName,
              phone: instructionsForm.emergencyContactPhone,
              relationship: instructionsForm.emergencyContactRelation,
            }]
          : undefined,
        doctorInfo: instructionsForm.doctorName
          ? {
              name: instructionsForm.doctorName,
              phone: instructionsForm.doctorPhone,
              clinic: instructionsForm.doctorClinic || undefined,
            }
          : undefined,
        additionalNotes: instructionsForm.additionalNotes || undefined,
        createdAt: instructions[selectedChild.id]?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      const result = await saveChildInstructions(instructionsData);
      
      if (result.success && result.data) {
        setInstructions({
          ...instructions,
          [selectedChild.id]: result.data,
        });
        setShowInstructionsModal(false);
        setSelectedChild(null);
        Alert.alert('Success', 'Instructions saved successfully!');
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to save instructions');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save instructions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Child Profiles & Instructions" showBack={true} />
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadChildren}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Children</Text>
          <TouchableOpacity
            onPress={handleAddChild}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add Child</Text>
          </TouchableOpacity>
        </View>

        {children.length === 0 ? (
          <Card>
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No children added yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Add a child profile to get started
              </Text>
            </View>
          </Card>
        ) : (
          children.map((child) => {
            const childInstructions = instructions[child.id];
            return (
              <Card key={child.id}>
                <View style={styles.childCard}>
                  <View style={styles.childHeader}>
                    {child.photoUrl ? (
                      <Image source={{ uri: child.photoUrl }} style={styles.childCardPhoto} />
                    ) : (
                      <View style={[styles.childCardPhotoPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                        <Ionicons name="person" size={24} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.childInfo}>
                      <Text style={[styles.childName, { color: colors.text }]}>
                        {child.name}
                      </Text>
                      <Text style={[styles.childAge, { color: colors.textSecondary }]}>
                        {child.age} years old
                        {child.gender && ` • ${child.gender}`}
                      </Text>
                    </View>
                    <View style={styles.childActions}>
                      <TouchableOpacity
                        onPress={() => handleEditChild(child)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="pencil" size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteChild(child.id, child.name)}
                        style={styles.iconButton}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <Ionicons name="trash" size={20} color={colors.error} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.instructionsSection}>
                    {childInstructions ? (
                      <View style={styles.instructionsPreview}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <Text style={[styles.instructionsStatus, { color: colors.success }]}>
                          Instructions added
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.instructionsPreview}>
                        <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
                        <Text style={[styles.instructionsStatus, { color: colors.textSecondary }]}>
                          No instructions yet
                        </Text>
                      </View>
                    )}
                    <Button
                      title={childInstructions ? 'Edit Instructions' : 'Add Instructions'}
                      onPress={() => handleEditInstructions(child)}
                      variant="primary"
                      style={styles.instructionsButton}
                    />
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Child Modal */}
      <Modal
        visible={showChildModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingChild ? 'Edit Child' : 'Add Child'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowChildModal(false);
                setEditingChild(null);
              }}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Profile Picture */}
            <View style={styles.photoSection}>
              <Text style={[styles.photoLabel, { color: colors.text }]}>Profile Picture</Text>
              <View style={styles.photoContainer}>
                {uploadingChildImage ? (
                  <View style={[styles.childPhoto, styles.uploadingOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                ) : childForm.photoUrl ? (
                  <>
                    <Image source={{ uri: childForm.photoUrl }} style={styles.childPhoto} />
                    <TouchableOpacity
                      onPress={handlePickChildImage}
                      activeOpacity={0.8}
                      style={[styles.photoOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    >
                      <Ionicons name="camera" size={24} color="#fff" />
                      <Text style={styles.photoOverlayText}>Change Photo</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={handlePickChildImage}
                    activeOpacity={0.8}
                    style={styles.photoPlaceholderContainer}
                  >
                    <View style={[styles.photoPlaceholder, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                      <Ionicons name="person" size={40} color={colors.primary} />
                      <Text style={[styles.photoPlaceholderText, { color: colors.primary }]}>Add Photo</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
              {childForm.photoUrl && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Remove Photo',
                      'Are you sure you want to remove this photo?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => setChildForm({ ...childForm, photoUrl: '' }),
                        },
                      ]
                    );
                  }}
                  style={styles.removePhotoButton}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={[styles.removePhotoText, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <Input
              label="Child's Name *"
              value={childForm.name}
              onChangeText={(text) => setChildForm({ ...childForm, name: text })}
              placeholder="Enter child's name"
            />
            <Input
              label="Age *"
              value={childForm.age}
              onChangeText={(text) => setChildForm({ ...childForm, age: text })}
              placeholder="Enter age"
              keyboardType="number-pad"
            />
            
            {/* Date Picker */}
            <View style={styles.datePickerContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Date of Birth</Text>
              {Platform.OS === 'web' ? (
                // Web: Use HTML input wrapped in View
                <View style={[styles.datePickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="calendar" size={22} color={colors.primary} style={styles.datePickerIcon} />
                  <View style={{ flex: 1 }}>
                    {/* @ts-ignore - Web-specific input */}
                    <input
                      type="date"
                      value={childForm.dateOfBirth ? childForm.dateOfBirth.toISOString().split('T')[0] : ''}
                      onChange={(e: any) => {
                        if (e.target.value) {
                          const date = new Date(e.target.value);
                          if (!isNaN(date.getTime())) {
                            setChildForm({ ...childForm, dateOfBirth: date });
                          }
                        }
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
                // Native: Use DateTimePicker
                <>
                  <TouchableOpacity
                    onPress={() => {
                      console.log('📅 Opening date picker...');
                      setShowDatePicker(true);
                    }}
                    activeOpacity={0.7}
                    style={[styles.datePickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <Ionicons name="calendar" size={22} color={colors.primary} style={styles.datePickerIcon} />
                    <Text style={[styles.datePickerText, { color: childForm.dateOfBirth ? colors.text : colors.textSecondary }]}>
                      {childForm.dateOfBirth
                        ? childForm.dateOfBirth.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : 'Tap to select date of birth'}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={childForm.dateOfBirth || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => {
                        console.log('📅 Date picker event:', event.type, selectedDate);
                        if (Platform.OS === 'android') {
                          setShowDatePicker(false);
                        }
                        if (event.type === 'set' && selectedDate) {
                          setChildForm({ ...childForm, dateOfBirth: selectedDate });
                          if (Platform.OS === 'ios') {
                            setShowDatePicker(false);
                          }
                        } else if (event.type === 'dismissed') {
                          setShowDatePicker(false);
                        }
                      }}
                      maximumDate={new Date()}
                      minimumDate={new Date(1900, 0, 1)}
                    />
                  )}
                </>
              )}
            </View>
            <View style={styles.genderContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Gender</Text>
              <View style={styles.genderOptions}>
                {(['male', 'female', 'other'] as const).map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    onPress={() => setChildForm({ ...childForm, gender })}
                    style={[
                      styles.genderOption,
                      {
                        backgroundColor:
                          childForm.gender === gender ? colors.primary : colors.white,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.genderText,
                        {
                          color: childForm.gender === gender ? '#fff' : colors.text,
                        },
                      ]}
                    >
                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Button
              title="Save"
              onPress={handleSaveChild}
              variant="primary"
              style={styles.saveButton}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Instructions Modal */}
      <Modal
        visible={showInstructionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Care Instructions - {selectedChild?.name}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowInstructionsModal(false);
                setSelectedChild(null);
              }}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.sectionHeader, { color: colors.text }]}>Daily Schedule</Text>
            <Input
              label="Feeding Schedule"
              value={instructionsForm.feedingSchedule}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, feedingSchedule: text })
              }
              placeholder="e.g., Every 3 hours, 8am, 12pm, 4pm, 8pm"
              multiline
            />
            <Input
              label="Nap Schedule"
              value={instructionsForm.napSchedule}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, napSchedule: text })
              }
              placeholder="e.g., 1pm-3pm daily"
            />
            <Input
              label="Bedtime"
              value={instructionsForm.bedtime}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, bedtime: text })
              }
              placeholder="e.g., 8:00 PM"
            />

            <Text style={[styles.sectionHeader, { color: colors.text }]}>Health & Safety</Text>
            <Input
              label="Dietary Restrictions"
              value={instructionsForm.dietaryRestrictions}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, dietaryRestrictions: text })
              }
              placeholder="e.g., No nuts, vegetarian"
              multiline
            />
            <Input
              label="Allergies (comma separated)"
              value={instructionsForm.allergies}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, allergies: text })
              }
              placeholder="e.g., Peanuts, Dairy, Eggs"
            />
            <Input
              label="Medications"
              value={instructionsForm.medications}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, medications: text })
              }
              placeholder="Format: Medication Name - Dosage at Time&#10;e.g., Tylenol - 5ml at 2pm"
              multiline
            />
            <Input
              label="Special Needs"
              value={instructionsForm.specialNeeds}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, specialNeeds: text })
              }
              placeholder="Any special care requirements"
              multiline
            />

            <Text style={[styles.sectionHeader, { color: colors.text }]}>Preferences</Text>
            <Input
              label="Favorite Activities (comma separated)"
              value={instructionsForm.favoriteActivities}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, favoriteActivities: text })
              }
              placeholder="e.g., Reading, Puzzles, Outdoor play"
            />
            <Input
              label="Comfort Items (comma separated)"
              value={instructionsForm.comfortItems}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, comfortItems: text })
              }
              placeholder="e.g., Blanket, Stuffed bear"
            />
            <Input
              label="Routines"
              value={instructionsForm.routines}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, routines: text })
              }
              placeholder="Daily routines and rituals"
              multiline
            />

            <Text style={[styles.sectionHeader, { color: colors.text }]}>Emergency Contacts</Text>
            <Input
              label="Contact Name"
              value={instructionsForm.emergencyContactName}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, emergencyContactName: text })
              }
              placeholder="Emergency contact name"
            />
            <Input
              label="Relationship"
              value={instructionsForm.emergencyContactRelation}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, emergencyContactRelation: text })
              }
              placeholder="e.g., Mother, Father, Grandparent"
            />
            <Input
              label="Phone Number"
              value={instructionsForm.emergencyContactPhone}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, emergencyContactPhone: text })
              }
              placeholder="Phone number"
              keyboardType="phone-pad"
            />

            <Text style={[styles.sectionHeader, { color: colors.text }]}>Doctor Information</Text>
            <Input
              label="Doctor Name"
              value={instructionsForm.doctorName}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, doctorName: text })
              }
              placeholder="Doctor's name"
            />
            <Input
              label="Phone Number"
              value={instructionsForm.doctorPhone}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, doctorPhone: text })
              }
              placeholder="Doctor's phone"
              keyboardType="phone-pad"
            />
            <Input
              label="Clinic/Hospital"
              value={instructionsForm.doctorClinic}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, doctorClinic: text })
              }
              placeholder="Clinic or hospital name"
            />

            <Text style={[styles.sectionHeader, { color: colors.text }]}>Additional Notes</Text>
            <Input
              label="Additional Notes"
              value={instructionsForm.additionalNotes}
              onChangeText={(text) =>
                setInstructionsForm({ ...instructionsForm, additionalNotes: text })
              }
              placeholder="Any other important information"
              multiline
              numberOfLines={4}
            />

            <Button
              title="Save Instructions"
              onPress={handleSaveInstructions}
              variant="primary"
              style={styles.saveButton}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  childCard: {
    gap: 16,
  },
  childHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  childCardPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  childCardPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  childAge: {
    fontSize: 14,
  },
  childActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  instructionsSection: {
    marginTop: 8,
    gap: 8,
  },
  instructionsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  instructionsStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  instructionsButton: {
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    paddingTop: 52,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  genderContainer: {
    marginBottom: 16,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  genderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  saveButton: {
    marginTop: 24,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  photoContainer: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  childPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
  },
  photoPlaceholderContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  uploadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  uploadingText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  removePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  removePhotoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  datePickerIcon: {
    marginRight: 12,
  },
  datePickerText: {
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
});
