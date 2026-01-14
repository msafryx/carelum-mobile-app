import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import EmptyState from '@/src/components/ui/EmptyState';
import { useAuth } from '@/src/hooks/useAuth';
import { getAllUsers } from '@/src/services/admin.service';
import { getParentChildren } from '@/src/services/child.service';
import { createSessionRequest } from '@/src/services/session.service';
import { User } from '@/src/types/user.types';
import { Child } from '@/src/types/child.types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';

interface Sitter extends User {
  rating?: number;
  reviews?: number;
}

export default function SearchScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState('');
  const [price, setPrice] = useState('');
  const [sitters, setSitters] = useState<Sitter[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Sitter | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState('2');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const rate = selected?.hourlyRate || 0;
  const total = rate * parseFloat(duration || '0');

  const loadSitters = useCallback(async (isRefresh = false) => {
    if (!user) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getAllUsers('babysitter', 100);
      if (result.success && result.data) {
        // Filter by search, location, rating, price if provided
        let filtered = result.data;
        
        if (search) {
          filtered = filtered.filter(s => 
            s.displayName?.toLowerCase().includes(search.toLowerCase()) ||
            s.bio?.toLowerCase().includes(search.toLowerCase())
          );
        }
        
        if (rating) {
          const minRating = parseFloat(rating);
          // For now, we don't have ratings in DB, so skip this filter
          // TODO: Add ratings/reviews table later
        }
        
        if (price) {
          const maxPrice = parseFloat(price);
          filtered = filtered.filter(s => !s.hourlyRate || s.hourlyRate <= maxPrice);
        }

        setSitters(filtered);
      } else {
        setSitters([]);
      }
    } catch (error: any) {
      console.error('Failed to load sitters:', error);
      setSitters([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, search, rating, price]);

  const loadChildren = useCallback(async () => {
    if (!user) return;

    try {
      const result = await getParentChildren(user.id);
      if (result.success && result.data) {
        setChildren(result.data);
        // Auto-select first child if available
        if (result.data.length > 0 && !selectedChild) {
          setSelectedChild(result.data[0]);
        }
      }
    } catch (error: any) {
      console.error('Failed to load children:', error);
    }
  }, [user, selectedChild]);

  useEffect(() => {
    loadSitters();
    loadChildren();
  }, [loadSitters, loadChildren]);

  const handleBookSitter = (sitter: Sitter) => {
    if (children.length === 0) {
      Alert.alert(
        'No Children',
        'Please add a child in your profile before booking a sitter.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelected(sitter);
    setBookingVisible(true);
  };

  const handleConfirmBooking = async () => {
    if (!user || !selected || !selectedChild) {
      Alert.alert('Error', 'Please select a sitter and child');
      return;
    }

    if (!duration || parseFloat(duration) <= 0) {
      Alert.alert('Error', 'Please enter a valid duration');
      return;
    }

    setCreating(true);
    try {
      // Combine date and time
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(selectedTime.getHours());
      startDateTime.setMinutes(selectedTime.getMinutes());
      startDateTime.setSeconds(0);
      startDateTime.setMilliseconds(0);

      // Calculate end time
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(endDateTime.getHours() + parseFloat(duration));

      const sessionResult = await createSessionRequest({
        parentId: user.id,
        sitterId: selected.id,
        childId: selectedChild.id,
        status: 'requested',
        startTime: startDateTime,
        endTime: endDateTime,
        location: location || undefined,
        hourlyRate: rate,
        notes: notes || undefined,
      });

      if (sessionResult.success) {
        Alert.alert(
          'Booking Request Sent',
          `Your booking request has been sent to ${selected.displayName}. They will be notified.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setBookingVisible(false);
                router.back();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', sessionResult.error?.message || 'Failed to create booking request');
      }
    } catch (error: any) {
      console.error('Failed to create session:', error);
      Alert.alert('Error', 'Failed to create booking request. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const filteredSitters = sitters.filter(sitter => {
    if (search && !sitter.displayName?.toLowerCase().includes(search.toLowerCase()) && 
        !sitter.bio?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (price && sitter.hourlyRate && sitter.hourlyRate > parseFloat(price)) {
      return false;
    }
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        showLogo={true} 
        title="Find Babysitter" 
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
      <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadSitters(true)} />
        }
      >
        <TextInput
          placeholder="Search sitters"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          style={[styles.search, { backgroundColor: colors.white, color: colors.text }]}
        />

        <Card>
          <Text style={[styles.filtersTitle, { color: colors.text }]}>Filters</Text>
          <View style={styles.filterRow}>
            <Ionicons name="location-sharp" size={20} color={colors.text} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Location"
              placeholderTextColor={colors.textSecondary}
              value={location}
              onChangeText={setLocation}
            />
          </View>
          <View style={styles.filterRow}>
            <Ionicons name="cash" size={20} color={colors.text} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Max price per hour"
              placeholderTextColor={colors.textSecondary}
              value={price}
              keyboardType="number-pad"
              onChangeText={setPrice}
            />
          </View>
        </Card>

        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredSitters.length === 0 ? (
          <Card>
            <EmptyState
              icon="search-outline"
              title="No sitters found"
              message={search ? "Try adjusting your search criteria" : "No babysitters available at the moment"}
            />
          </Card>
        ) : (
          filteredSitters.map((sitter) => (
            <Card key={sitter.id}>
              <View style={styles.sitterCard}>
                {sitter.profileImageUrl ? (
                  <Image 
                    source={{ uri: sitter.profileImageUrl }} 
                    style={styles.avatar}
                    defaultSource={require('@/assets/images/adult.webp')}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                    <Ionicons name="person" size={40} color={colors.textSecondary} />
                  </View>
                )}
                <Text style={[styles.name, { color: colors.text }]}>
                  {sitter.displayName || 'Sitter'}
                </Text>
                {sitter.bio && (
                  <Text style={[styles.info, { color: colors.textSecondary }]} numberOfLines={2}>
                    {sitter.bio}
                  </Text>
                )}
                <View style={styles.ratingRow}>
                  <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.ratingText, { color: colors.text }]}>
                    ${sitter.hourlyRate || 'N/A'}/hr
                  </Text>
                  {sitter.isVerified && (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success || '#10b981'} style={{ marginLeft: 8 }} />
                      <Text style={[styles.verifiedText, { color: colors.success || '#10b981' }]}>
                        Verified
                      </Text>
                    </>
                  )}
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.bookButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleBookSitter(sitter)}
                  >
                    <Text style={styles.bookText}>Book</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={bookingVisible} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <Header 
            title="Book Sitter" 
            showBack={true}
            onBackPress={() => setBookingVisible(false)}
          />
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Book {selected?.displayName || 'Sitter'}
            </Text>

            {/* Child Selection */}
            <Text style={[styles.label, { color: colors.text }]}>Select Child *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childPicker}>
              {children.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childOption,
                    {
                      backgroundColor: selectedChild?.id === child.id ? colors.primary : colors.white,
                      borderColor: selectedChild?.id === child.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedChild(child)}
                >
                  {child.photoUrl ? (
                    <Image source={{ uri: child.photoUrl }} style={styles.childAvatar} />
                  ) : (
                    <View style={[styles.childAvatar, { backgroundColor: colors.border }]}>
                      <Ionicons name="person" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.childName,
                      {
                        color: selectedChild?.id === child.id ? colors.white : colors.text,
                      },
                    ]}
                  >
                    {child.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Date Picker */}
            <Text style={[styles.label, { color: colors.text }]}>Date *</Text>
            <TouchableOpacity
              style={[styles.inputRow, { backgroundColor: colors.white }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color={colors.text} style={styles.icon} />
              <Text style={[styles.inputFlex, { color: colors.text }]}>
                {format(selectedDate, 'MMM dd, yyyy')}
              </Text>
            </TouchableOpacity>
            {showDatePicker && Platform.OS !== 'web' && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date && event.type !== 'dismissed') {
                    setSelectedDate(date);
                  }
                }}
              />
            )}

            {/* Time Picker */}
            <Text style={[styles.label, { color: colors.text }]}>Time *</Text>
            <TouchableOpacity
              style={[styles.inputRow, { backgroundColor: colors.white }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time" size={20} color={colors.text} style={styles.icon} />
              <Text style={[styles.inputFlex, { color: colors.text }]}>
                {format(selectedTime, 'h:mm a')}
              </Text>
            </TouchableOpacity>
            {showTimePicker && Platform.OS !== 'web' && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="default"
                onChange={(event, time) => {
                  setShowTimePicker(false);
                  if (time && event.type !== 'dismissed') {
                    setSelectedTime(time);
                  }
                }}
              />
            )}

            {/* Duration */}
            <Text style={[styles.label, { color: colors.text }]}>Duration (hours) *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.white }]}>
              <Ionicons name="hourglass" size={20} color={colors.text} style={styles.icon} />
              <TextInput
                style={[styles.inputFlex, { color: colors.text }]}
                placeholder="2"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={duration}
                onChangeText={setDuration}
              />
            </View>

            {/* Location */}
            <Text style={[styles.label, { color: colors.text }]}>Location</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.white }]}>
              <Ionicons name="location" size={20} color={colors.text} style={styles.icon} />
              <TextInput
                style={[styles.inputFlex, { color: colors.text }]}
                placeholder="Enter address"
                placeholderTextColor={colors.textSecondary}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            {/* Notes */}
            <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.white, minHeight: 80 }]}>
              <TextInput
                style={[styles.inputFlex, { color: colors.text }]}
                placeholder="Any special instructions..."
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <Text style={[styles.total, { color: colors.text }]}>
              Total: ${total.toFixed(2)}
            </Text>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: creating ? colors.border : colors.primary },
              ]}
              onPress={handleConfirmBooking}
              disabled={creating || !selectedChild || !duration}
            >
              {creating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.confirmText}>Confirm Booking</Text>
              )}
            </TouchableOpacity>
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
    padding: 20,
    paddingBottom: 100,
  },
  search: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  filtersTitle: {
    fontWeight: '600',
    marginBottom: 10,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    marginLeft: 10,
  },
  sitterCard: {
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  info: {
    marginTop: 2,
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingText: {
    marginLeft: 6,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  bookButton: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  bookText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  icon: {
    marginRight: 6,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 10,
  },
  total: {
    fontWeight: '600',
    marginBottom: 10,
    fontSize: 18,
  },
  confirmButton: {
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  childPicker: {
    marginBottom: 12,
  },
  childOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    minWidth: 100,
  },
  childAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
});
