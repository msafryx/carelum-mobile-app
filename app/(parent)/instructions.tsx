import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { Child, ChildInstructions } from '@/src/types/child.types';

export default function InstructionsScreen() {
  const { colors, spacing } = useTheme();
  const [children, setChildren] = useState<Child[]>([]);
  const [instructions, setInstructions] = useState<Record<string, ChildInstructions>>({});
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showChildModal, setShowChildModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  
  // Child form state
  const [childForm, setChildForm] = useState({
    name: '',
    age: '',
    dateOfBirth: '',
    gender: '' as 'male' | 'female' | 'other' | '',
  });

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
    setChildForm({ name: '', age: '', dateOfBirth: '', gender: '' });
    setShowChildModal(true);
  };

  const handleEditChild = (child: Child) => {
    setEditingChild(child);
    setChildForm({
      name: child.name,
      age: child.age.toString(),
      dateOfBirth: child.dateOfBirth?.toISOString().split('T')[0] || '',
      gender: child.gender || '',
    });
    setShowChildModal(true);
  };

  const handleSaveChild = () => {
    if (!childForm.name.trim() || !childForm.age.trim()) {
      Alert.alert('Error', 'Please fill in name and age');
      return;
    }

    const childData: Child = {
      id: editingChild?.id || `child_${Date.now()}`,
      parentId: 'current_user_id', // TODO: Get from auth
      name: childForm.name.trim(),
      age: parseInt(childForm.age) || 0,
      dateOfBirth: childForm.dateOfBirth ? new Date(childForm.dateOfBirth) : undefined,
      gender: childForm.gender || undefined,
      createdAt: editingChild?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (editingChild) {
      setChildren(children.map(c => c.id === editingChild.id ? childData : c));
    } else {
      setChildren([...children, childData]);
    }

    setShowChildModal(false);
    setEditingChild(null);
  };

  const handleDeleteChild = (childId: string) => {
    Alert.alert(
      'Delete Child',
      'Are you sure you want to delete this child profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setChildren(children.filter(c => c.id !== childId));
            const newInstructions = { ...instructions };
            delete newInstructions[childId];
            setInstructions(newInstructions);
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

  const handleSaveInstructions = () => {
    if (!selectedChild) return;

    const instructionsData: ChildInstructions = {
      id: instructions[selectedChild.id]?.id || `instructions_${Date.now()}`,
      childId: selectedChild.id,
      parentId: 'current_user_id', // TODO: Get from auth
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

    setInstructions({
      ...instructions,
      [selectedChild.id]: instructionsData,
    });
    setShowInstructionsModal(false);
    setSelectedChild(null);
    Alert.alert('Success', 'Instructions saved successfully');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Child Profiles & Instructions" showBack={true} />
      <ScrollView contentContainerStyle={styles.content}>
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
                        onPress={() => handleDeleteChild(child.id)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="trash" size={20} color={colors.error} />
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
            <Input
              label="Date of Birth"
              value={childForm.dateOfBirth}
              onChangeText={(text) => setChildForm({ ...childForm, dateOfBirth: text })}
              placeholder="YYYY-MM-DD"
            />
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
    alignItems: 'flex-start',
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
});
