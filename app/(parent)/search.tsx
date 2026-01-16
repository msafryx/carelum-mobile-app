import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import Header from '@/src/components/ui/Header';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import { getAllUsers } from '@/src/services/admin.service';
import { getParentChildren } from '@/src/services/child.service';
import { createSessionRequest } from '@/src/services/session.service';
import { Child } from '@/src/types/child.types';
import { SessionSearchScope } from '@/src/types/session.types';
import { User } from '@/src/types/user.types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
  const [requestMode, setRequestMode] = useState<SessionSearchScope>('invite');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | undefined>(undefined);
  const [customDistance, setCustomDistance] = useState<string>('');
  const [useCustomDistance, setUseCustomDistance] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sessionLocation, setSessionLocation] = useState<{
    address: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);

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

    // If request mode is not 'invite', switch to invite mode when selecting a sitter
    if (requestMode !== 'invite') {
      setRequestMode('invite');
      setMaxDistanceKm(undefined);
    }

    setSelected(sitter);
    setBookingVisible(true);
  };

  const handleCreateSessionRequest = () => {
    if (children.length === 0) {
      Alert.alert(
        'No Children',
        'Please add a child in your profile before creating a session request.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Validate request mode requirements
    if (requestMode === 'invite' && !selected) {
      Alert.alert(
        'Select Sitter',
        'Please select a sitter for invite mode, or change the request mode.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (requestMode === 'nearby' && !maxDistanceKm) {
      Alert.alert(
        'Select Distance',
        'Please select a distance for nearby search.',
        [{ text: 'OK' }]
      );
      return;
    }

    setBookingVisible(true);
  };

  const handleConfirmBooking = async () => {
    if (!user || !selectedChild) {
      Alert.alert('Error', 'Please select a child');
      return;
    }

    // Validate request mode requirements
    if (requestMode === 'invite' && !selected) {
      Alert.alert('Error', 'Please select a sitter for invite mode');
      return;
    }

    if (requestMode === 'invite' && !selected) {
      Alert.alert('Error', 'Please select a sitter for invite mode');
      return;
    }

    if (requestMode === 'nearby' && !maxDistanceKm) {
      Alert.alert('Error', 'Please select a distance for nearby search');
      return;
    }

    if (!duration || parseFloat(duration) <= 0) {
      Alert.alert('Error', 'Please enter a valid duration');
      return;
    }

    // Location is required for all modes
    if (!location || location.trim() === '') {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    // For Nearby mode, location with coordinates is required
    if (requestMode === 'nearby' && (!sessionLocation?.latitude || !sessionLocation?.longitude)) {
      Alert.alert(
        'Location Required',
        'For nearby requests, please ensure your location has GPS coordinates. Please enter a full address or enable location services.',
        [{ text: 'OK' }]
      );
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

      // Extract city from address for City mode
      // Simple extraction: take the last part after comma, or use a regex
      const extractCity = (address: string): string | undefined => {
        // Try to extract city from common address formats
        // Format: "Street Address, City, State, Country" or "Street Address, City"
        const parts = address.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          // Usually city is second-to-last or last part
          // For "123 Main St, New York, NY, USA" -> city is "New York"
          // For "123 Main St, New York" -> city is "New York"
          return parts[parts.length - 2] || parts[parts.length - 1];
        }
        return undefined;
      };

      // Build location object with address, coordinates, and city
      const locationObj: {
        address: string;
        city?: string;
        coordinates?: {
          latitude: number;
          longitude: number;
        };
      } = {
        address: location.trim(),
        coordinates: sessionLocation?.latitude && sessionLocation?.longitude
          ? {
              latitude: sessionLocation.latitude,
              longitude: sessionLocation.longitude,
            }
          : undefined,
      };

      // Add city for City mode
      if (requestMode === 'city') {
        const city = extractCity(location.trim());
        if (city) {
          locationObj.city = city;
        }
      }

      const sessionResult = await createSessionRequest({
        parentId: user.id,
        sitterId: requestMode === 'invite' ? selected!.id : '', // Only set for invite mode
        childId: selectedChild.id,
        status: 'requested',
        startTime: startDateTime,
        endTime: endDateTime,
        location: locationObj,
        hourlyRate: requestMode === 'invite' && rate > 0 ? rate : 0, // Set to 0 for non-invite modes (can be negotiated)
        notes: notes || undefined,
        searchScope: requestMode,
        maxDistanceKm: requestMode === 'nearby' ? maxDistanceKm : undefined,
      });

      if (sessionResult.success) {
        const successMessage = requestMode === 'invite'
          ? `Your booking request has been sent to ${selected!.displayName}. They will be notified.`
          : requestMode === 'nearby'
          ? `Your session request has been posted. Sitters within ${maxDistanceKm}km will be notified.`
          : requestMode === 'city'
          ? 'Your session request has been posted. Sitters in your city will be notified.'
          : 'Your session request has been posted. Sitters nationwide will be notified.';

        Alert.alert(
          'Request Sent',
          successMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                setBookingVisible(false);
                setSelected(null);
                setRequestMode('invite');
                setMaxDistanceKm(undefined);
                setSessionLocation(null);
                // Reset form state
                setBookingVisible(false);
                setSelected(null);
                setSelectedChild(null);
                setRequestMode('invite');
                setMaxDistanceKm(undefined);
                setSessionLocation(null);
                setLocation('');
                setNotes('');
                setDuration('2');
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
        {/* Search bar - only show in Invite mode */}
        {requestMode === 'invite' && (
          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: colors.white }]}>
              <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                placeholder="Search sitters by name or bio..."
                placeholderTextColor={colors.textSecondary}
                value={search}
                onChangeText={setSearch}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Request Mode Selector - Professional Card Design */}
        <Card>
          <View style={styles.requestModeHeader}>
            <View style={styles.requestModeTitleRow}>
              <Ionicons name="options" size={18} color={colors.primary} />
              <Text style={[styles.requestModeTitle, { color: colors.text }]}>Request Mode</Text>
            </View>
          </View>

          <View style={styles.requestModeGrid}>
            <TouchableOpacity
              style={[
                styles.requestModeCard,
                {
                  backgroundColor: requestMode === 'invite' ? colors.primary : colors.white,
                  borderColor: requestMode === 'invite' ? colors.primary : colors.border,
                  borderWidth: requestMode === 'invite' ? 2 : 1,
                },
              ]}
              onPress={() => {
                setRequestMode('invite');
                setMaxDistanceKm(undefined);
                setCustomDistance('');
                setUseCustomDistance(false);
                setSelected(null);
                setSessionLocation(null);
                setLocation('');
              }}
            >
              <View style={[
                styles.requestModeIconContainer,
                { backgroundColor: requestMode === 'invite' ? 'rgba(255,255,255,0.2)' : colors.border + '40' }
              ]}>
                <Ionicons
                  name="person-add"
                  size={18}
                  color={requestMode === 'invite' ? colors.white : colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.requestModeCardTitle,
                  { color: requestMode === 'invite' ? colors.white : colors.text },
                ]}
              >
                Invite
              </Text>
              <Text
                style={[
                  styles.requestModeCardSubtitle,
                  { color: requestMode === 'invite' ? 'rgba(255,255,255,0.9)' : colors.textSecondary },
                ]}
              >
                Direct invite
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.requestModeCard,
                {
                  backgroundColor: requestMode === 'nearby' ? colors.primary : colors.white,
                  borderColor: requestMode === 'nearby' ? colors.primary : colors.border,
                  borderWidth: requestMode === 'nearby' ? 2 : 1,
                },
              ]}
              onPress={() => {
                setRequestMode('nearby');
                setMaxDistanceKm(10);
                setCustomDistance('');
                setUseCustomDistance(false);
                setSelected(null);
                setSessionLocation(null);
                setLocation('');
              }}
            >
              <View style={[
                styles.requestModeIconContainer,
                { backgroundColor: requestMode === 'nearby' ? 'rgba(255,255,255,0.2)' : colors.border + '40' }
              ]}>
                <Ionicons
                  name="location"
                  size={18}
                  color={requestMode === 'nearby' ? colors.white : colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.requestModeCardTitle,
                  { color: requestMode === 'nearby' ? colors.white : colors.text },
                ]}
              >
                Nearby
              </Text>
              <Text
                style={[
                  styles.requestModeCardSubtitle,
                  { color: requestMode === 'nearby' ? 'rgba(255,255,255,0.9)' : colors.textSecondary },
                ]}
              >
                Radius search
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.requestModeCard,
                {
                  backgroundColor: requestMode === 'city' ? colors.primary : colors.white,
                  borderColor: requestMode === 'city' ? colors.primary : colors.border,
                  borderWidth: requestMode === 'city' ? 2 : 1,
                },
              ]}
              onPress={() => {
                setRequestMode('city');
                setMaxDistanceKm(undefined);
                setCustomDistance('');
                setUseCustomDistance(false);
                setSelected(null);
                setSessionLocation(null);
                setLocation('');
              }}
            >
              <View style={[
                styles.requestModeIconContainer,
                { backgroundColor: requestMode === 'city' ? 'rgba(255,255,255,0.2)' : colors.border + '40' }
              ]}>
                <Ionicons
                  name="business"
                  size={18}
                  color={requestMode === 'city' ? colors.white : colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.requestModeCardTitle,
                  { color: requestMode === 'city' ? colors.white : colors.text },
                ]}
              >
                City
              </Text>
              <Text
                style={[
                  styles.requestModeCardSubtitle,
                  { color: requestMode === 'city' ? 'rgba(255,255,255,0.9)' : colors.textSecondary },
                ]}
              >
                City-wide
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.requestModeCard,
                {
                  backgroundColor: requestMode === 'nationwide' ? colors.primary : colors.white,
                  borderColor: requestMode === 'nationwide' ? colors.primary : colors.border,
                  borderWidth: requestMode === 'nationwide' ? 2 : 1,
                },
              ]}
              onPress={() => {
                setRequestMode('nationwide');
                setMaxDistanceKm(undefined);
                setCustomDistance('');
                setUseCustomDistance(false);
                setSelected(null);
                setSessionLocation(null);
                setLocation('');
              }}
            >
              <View style={[
                styles.requestModeIconContainer,
                { backgroundColor: requestMode === 'nationwide' ? 'rgba(255,255,255,0.2)' : colors.border + '40' }
              ]}>
                <Ionicons
                  name="globe"
                  size={18}
                  color={requestMode === 'nationwide' ? colors.white : colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.requestModeCardTitle,
                  { color: requestMode === 'nationwide' ? colors.white : colors.text },
                ]}
              >
                Nationwide
              </Text>
              <Text
                style={[
                  styles.requestModeCardSubtitle,
                  { color: requestMode === 'nationwide' ? 'rgba(255,255,255,0.9)' : colors.textSecondary },
                ]}
              >
                Country-wide
              </Text>
            </TouchableOpacity>
          </View>

          {/* Distance Selector (for Nearby mode) */}
          {requestMode === 'nearby' && (
            <View style={styles.distanceSection}>
              <Text style={[styles.distanceSectionTitle, { color: colors.text }]}>Search Radius</Text>
              <View style={styles.distanceOptionsRow}>
                {[5, 10, 25].map((distance) => (
                  <TouchableOpacity
                    key={distance}
                    style={[
                      styles.distanceChip,
                      {
                        backgroundColor: !useCustomDistance && maxDistanceKm === distance ? colors.primary : colors.white,
                        borderColor: !useCustomDistance && maxDistanceKm === distance ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setMaxDistanceKm(distance);
                      setUseCustomDistance(false);
                      setCustomDistance('');
                    }}
                  >
                    <Text
                      style={[
                        styles.distanceChipText,
                        { color: !useCustomDistance && maxDistanceKm === distance ? colors.white : colors.text },
                      ]}
                    >
                      {distance} km
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.distanceChip,
                    {
                      backgroundColor: useCustomDistance ? colors.primary : colors.white,
                      borderColor: useCustomDistance ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setUseCustomDistance(true);
                    if (customDistance) {
                      const dist = parseFloat(customDistance);
                      if (!isNaN(dist) && dist > 0) {
                        setMaxDistanceKm(dist);
                      }
                    }
                  }}
                >
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={useCustomDistance ? colors.white : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.distanceChipText,
                      { color: useCustomDistance ? colors.white : colors.text, marginLeft: 4 },
                    ]}
                  >
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>
              {useCustomDistance && (
                <View style={[styles.customDistanceInput, { backgroundColor: colors.white, borderColor: colors.border }]}>
                  <Ionicons name="resize" size={18} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.customDistanceTextInput, { color: colors.text }]}
                    placeholder="Enter distance (km)"
                    placeholderTextColor={colors.textSecondary}
                    value={customDistance}
                    keyboardType="decimal-pad"
                    onChangeText={(text) => {
                      setCustomDistance(text);
                      const dist = parseFloat(text);
                      if (!isNaN(dist) && dist > 0 && dist <= 1000) {
                        setMaxDistanceKm(dist);
                      } else if (text === '') {
                        setMaxDistanceKm(undefined);
                      }
                    }}
                  />
                  <Text style={[styles.kmLabel, { color: colors.textSecondary }]}>km</Text>
                </View>
              )}
            </View>
          )}

          {/* Filters Button - After Request Mode */}
          <TouchableOpacity
            style={[styles.filterButtonAfter, { 
              backgroundColor: (location || price) ? colors.primary : colors.white,
              borderColor: colors.primary,
            }]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons 
              name="filter" 
              size={16} 
              color={(location || price) ? colors.white : colors.primary} 
            />
            <Text style={[
              styles.filterButtonAfterText, 
              { color: (location || price) ? colors.white : colors.primary }
            ]}>
              Filters
            </Text>
            {(location || price) && (
              <View style={[styles.filterBadge, { backgroundColor: colors.white }]}>
                <Text style={[styles.filterBadgeText, { color: colors.primary }]}>
                  {(location ? 1 : 0) + (price ? 1 : 0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Active Filters Display - Show selected filters with values */}
          {(search || price || location) && (
            <View style={styles.activeFiltersContainer}>
              <View style={styles.activeFiltersHeader}>
                <Text style={[styles.activeFiltersLabel, { color: colors.textSecondary }]}>Active Filters</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSearch('');
                    setPrice('');
                    setLocation('');
                  }}
                  style={styles.clearAllButton}
                >
                  <Text style={[styles.clearAllText, { color: colors.error }]}>Clear All</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.activeFiltersRow}>
                {search && (
                  <View style={[styles.filterChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                    <Ionicons name="search" size={14} color={colors.primary} />
                    <Text style={[styles.filterChipText, { color: colors.primary }]} numberOfLines={1}>
                      {search}
                    </Text>
                    <TouchableOpacity 
                      onPress={() => setSearch('')} 
                      style={styles.filterChipClose}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Ionicons name="close" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
                {price && (
                  <View style={[styles.filterChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                    <Ionicons name="cash" size={14} color={colors.primary} />
                    <Text style={[styles.filterChipText, { color: colors.primary }]} numberOfLines={1}>
                      {price} LKR/hr
                    </Text>
                    <TouchableOpacity 
                      onPress={() => setPrice('')} 
                      style={styles.filterChipClose}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Ionicons name="close" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
                {location && (
                  <View style={[styles.filterChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                    <Ionicons name="location-sharp" size={14} color={colors.primary} />
                    <Text style={[styles.filterChipText, { color: colors.primary }]} numberOfLines={1} ellipsizeMode="clip">
                      {location.trim()}
                    </Text>
                    <TouchableOpacity 
                      onPress={() => setLocation('')} 
                      style={styles.filterChipClose}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Ionicons name="close" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        </Card>

        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : requestMode === 'invite' ? (
          // Invite mode: Show sitter list
          filteredSitters.length === 0 ? (
            <Card>
              <EmptyState
                icon="search-outline"
                title="No sitters found"
                message={
                  search
                    ? "Try adjusting your search criteria"
                    : "No babysitters available at the moment"
                }
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
          )
        ) : (
          // Non-invite modes: Show Request Preview
          <Card>
            <View style={styles.requestPreviewContainer}>
              <View style={styles.requestPreviewHeader}>
                <Ionicons 
                  name={requestMode === 'nearby' ? 'location' : requestMode === 'city' ? 'business' : 'globe'} 
                  size={24} 
                  color={colors.primary} 
                />
                <Text style={[styles.requestPreviewTitle, { color: colors.text }]}>
                  {requestMode === 'nearby' 
                    ? `Nearby Request (${maxDistanceKm}km)` 
                    : requestMode === 'city'
                    ? 'City Request'
                    : 'Nationwide Request'}
                </Text>
              </View>
              <Text style={[styles.requestPreviewDescription, { color: colors.textSecondary }]}>
                {requestMode === 'nearby'
                  ? `This request will be broadcast to all sitters within ${maxDistanceKm}km of your location. Sitters will be notified and can accept your request.`
                  : requestMode === 'city'
                  ? 'This request will be broadcast to all sitters in your city. Sitters will be notified and can accept your request.'
                  : 'This request will be broadcast to all sitters nationwide. Sitters will be notified and can accept your request.'}
              </Text>
              <TouchableOpacity
                style={[styles.createRequestButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={handleCreateSessionRequest}
              >
                <Ionicons name="add-circle" size={20} color={colors.white} />
                <Text style={[styles.createRequestText, { color: colors.white }]}>
                  Create Request
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.filterModalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.filterModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.filterModalTitle, { color: colors.text }]}>Filters</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.filterModalBody}>
              {/* Location Filter */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Ionicons name="location-sharp" size={20} color={colors.primary} />
                  <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Location</Text>
                </View>
                <View style={[styles.filterInputContainer, { 
                  backgroundColor: colors.white, 
                  borderColor: location ? colors.primary : colors.border,
                  borderWidth: location ? 2 : 1.5,
                }]}>
                  <TextInput
                    style={[styles.filterInput, { color: colors.text }]}
                    placeholder="Enter location"
                    placeholderTextColor={colors.textSecondary}
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>
                {location && (
                  <View style={[styles.filterSelectedValue, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text style={[styles.filterSelectedText, { color: colors.primary }]}>
                      Selected: {location}
                    </Text>
                  </View>
                )}
              </View>

              {/* Price Filter */}
              <View style={styles.filterSection}>
                <View style={styles.filterSectionHeader}>
                  <Ionicons name="cash" size={20} color={colors.primary} />
                  <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Max Price per Hour</Text>
                </View>
                <View style={[styles.filterInputContainer, { 
                  backgroundColor: colors.white, 
                  borderColor: price ? colors.primary : colors.border,
                  borderWidth: price ? 2 : 1.5,
                }]}>
                  <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>LKR</Text>
                  <TextInput
                    style={[styles.filterInput, { color: colors.text }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    value={price}
                    keyboardType="decimal-pad"
                    onChangeText={setPrice}
                  />
                </View>
                {price && (
                  <View style={[styles.filterSelectedValue, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text style={[styles.filterSelectedText, { color: colors.primary }]}>
                      Selected: {price} LKR/hr
                    </Text>
                  </View>
                )}
              </View>

              {/* Rating Filter (for future use) */}
              {rating && (
                <View style={styles.filterSection}>
                  <View style={styles.filterSectionHeader}>
                    <Ionicons name="star" size={20} color={colors.primary} />
                    <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Minimum Rating</Text>
                  </View>
                  <Text style={[styles.filterNote, { color: colors.textSecondary }]}>
                    Rating filter coming soon
                  </Text>
                </View>
              )}

              {/* Clear All Filters Button */}
              {(location || price) && (
                <TouchableOpacity
                  style={[styles.clearFiltersButton, { backgroundColor: colors.error + '20', borderColor: colors.error }]}
                  onPress={() => {
                    setLocation('');
                    setPrice('');
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  <Text style={[styles.clearFiltersText, { color: colors.error }]}>Clear All Filters</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <View style={[styles.filterModalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.applyFiltersButton, { backgroundColor: colors.primary }]}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.applyFiltersText}>Apply Filters</Text>
              </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Booking Modal */}
      <Modal visible={bookingVisible} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeaderContainer}>
            <Header 
              title="Book Sitter" 
              showBack={false}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setBookingVisible(false)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {requestMode === 'invite' 
                ? `Book ${selected?.displayName || 'Sitter'}` 
                : requestMode === 'nearby'
                ? `Create Nearby Request (${maxDistanceKm}km)`
                : requestMode === 'city'
                ? 'Create City Request'
                : 'Create Nationwide Request'}
            </Text>

            {/* Request Mode Display (read-only in modal) */}
            <View style={[styles.infoCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
              <View style={styles.infoRow}>
                <Ionicons name="radio-button-on" size={16} color={colors.primary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Request Mode:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {requestMode === 'invite' 
                    ? 'Invite Sitter' 
                    : requestMode === 'nearby'
                    ? `Nearby (${maxDistanceKm}km)`
                    : requestMode === 'city'
                    ? 'City'
                    : 'Nationwide'}
                </Text>
              </View>
            </View>

            {/* Selected Sitter Card (Invite mode only) - Locked/Read-only */}
            {requestMode === 'invite' && selected && (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Selected Sitter *</Text>
                <View style={[styles.selectedSitterCard, { backgroundColor: colors.white, borderColor: colors.border }]}>
                  {selected.profileImageUrl ? (
                    <Image
                      source={{ uri: selected.profileImageUrl }}
                      style={styles.selectedSitterAvatar}
                      defaultSource={require('@/assets/images/adult.webp')}
                    />
                  ) : (
                    <View style={[styles.selectedSitterAvatar, { backgroundColor: colors.border }]}>
                      <Ionicons name="person" size={24} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.selectedSitterInfo}>
                    <Text style={[styles.selectedSitterName, { color: colors.text }]}>
                      {selected.displayName || 'Sitter'}
                    </Text>
                    {selected.bio && (
                      <Text style={[styles.selectedSitterBio, { color: colors.textSecondary }]} numberOfLines={2}>
                        {selected.bio}
                      </Text>
                    )}
                    <View style={styles.selectedSitterDetails}>
                      {selected.hourlyRate && (
                        <Text style={[styles.selectedSitterRate, { color: colors.textSecondary }]}>
                          ${selected.hourlyRate}/hr
                        </Text>
                      )}
                      {selected.isVerified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.success || '#10b981'} />
                          <Text style={[styles.verifiedText, { color: colors.success || '#10b981' }]}>
                            Verified
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSelected(null);
                      setBookingVisible(false);
                    }}
                    style={styles.changeSitterButton}
                  >
                    <Text style={[styles.changeSitterText, { color: colors.primary }]}>Change</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

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
            <Text style={[styles.label, { color: colors.text }]}>Location *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.white }]}>
              <Ionicons name="location" size={20} color={colors.text} style={styles.icon} />
              <TextInput
                style={[styles.inputFlex, { color: colors.text }]}
                placeholder="Enter full address"
                placeholderTextColor={colors.textSecondary}
                value={location}
                onChangeText={(text) => {
                  setLocation(text);
                  // Update session location object
                  setSessionLocation({
                    address: text,
                    // latitude and longitude can be added via geocoding later
                    // city will be extracted when creating the session
                  });
                }}
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

            {requestMode === 'invite' && rate > 0 && (
              <Text style={[styles.total, { color: colors.text }]}>
                Total: ${total.toFixed(2)}
              </Text>
            )}
            {requestMode !== 'invite' && (
              <Text style={[styles.total, { color: colors.textSecondary, fontSize: 14 }]}>
                Hourly rate will be negotiated with accepting sitter
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: creating ? colors.border : colors.primary },
              ]}
              onPress={handleConfirmBooking}
              disabled={
                creating ||
                !selectedChild ||
                !duration ||
                (requestMode === 'invite' && !selected) ||
                (requestMode === 'nearby' && !maxDistanceKm) ||
                !location ||
                location.trim() === '' ||
                (requestMode === 'nearby' && (!sessionLocation?.latitude || !sessionLocation?.longitude))
              }
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
  requestModeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  requestModeOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  requestModeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  distanceContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  distanceOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedSitterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  selectedSitterAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSitterInfo: {
    flex: 1,
  },
  selectedSitterName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedSitterRate: {
    fontSize: 14,
  },
  changeSitterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeSitterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectSitterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  selectSitterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalHeaderContainer: {
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 1000,
    padding: 8,
  },
  createSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  createSessionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  createRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  createRequestText: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestPreviewContainer: {
    padding: 16,
  },
  requestPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  requestPreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  requestPreviewDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  selectedSitterBio: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  selectedSitterDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // New Professional UI Styles
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  requestModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestModeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestModeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  requestModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  requestModeCard: {
    flex: 1,
    minWidth: '47%',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  requestModeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  requestModeCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 1,
  },
  requestModeCardSubtitle: {
    fontSize: 9,
    fontWeight: '500',
  },
  filterButtonAfter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
    marginTop: 4,
    position: 'relative',
  },
  filterButtonAfterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  distanceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  distanceSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  distanceOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  distanceChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customDistanceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  customDistanceTextInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  kmLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeFiltersContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  activeFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeFiltersLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    flexShrink: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 4,
    flexShrink: 0,
  },
  filterChipClose: {
    marginLeft: 2,
    padding: 2,
  },
  // Filter Modal Styles
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  filterModalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  filterModalBody: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  filterInput: {
    flex: 1,
    fontSize: 16,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  filterNote: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  filterSelectedValue: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  filterSelectedText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
    marginTop: 8,
  },
  clearFiltersText: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterModalFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  applyFiltersButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFiltersText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
