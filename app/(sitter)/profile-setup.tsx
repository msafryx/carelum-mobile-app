import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
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
import { createVerificationRequest } from '@/src/services/verification.service';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

interface Certification {
  id: string;
  name: string;
  fileUri: string | null;
  uploadedUrl: string | null;
  issuedDate: Date | null;
  expiryDate: Date | null;
}

export default function ProfileSetupScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Profile Information
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Sri Lanka');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  // Verification Documents
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null);
  const [backgroundCheckUri, setBackgroundCheckUri] = useState<string | null>(null);
  const [backgroundCheckUrl, setBackgroundCheckUrl] = useState<string | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [qualifications, setQualifications] = useState('');
  const [qualificationDocumentUri, setQualificationDocumentUri] = useState<string | null>(null);
  const [qualificationDocumentUrl, setQualificationDocumentUrl] = useState<string | null>(null);

  // Date pickers
  const [showCertDatePicker, setShowCertDatePicker] = useState<string | null>(null);
  const [certDateType, setCertDateType] = useState<'issued' | 'expiry' | null>(null);

  const [isSaved, setIsSaved] = useState(false);
  const [hasVerificationRequest, setHasVerificationRequest] = useState(false);

  // Load existing profile data
  useEffect(() => {
    if (userProfile) {
      setBio(userProfile.bio || '');
      setHourlyRate(userProfile.hourlyRate?.toString() || '');
      setPhoneNumber(userProfile.phoneNumber || '');
      setAddress(userProfile.address || '');
      setCity(userProfile.city || '');
      setCountry(userProfile.country || 'Sri Lanka');
      setProfileImageUrl(userProfile.profileImageUrl || null);
    }
  }, [userProfile]);

  const handlePickImage = async (type: 'profile' | 'id' | 'background' | 'qualification') => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload files.');
        return;
      }

      // For profile, allow cropping. For documents (id/background), no cropping to allow full documents
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: type === 'profile', // Only crop profile images
        aspect: type === 'profile' ? [1, 1] : undefined, // No aspect ratio for documents
        quality: type === 'profile' ? 0.8 : 1.0, // Higher quality for documents
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (type === 'profile') {
          setProfileImageUri(uri);
        } else if (type === 'id') {
          setIdDocumentUri(uri);
        } else if (type === 'background') {
          setBackgroundCheckUri(uri);
        } else if (type === 'qualification') {
          setQualificationDocumentUri(uri);
        }
      }
    } catch (error: any) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const handlePickCertificationFile = async (certId: string) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload documents.');
        return;
      }

      // No cropping for certification documents - allow full document images
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // No cropping for documents
        quality: 1.0, // Full quality for documents
      });

      if (!result.canceled && result.assets[0]) {
        setCertifications(prev =>
          prev.map(cert =>
            cert.id === certId ? { ...cert, fileUri: result.assets[0].uri } : cert
          )
        );
      }
    } catch (error: any) {
      console.error('Error picking certification file:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const uploadImage = async (uri: string, path: string): Promise<string | null> => {
    try {
      setUploading(path);
      
      // Convert URI to Blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Upload to storage
      const result = await uploadFile(path, blob, 'image/jpeg', {
        maxSize: 10 * 1024 * 1024, // 10MB for documents
      });
      
      if (result.success && result.data) {
        return result.data;
      } else {
        throw new Error(result.error?.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error(`Failed to upload ${path}:`, error);
      throw error;
    } finally {
      setUploading(null);
    }
  };

  const handleAddCertification = () => {
    setCertifications([
      ...certifications,
      {
        id: Date.now().toString(),
        name: '',
        fileUri: null,
        uploadedUrl: null,
        issuedDate: null,
        expiryDate: null,
      },
    ]);
  };

  const handleRemoveCertification = (certId: string) => {
    setCertifications(prev => prev.filter(cert => cert.id !== certId));
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save your profile.');
      return;
    }

    // Validation
    if (!bio.trim()) {
      Alert.alert('Required Field', 'Please enter your bio.');
      return;
    }

    if (!hourlyRate || parseFloat(hourlyRate) <= 0) {
      Alert.alert('Required Field', 'Please enter a valid hourly rate.');
      return;
    }

    if (!idDocumentUri && !idDocumentUrl) {
      Alert.alert('Required Document', 'Please upload an ID document (passport or ID card).');
      return;
    }

    setSaving(true);

    try {
      // 1. Upload profile image if changed
      let finalProfileImageUrl = profileImageUrl;
      if (profileImageUri) {
        const profilePath = `profileImages/${user.id}/profile_${Date.now()}.jpg`;
        try {
          finalProfileImageUrl = await uploadImage(profileImageUri, profilePath);
          if (!finalProfileImageUrl) {
            throw new Error('Failed to upload profile image');
          }
        } catch (error: any) {
          console.warn('Failed to upload profile image, continuing with existing:', error);
          // Don't fail the whole operation if profile image upload fails
        }
      }

      // 2. Upload ID document if changed
      let finalIdDocumentUrl = idDocumentUrl;
      if (idDocumentUri) {
        const idPath = `verificationDocuments/${user.id}/id_document_${Date.now()}.jpg`;
        finalIdDocumentUrl = await uploadImage(idDocumentUri, idPath);
        if (!finalIdDocumentUrl) {
          throw new Error('Failed to upload ID document');
        }
      }

      // 3. Upload background check if provided
      let finalBackgroundCheckUrl = backgroundCheckUrl;
      if (backgroundCheckUri) {
        const bgPath = `verificationDocuments/${user.id}/background_check_${Date.now()}.jpg`;
        finalBackgroundCheckUrl = await uploadImage(backgroundCheckUri, bgPath);
        // Background check is optional, so don't fail if upload fails
        if (!finalBackgroundCheckUrl) {
          console.warn('Failed to upload background check, continuing...');
        }
      }

      // 4. Upload qualification document if provided
      let finalQualificationDocumentUrl = qualificationDocumentUrl;
      if (qualificationDocumentUri) {
        try {
          const qualPath = `verificationDocuments/${user.id}/qualification_${Date.now()}.jpg`;
          finalQualificationDocumentUrl = await uploadImage(qualificationDocumentUri, qualPath);
          if (!finalQualificationDocumentUrl) {
            console.warn('Failed to upload qualification document, continuing...');
          }
        } catch (error: any) {
          console.warn('Failed to upload qualification document:', error);
          // Don't fail the whole operation
        }
      }

      // 5. Upload certifications
      const uploadedCertifications = [];
      for (const cert of certifications) {
        if (cert.name && cert.fileUri) {
          try {
            const certPath = `verificationDocuments/${user.id}/cert_${cert.id}_${Date.now()}.jpg`;
            const certUrl = await uploadImage(cert.fileUri, certPath);
            if (certUrl) {
              uploadedCertifications.push({
                name: cert.name,
                url: certUrl,
                issuedDate: cert.issuedDate || new Date(),
                expiryDate: cert.expiryDate || undefined,
              });
            }
          } catch (error: any) {
            console.warn(`Failed to upload certification ${cert.name}:`, error);
            // Continue with other certifications
          }
        }
      }

      // 6. Update user profile
      const profileUpdate = await updateUserProfile({
        bio: bio.trim(),
        hourlyRate: parseFloat(hourlyRate),
        phoneNumber: phoneNumber.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        profileImageUrl: finalProfileImageUrl || null,
      });

      if (!profileUpdate.success) {
        throw new Error(profileUpdate.error?.message || 'Failed to update profile');
      }

      // 7. Create verification request
      const verificationResult = await createVerificationRequest({
        sitterId: user.id,
        fullName: userProfile?.displayName || user.email,
        idDocumentUrl: finalIdDocumentUrl || undefined,
        backgroundCheckUrl: finalBackgroundCheckUrl || undefined,
        qualificationDocumentUrl: finalQualificationDocumentUrl || undefined,
        certifications: uploadedCertifications.length > 0 ? uploadedCertifications : undefined,
        bio: bio.trim(),
        qualifications: qualifications.trim() ? [qualifications.trim()] : undefined,
        hourlyRate: parseFloat(hourlyRate),
      });

      if (!verificationResult.success) {
        console.warn('Failed to create verification request:', verificationResult.error);
        // Don't fail the whole operation - profile is saved
        Alert.alert(
          'Profile Saved',
          'Your profile has been saved, but verification request creation failed. You can try again later.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      Alert.alert(
        'Profile Setup Complete',
        'Your profile has been saved and verification request submitted. An admin will review your documents.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        showLogo={true}
        title={isSaved ? "Profile Saved" : "Profile Setup"}
        showBack={true}
        rightComponent={
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={30} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isSaved && (
          <Card style={styles.savedBanner}>
            <View style={[styles.savedBannerContent, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success || '#10b981'} />
              <View style={styles.savedBannerText}>
                <Text style={[styles.savedBannerTitle, { color: colors.text }]}>Profile Saved!</Text>
                <Text style={[styles.savedBannerSubtitle, { color: colors.textSecondary }]}>
                  Your verification request has been submitted. An admin will review your documents.
                </Text>
              </View>
            </View>
          </Card>
        )}
        {/* Profile Information Section */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Information</Text>

          {/* Profile Picture */}
          <Text style={[styles.label, { color: colors.text }]}>Profile Picture</Text>
          <TouchableOpacity
            style={styles.imagePicker}
            onPress={() => handlePickImage('profile')}
            disabled={uploading === 'profile'}
          >
            {uploading === 'profile' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : profileImageUri || profileImageUrl ? (
              <Image
                source={{ uri: profileImageUri || profileImageUrl || '' }}
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.border }]}>
                <Ionicons name="camera" size={40} color={colors.textSecondary} />
                <Text style={[styles.imagePlaceholderText, { color: colors.textSecondary }]}>
                  Add Photo
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Bio */}
          <Text style={[styles.label, { color: colors.text }]}>Bio *</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.white, color: colors.text }]}
            placeholder="Tell parents about yourself, your experience, and why you love babysitting..."
            placeholderTextColor={colors.textSecondary}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
          />

          {/* Hourly Rate */}
          <Text style={[styles.label, { color: colors.text }]}>Hourly Rate (LKR) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
            placeholder="e.g., 1500"
            placeholderTextColor={colors.textSecondary}
            value={hourlyRate}
            onChangeText={setHourlyRate}
            keyboardType="number-pad"
          />

          {/* Contact Information */}
          <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
            placeholder="+94 77 123 4567"
            placeholderTextColor={colors.textSecondary}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />

          <Text style={[styles.label, { color: colors.text }]}>Address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
            placeholder="Street address"
            placeholderTextColor={colors.textSecondary}
            value={address}
            onChangeText={setAddress}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={[styles.label, { color: colors.text }]}>City</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
                placeholder="City"
                placeholderTextColor={colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={[styles.label, { color: colors.text }]}>Country</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
                placeholder="Country"
                placeholderTextColor={colors.textSecondary}
                value={country}
                onChangeText={setCountry}
              />
            </View>
          </View>
        </Card>

        {/* Verification Documents Section */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Verification Documents</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Upload required documents for verification
          </Text>

          {/* ID Document */}
          <Text style={[styles.label, { color: colors.text }]}>ID Document (Passport/ID Card) *</Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Upload a clear photo or scanned copy of your ID document (no cropping)
          </Text>
          <TouchableOpacity
            style={[styles.documentButton, { borderColor: colors.border }]}
            onPress={() => handlePickImage('id')}
            disabled={uploading === 'id'}
          >
            {uploading === 'id' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : idDocumentUri || idDocumentUrl ? (
              <View style={styles.documentPreview}>
                <Ionicons name="document-text" size={24} color={colors.success || '#10b981'} />
                <Text style={[styles.documentText, { color: colors.text }]}>ID Document Uploaded</Text>
                {(idDocumentUri || idDocumentUrl) && (
                  <Text style={[styles.documentSubtext, { color: colors.textSecondary }]}>
                    Tap to change
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.documentPreview}>
                <Ionicons name="document-outline" size={24} color={colors.textSecondary} />
                <Text style={[styles.documentText, { color: colors.textSecondary }]}>
                  Tap to upload ID document
                </Text>
                <Text style={[styles.documentSubtext, { color: colors.textSecondary }]}>
                  Image or scanned document
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Background Check */}
          <Text style={[styles.label, { color: colors.text }]}>Background Check (Optional)</Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Upload a clear photo or scanned copy of your background check document
          </Text>
          <TouchableOpacity
            style={[styles.documentButton, { borderColor: colors.border }]}
            onPress={() => handlePickImage('background')}
            disabled={uploading === 'background'}
          >
            {uploading === 'background' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : backgroundCheckUri || backgroundCheckUrl ? (
              <View style={styles.documentPreview}>
                <Ionicons name="document-text" size={24} color={colors.success || '#10b981'} />
                <Text style={[styles.documentText, { color: colors.text }]}>Background Check Uploaded</Text>
                <Text style={[styles.documentSubtext, { color: colors.textSecondary }]}>
                  Tap to change
                </Text>
              </View>
            ) : (
              <View style={styles.documentPreview}>
                <Ionicons name="document-outline" size={24} color={colors.textSecondary} />
                <Text style={[styles.documentText, { color: colors.textSecondary }]}>
                  Tap to upload background check
                </Text>
                <Text style={[styles.documentSubtext, { color: colors.textSecondary }]}>
                  Image or scanned document
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Qualifications & Experience */}
          <Text style={[styles.label, { color: colors.text }]}>Qualifications & Experience</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.white, color: colors.text }]}
            placeholder="e.g., CPR Certified, First Aid, 5 years experience with infants..."
            placeholderTextColor={colors.textSecondary}
            value={qualifications}
            onChangeText={setQualifications}
            multiline
            numberOfLines={3}
          />

          {/* Qualification Document Upload */}
          <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>Qualification Document (Optional)</Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Upload a document showing your qualifications (e.g., degree, diploma, training certificate)
          </Text>
          <TouchableOpacity
            style={[styles.documentButton, { borderColor: colors.border }]}
            onPress={() => handlePickImage('qualification')}
            disabled={uploading === 'qualification'}
          >
            {uploading === 'qualification' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : qualificationDocumentUri || qualificationDocumentUrl ? (
              <View style={styles.documentPreview}>
                <Ionicons name="document-text" size={20} color={colors.success || '#10b981'} />
                <Text style={[styles.documentText, { color: colors.text }]}>Qualification Document Uploaded</Text>
                <Text style={[styles.documentSubtext, { color: colors.textSecondary }]}>
                  Tap to change
                </Text>
              </View>
            ) : (
              <View style={styles.documentPreview}>
                <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.documentText, { color: colors.textSecondary }]}>
                  Tap to upload qualification document
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Certifications & Qualifications */}
          <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Certifications & Qualifications (Optional)</Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Add specific certifications with documents (e.g., CPR, First Aid, Childcare)
          </Text>
          {certifications.map((cert) => (
            <Card key={cert.id} style={styles.certCard}>
              <View style={styles.certHeader}>
                <TextInput
                  style={[styles.certNameInput, { backgroundColor: colors.white, color: colors.text }]}
                  placeholder="Certification name (e.g., CPR, First Aid)"
                  placeholderTextColor={colors.textSecondary}
                  value={cert.name}
                  onChangeText={(text) =>
                    setCertifications(prev =>
                      prev.map(c => c.id === cert.id ? { ...c, name: text } : c)
                    )
                  }
                />
                <TouchableOpacity
                  onPress={() => handleRemoveCertification(cert.id)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color={colors.error || '#ef4444'} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.documentButton, { borderColor: colors.border, marginTop: 8 }]}
                onPress={() => handlePickCertificationFile(cert.id)}
              >
                {cert.fileUri ? (
                  <View style={styles.documentPreview}>
                    <Ionicons name="document-text" size={20} color={colors.success || '#10b981'} />
                    <Text style={[styles.documentText, { color: colors.text }]}>File Selected</Text>
                  </View>
                ) : (
                  <View style={styles.documentPreview}>
                    <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.documentText, { color: colors.textSecondary }]}>
                      Upload certificate
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.certDates}>
                <TouchableOpacity
                  style={[styles.dateButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowCertDatePicker(cert.id);
                    setCertDateType('issued');
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {cert.issuedDate ? format(cert.issuedDate, 'MMM dd, yyyy') : 'Issued Date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowCertDatePicker(cert.id);
                    setCertDateType('expiry');
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {cert.expiryDate ? format(cert.expiryDate, 'MMM dd, yyyy') : 'Expiry Date (Optional)'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showCertDatePicker === cert.id && certDateType && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={certDateType === 'issued' 
                    ? (cert.issuedDate || new Date())
                    : (cert.expiryDate || new Date())
                  }
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowCertDatePicker(null);
                    if (date && event.type !== 'dismissed') {
                      setCertifications(prev =>
                        prev.map(c =>
                          c.id === cert.id
                            ? {
                                ...c,
                                [certDateType === 'issued' ? 'issuedDate' : 'expiryDate']: date,
                              }
                            : c
                        )
                      );
                    }
                    setCertDateType(null);
                  }}
                />
              )}
            </Card>
          ))}

          <TouchableOpacity
            style={[styles.addButton, { borderColor: colors.primary }]}
            onPress={handleAddCertification}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Certification</Text>
          </TouchableOpacity>
        </Card>

        {/* Save Button */}
        {isSaved ? (
          <View style={styles.savedContainer}>
            <View style={[styles.savedMessage, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success || '#10b981'} />
              <Text style={[styles.savedText, { color: colors.text }]}>
                Profile saved and verification request submitted!
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: colors.primary }]}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Edit & Resubmit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Profile & Submit for Verification</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <SitterHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  imagePicker: {
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 12,
  },
  documentButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentText: {
    fontSize: 14,
  },
  certCard: {
    marginBottom: 12,
    padding: 12,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  certNameInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  removeButton: {
    padding: 4,
  },
  certDates: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  documentSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  savedContainer: {
    marginTop: 24,
    marginBottom: 20,
  },
  savedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  savedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  savedBanner: {
    marginBottom: 16,
  },
  savedBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  savedBannerText: {
    flex: 1,
  },
  savedBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  savedBannerSubtitle: {
    fontSize: 14,
  },
});
