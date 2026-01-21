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
import { format, parse, isValid } from 'date-fns';
import * as Location from 'expo-location';
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
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import WebMapView from '@/src/components/gps/WebMapView';
import FullscreenMapModal from '@/src/components/gps/FullscreenMapModal';
// Platform-specific map imports - DO NOT load at module level
// Will be loaded dynamically only when needed to avoid native module errors

interface Sitter extends User {
  rating?: number;
  reviews?: number;
}

export default function SearchScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [mapViewAvailable, setMapViewAvailable] = useState(false);
  const [MapViewComponent, setMapViewComponent] = useState<any>(null);
  const [MarkerComponent, setMarkerComponent] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState('');
  const [price, setPrice] = useState('');
  const [sitters, setSitters] = useState<Sitter[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Sitter | null>(null);
  const [selectedChildren, setSelectedChildren] = useState<Child[]>([]);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [calculatedHours, setCalculatedHours] = useState<number>(0);
  const [useTimeSlotMode, setUseTimeSlotMode] = useState(false);
  const [dailyTimeSlots, setDailyTimeSlots] = useState<Record<string, { startTime: Date; endTime: Date; hours: number }>>({});
  const [notes, setNotes] = useState('');
  const [slotTimePickers, setSlotTimePickers] = useState<Record<string, { showStart: boolean; showEnd: boolean }>>({});
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
  const [filterLocation, setFilterLocation] = useState<{
    address: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [filterMapRegion, setFilterMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [filterGeocodingLoading, setFilterGeocodingLoading] = useState(false);
  const filterMapRef = useRef<any>(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const mapRef = useRef<any>(null);
  const [fullscreenMapVisible, setFullscreenMapVisible] = useState(false);

  const rate = selected?.hourlyRate || 0;
  
  // Calculate hours and days breakdown from start and end date/time
  const [daysBreakdown, setDaysBreakdown] = useState<Array<{ date: string; hours: number }>>([]);
  
  // Initialize time slots for each day when daysBreakdown changes
  useEffect(() => {
    if (useTimeSlotMode && daysBreakdown.length > 0) {
      setDailyTimeSlots(prev => {
        const updated = { ...prev };
        daysBreakdown.forEach(day => {
          if (!updated[day.date]) {
            // Parse the formatted date string back to a Date object
            // day.date is in format "MMM dd, yyyy" (e.g., "Jan 15, 2024")
            let dayDate: Date;
            try {
              // Try parsing the formatted date
              dayDate = parse(day.date, 'MMM dd, yyyy', new Date());
              // Validate the date
              if (isNaN(dayDate.getTime())) {
                // Fallback: use current date
                dayDate = new Date();
              }
            } catch (error) {
              // Fallback: use current date
              dayDate = new Date();
            }
            
            const defaultStart = new Date(dayDate);
            defaultStart.setHours(9, 0, 0, 0);
            defaultStart.setMinutes(0);
            defaultStart.setSeconds(0);
            defaultStart.setMilliseconds(0);
            
            const defaultEnd = new Date(dayDate);
            defaultEnd.setHours(12, 0, 0, 0);
            defaultEnd.setMinutes(0);
            defaultEnd.setSeconds(0);
            defaultEnd.setMilliseconds(0);
            
            // Validate dates before storing
            if (!isNaN(defaultStart.getTime()) && !isNaN(defaultEnd.getTime())) {
              updated[day.date] = {
                startTime: defaultStart,
                endTime: defaultEnd,
                hours: 3,
              };
            }
          }
        });
        // Recalculate total
        const newTotal = Object.values(updated).reduce((sum, s) => sum + (s.hours || 0), 0);
        setCalculatedHours(newTotal);
        return updated;
      });
    }
  }, [daysBreakdown, useTimeSlotMode]);
  
  useEffect(() => {
    const start = new Date(startDate);
    start.setHours(startTime.getHours());
    start.setMinutes(startTime.getMinutes());
    start.setSeconds(0);
    start.setMilliseconds(0);
    
    const end = new Date(endDate);
    end.setHours(endTime.getHours());
    end.setMinutes(endTime.getMinutes());
    end.setSeconds(0);
    end.setMilliseconds(0);
    
    if (end > start) {
      // Calculate total hours difference
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (!useTimeSlotMode) {
        // Continuous mode: calculate total hours from start to end
        setCalculatedHours(diffHours);
      }
      // Time slot mode: hours are calculated from daily slots
      
      // Calculate days and hours breakdown
      const breakdown: Array<{ date: string; hours: number }> = [];
      const current = new Date(start);
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (useTimeSlotMode) {
        // Time slots mode: include all days in the range
        const currentDay = new Date(start);
        currentDay.setHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setHours(23, 59, 59, 999);
        
        while (currentDay <= endDay) {
          const dayStr = format(currentDay, 'MMM dd, yyyy');
          const dayDateStr = format(currentDay, 'yyyy-MM-dd');
          
          // For time slots, each day will have its own time configured
          // Default hours will be set when slot is initialized
          breakdown.push({
            date: dayStr,
            hours: 0, // Will be set by user in time slot configuration
          });
          
          // Move to next day
          currentDay.setDate(currentDay.getDate() + 1);
        }
      } else {
        // Continuous mode: calculate actual hours per day
        if (totalDays === 1) {
          // Same day
          breakdown.push({
            date: format(start, 'MMM dd, yyyy'),
            hours: diffHours,
          });
        } else {
          // Multiple days - calculate actual hours per day
          const currentDay = new Date(start);
          currentDay.setHours(0, 0, 0, 0);
          const endDay = new Date(end);
          endDay.setHours(23, 59, 59, 999);
          
          while (currentDay <= endDay) {
            const dayStart = new Date(currentDay);
            const dayEnd = new Date(currentDay);
            
            // First day: use start time
            if (format(currentDay, 'yyyy-MM-dd') === format(start, 'yyyy-MM-dd')) {
              dayStart.setHours(startTime.getHours());
              dayStart.setMinutes(startTime.getMinutes());
              dayEnd.setHours(23);
              dayEnd.setMinutes(59);
              dayEnd.setSeconds(59);
            }
            // Last day: use end time
            else if (format(currentDay, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
              dayStart.setHours(0);
              dayStart.setMinutes(0);
              dayEnd.setHours(endTime.getHours());
              dayEnd.setMinutes(endTime.getMinutes());
              dayEnd.setSeconds(59);
            }
            // Middle days: full 24 hours
            else {
              dayStart.setHours(0);
              dayStart.setMinutes(0);
              dayEnd.setHours(23);
              dayEnd.setMinutes(59);
              dayEnd.setSeconds(59);
            }
            
            // Calculate hours for this day
            const dayStartTime = Math.max(dayStart.getTime(), start.getTime());
            const dayEndTime = Math.min(dayEnd.getTime(), end.getTime());
            const dayHours = Math.max(0, (dayEndTime - dayStartTime) / (1000 * 60 * 60));
            
            // Only add days with actual hours
            if (dayHours > 0) {
              breakdown.push({
                date: format(currentDay, 'MMM dd, yyyy'),
                hours: dayHours,
              });
            }
            
            // Move to next day
            currentDay.setDate(currentDay.getDate() + 1);
          }
        }
      }
      
      setDaysBreakdown(breakdown);
    } else {
      setCalculatedHours(0);
      setDaysBreakdown([]);
    }
  }, [startDate, startTime, endDate, endTime, useTimeSlotMode]);
  
  const total = rate * calculatedHours;

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

  const loadChildren = useCallback(async (forceRefresh: boolean = false) => {
    if (!user) return;

    try {
      // Force refresh from API to get latest data (bypasses AsyncStorage)
      const result = await getParentChildren(user.id, forceRefresh);
      if (result.success && result.data) {
        // Use Map for better deduplication by id (last one wins)
        const childrenMap = new Map<string, Child>();
        result.data.forEach((child) => {
          if (child.id && child.id !== 'temp_' && !child.id.startsWith('temp_')) {
            childrenMap.set(child.id, child);
          }
        });
        const uniqueChildren = Array.from(childrenMap.values());
        
        console.log(`✅ Loaded ${uniqueChildren.length} unique children (deduplicated from ${result.data.length}, forceRefresh: ${forceRefresh})`);
        setChildren(uniqueChildren);
        
        // Clean up selectedChildren - remove any that no longer exist
        setSelectedChildren((prev) => {
          const validSelected = prev.filter((selected) =>
            uniqueChildren.some((child) => child.id === selected.id)
          );
          // Auto-select first child if available and none selected
          if (validSelected.length === 0 && uniqueChildren.length > 0) {
            return [uniqueChildren[0]];
          }
          return validSelected;
        });
      } else {
        // If no children, clear selection
        setChildren([]);
        setSelectedChildren([]);
      }
    } catch (error: any) {
      console.error('Failed to load children:', error);
      // On error, don't clear existing children to avoid flicker
    }
  }, [user]);

  useEffect(() => {
    loadSitters();
    loadChildren();
    // Dynamically load MapView after component mounts to avoid module load errors
    // Use lazy loading approach from maps.native.ts
    if (Platform.OS !== 'web') {
      const loadMaps = () => {
        try {
          // Use the lazy loading approach from maps.native.ts
          // Wrap the require in try-catch in case the module itself throws during import
          let mapsModule: any = null;
          try {
            mapsModule = require('@/src/components/gps/maps.native');
          } catch (importError: any) {
            // Module import failed - likely Expo Go issue
            console.warn('⚠️ Failed to import maps.native module:', importError?.message || importError);
            console.warn('💡 Note: react-native-maps requires a development build and does not work in Expo Go');
            setMapViewAvailable(false);
            return;
          }
          
          if (!mapsModule) {
            console.warn('⚠️ maps.native module is null');
            setMapViewAvailable(false);
            return;
          }
          
          // Wrap getMapView() and getMarker() calls in try-catch to handle codegenNativeCommands errors
          let MapViewComponent: any = null;
          let MarkerComponent: any = null;
          
          try {
            MapViewComponent = mapsModule.getMapView?.();
            MarkerComponent = mapsModule.getMarker?.();
          } catch (nativeError: any) {
            // This error is expected in Expo Go - react-native-maps requires a development build
            console.warn('⚠️ Native maps not available (requires development build):', nativeError?.message || nativeError);
            setMapViewAvailable(false);
            return;
          }
          
          if (MapViewComponent && MarkerComponent) {
            setMapViewComponent(() => MapViewComponent);
            setMarkerComponent(() => MarkerComponent);
            setMapViewAvailable(true);
            console.log('✅ MapView loaded successfully');
          } else {
            console.warn('⚠️ MapView components not available');
            setMapViewAvailable(false);
          }
        } catch (error: any) {
          console.warn('⚠️ Failed to load MapView:', error?.message || error);
          console.warn('💡 Note: react-native-maps requires a development build and does not work in Expo Go');
          setMapViewAvailable(false);
        }
      };
      // Load after a delay to ensure React Native is fully initialized
      const timeout = setTimeout(loadMaps, 500);
      return () => clearTimeout(timeout);
    } else {
      setMapViewAvailable(false);
    }
  }, [loadSitters, loadChildren]);

  // Real-time sync for children updates
  useEffect(() => {
    if (!user) return;
    
    let unsubscribe: (() => void) | undefined;
    let handleWebEvent: (() => void) | undefined;
    
    // Import the emitter (works on all platforms)
    import('@/src/hooks/useRealtimeSync').then((module) => {
      if (module.childrenUpdateEmitter) {
        console.log('✅ Children update listener registered in search screen');
        unsubscribe = module.childrenUpdateEmitter.on(() => {
          console.log('📢 Children updated event received, force refreshing children...');
          loadChildren(true); // Force refresh from API
        });
      }
    }).catch((error) => {
      console.error('❌ Failed to import childrenUpdateEmitter:', error);
    });
    
    // Also listen on web for CustomEvent (web only)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      handleWebEvent = () => {
        console.log('📢 Web children updated event received, force refreshing...');
        loadChildren(true); // Force refresh from API
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
  }, [user, loadChildren]);

  // Refresh children when booking modal opens - force refresh to get latest
  useEffect(() => {
    if (bookingVisible) {
      loadChildren(true); // Force refresh from API to ensure latest data
    }
  }, [bookingVisible, loadChildren]);

  // Geocoding effect - convert address to coordinates (with timeout)
  useEffect(() => {
    const debounceGeocode = setTimeout(async () => {
      if (location.trim().length > 3) {
        setGeocodingLoading(true);
        try {
          // Add timeout wrapper for geocoding (10 seconds max)
          const geocodePromise = Location.geocodeAsync(location.trim());
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Geocoding timeout')), 10000)
          );

          const geocodedLocation = await Promise.race([geocodePromise, timeoutPromise]) as any[];
          
          if (geocodedLocation && geocodedLocation.length > 0) {
            const { latitude, longitude } = geocodedLocation[0];
            
            // Try reverse geocoding with timeout
            try {
              const reverseGeocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
              const reverseTimeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Reverse geocoding timeout')), 5000)
              );
              const reverseGeocoded = await Promise.race([reverseGeocodePromise, reverseTimeoutPromise]) as any[];
              const city = reverseGeocoded && reverseGeocoded.length > 0 ? (reverseGeocoded[0].city || undefined) : undefined;
              
              setSessionLocation({ address: location.trim(), latitude, longitude, city });
            } catch (reverseError) {
              // If reverse geocoding fails, still use coordinates
              setSessionLocation({ address: location.trim(), latitude, longitude });
            }
            
            setMapRegion({
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            // Animate map to location
            if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
              mapRef.current.animateToRegion({
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 500);
            }
          } else {
            // No results, but keep the address
            setSessionLocation({ address: location.trim() });
          }
        } catch (error: any) {
          // Silently fail - geocoding is optional, user can still proceed with address
          // Only log in development
          if (__DEV__) {
            console.log('Geocoding failed (non-blocking):', error?.message || 'Unknown error');
          }
          // Keep address even if geocoding fails
          setSessionLocation({ address: location.trim() });
        } finally {
          setGeocodingLoading(false);
        }
      } else {
        setSessionLocation(null);
      }
    }, 1500); // Increased debounce to 1.5 seconds to reduce API calls
    return () => clearTimeout(debounceGeocode);
  }, [location]);

  // Get current location
  const handleGetCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Location permission denied. Please enable location access in settings.');
        setLocationLoading(false);
        return;
      }

      // Add timeout for getting current position (15 seconds)
      const positionPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Location timeout')), 15000)
      );

      const currentLocation = await Promise.race([positionPromise, timeoutPromise]) as Location.LocationObject;
      const { latitude, longitude } = currentLocation.coords;

      // Try reverse geocoding with timeout
      let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      let city: string | undefined = undefined;
      
      try {
        const reverseGeocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
        const reverseTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Reverse geocoding timeout')), 5000)
        );
        const reverseGeocoded = await Promise.race([reverseGeocodePromise, reverseTimeoutPromise]) as any[];
        
        if (reverseGeocoded && reverseGeocoded.length > 0) {
          address = `${reverseGeocoded[0].street || ''} ${reverseGeocoded[0].streetNumber || ''}, ${reverseGeocoded[0].city || ''}, ${reverseGeocoded[0].region || ''}`.trim() || address;
          city = reverseGeocoded[0].city || undefined;
        }
      } catch (reverseError) {
        // If reverse geocoding fails, use coordinates as address
        if (__DEV__) {
          console.log('Reverse geocoding failed, using coordinates:', reverseError);
        }
      }

      setLocation(address);
      setSessionLocation({ address, latitude, longitude, city });
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      // Animate map to location
      if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }
    } catch (error: any) {
      // Show user-friendly error message
      const errorMessage = error?.message?.includes('timeout')
        ? 'Location request timed out. Please try again or enter address manually.'
        : 'Failed to get current location. Please enter address manually.';
      Alert.alert('Location Error', errorMessage);
      if (__DEV__) {
        console.log('Failed to get current location:', error);
      }
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle map region change (when user drags map)
  const handleMapRegionChange = (region: any) => {
    setMapRegion(region);
  };

  // Geocoding effect for filter location
  useEffect(() => {
    const debounceGeocode = setTimeout(async () => {
      if (location.trim().length > 3 && filterModalVisible) {
        setFilterGeocodingLoading(true);
        try {
          const geocodePromise = Location.geocodeAsync(location.trim());
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Geocoding timeout')), 10000)
          );
          const geocodedLocation = await Promise.race([geocodePromise, timeoutPromise]) as any[];
          if (geocodedLocation && geocodedLocation.length > 0) {
            const { latitude, longitude } = geocodedLocation[0];
            const reverseGeocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
            const city = reverseGeocoded && reverseGeocoded.length > 0 ? (reverseGeocoded[0].city || undefined) : undefined;
            setFilterLocation({ address: location.trim(), latitude, longitude, city });
            setFilterMapRegion({
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            if (filterMapRef.current && typeof filterMapRef.current.animateToRegion === 'function') {
              filterMapRef.current.animateToRegion({
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 500);
            }
          } else {
            setFilterLocation({ address: location.trim() });
          }
        } catch (error) {
          setFilterLocation({ address: location.trim() });
        } finally {
          setFilterGeocodingLoading(false);
        }
      } else if (location.trim().length === 0) {
        setFilterLocation(null);
      }
    }, 1500);
    return () => clearTimeout(debounceGeocode);
  }, [location, filterModalVisible]);

  // Handle map press (drop pin)
  const handleMapPress = async (event: any) => {
    // Handle both native map events and WebView map coordinates
    let latitude: number;
    let longitude: number;
    
    if (event.nativeEvent?.coordinate) {
      // Native map event
      ({ latitude, longitude } = event.nativeEvent.coordinate);
    } else if (event.latitude && event.longitude) {
      // WebView map event (direct coordinate object)
      ({ latitude, longitude } = event);
    } else {
      console.warn('Invalid map press event:', event);
      return;
    }
    
    try {
      // Add timeout for reverse geocoding (5 seconds)
      const reverseGeocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Reverse geocoding timeout')), 5000)
      );
      
      const reverseGeocoded = await Promise.race([reverseGeocodePromise, timeoutPromise]) as any[];
      const address = reverseGeocoded && reverseGeocoded.length > 0
        ? `${reverseGeocoded[0].street || ''} ${reverseGeocoded[0].streetNumber || ''}, ${reverseGeocoded[0].city || ''}, ${reverseGeocoded[0].region || ''}`.trim()
        : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      const city = reverseGeocoded && reverseGeocoded.length > 0 ? (reverseGeocoded[0].city || undefined) : undefined;

      setLocation(address);
      setSessionLocation({ address, latitude, longitude, city });
    } catch (error) {
      // If reverse geocoding fails, use coordinates as address
      const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      setLocation(address);
      setSessionLocation({ address, latitude, longitude });
      if (__DEV__) {
        console.log('Reverse geocoding failed for map pin, using coordinates:', error);
      }
    }
  };

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
    // Collect all validation errors with clear field names
    const errors: string[] = [];

    // Validate user session
    if (!user) {
      errors.push('• User session expired. Please log in again.');
    }

    // Validate children selection
    if (selectedChildren.length === 0) {
      errors.push('• Select at least one child');
    }

    // Validate request mode requirements
    if (requestMode === 'invite' && !selected) {
      errors.push('• Select a sitter (required for Invite mode)');
    }

    if (requestMode === 'nearby' && !maxDistanceKm) {
      errors.push('• Select a search distance (required for Nearby mode)');
    }

    // Validate date/time range
    const start = new Date(startDate);
    start.setHours(startTime.getHours());
    start.setMinutes(startTime.getMinutes());
    start.setSeconds(0);
    start.setMilliseconds(0);
    
    const end = new Date(endDate);
    end.setHours(endTime.getHours());
    end.setMinutes(endTime.getMinutes());
    end.setSeconds(0);
    end.setMilliseconds(0);
    
    if (end <= start) {
      errors.push('• End date/time must be after start date/time');
    }
    
    if (calculatedHours <= 0) {
      errors.push('• Select a valid time period (end time must be after start time)');
    }

    // Validate location
    if (!location || location.trim() === '') {
      errors.push('• Enter a location address');
    }

    // For Nearby mode, location with coordinates is required
    if (requestMode === 'nearby' && (!sessionLocation?.latitude || !sessionLocation?.longitude)) {
      errors.push('• Set GPS coordinates (tap "Open Fullscreen Map" to drop a pin or "Use Current Location")');
    }

    // Validate time slot mode
    if (useTimeSlotMode) {
      const slotEntries = Object.entries(dailyTimeSlots);
      if (slotEntries.length === 0) {
        errors.push('• Configure time slots for at least one day');
      } else {
        // Check if any slot has valid hours
        const validSlots = slotEntries.filter(([_, slot]) => {
          if (typeof slot === 'object' && slot !== null && 'hours' in slot) {
            return (slot.hours || 0) > 0;
          }
          return false;
        });
        
        if (validSlots.length === 0) {
          errors.push('• Set hours greater than 0 for at least one day in Time Slots mode');
        } else {
          // Validate that all slots have valid start and end times
          const invalidSlots = slotEntries.filter(([_, slot]) => {
            if (typeof slot === 'object' && slot !== null) {
              const hasStartTime = slot.startTime && isValid(slot.startTime);
              const hasEndTime = slot.endTime && isValid(slot.endTime);
              return !hasStartTime || !hasEndTime;
            }
            return true;
          });
          
          if (invalidSlots.length > 0) {
            errors.push('• Configure valid start and end times for all days in Time Slots mode');
          }
        }
      }
    }

    // Show all errors at once with better formatting
    if (errors.length > 0) {
      Alert.alert(
        'Missing Required Information',
        'Please complete the following fields:\n\n' + errors.join('\n'),
        [{ text: 'OK', style: 'default' }],
        { cancelable: true }
      );
      return;
    }

    setCreating(true);
    try {
      // Use the calculated start and end date/time
      const startDateTime = new Date(startDate);
      startDateTime.setHours(startTime.getHours());
      startDateTime.setMinutes(startTime.getMinutes());
      startDateTime.setSeconds(0);
      startDateTime.setMilliseconds(0);

      const endDateTime = new Date(endDate);
      endDateTime.setHours(endTime.getHours());
      endDateTime.setMinutes(endTime.getMinutes());
      endDateTime.setSeconds(0);
      endDateTime.setMilliseconds(0);

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

      // Add city for City mode (extract from address)
      if (requestMode === 'city') {
        const city = extractCity(location.trim());
        if (city) {
          locationObj.city = city;
        } else {
          // If we can't extract city, still proceed but log a warning
          console.warn('⚠️ Could not extract city from address for City mode');
        }
      }

      // Create sessions for each selected child
      // If time slot mode is enabled, create separate sessions for each day with configured hours
      const sessionPromises: Promise<any>[] = [];
      
      if (useTimeSlotMode && Object.keys(dailyTimeSlots).length > 0) {
        // Time slot mode: create sessions for each day with configured hours
        selectedChildren.forEach(child => {
          Object.entries(dailyTimeSlots).forEach(([dateStr, slot]) => {
            // Handle both object format { startTime, endTime, hours } and number format
            const slotHours = typeof slot === 'object' && slot !== null && 'hours' in slot 
              ? (slot.hours || 0) 
              : (typeof slot === 'number' ? slot : 0);
            
            if (slotHours > 0) {
              // Use the configured start and end times from the slot if available
              let slotStart: Date;
              let slotEnd: Date;
              
              if (typeof slot === 'object' && slot !== null && 'startTime' in slot && 'endTime' in slot) {
                // Use the configured times from the slot
                slotStart = isValid(slot.startTime) ? new Date(slot.startTime) : new Date(dateStr);
                slotEnd = isValid(slot.endTime) ? new Date(slot.endTime) : new Date(dateStr);
              } else {
                // Fallback: use the date with default start/end times
                const slotDate = parse(dateStr, 'MMM dd, yyyy', new Date());
                slotStart = isValid(slotDate) ? new Date(slotDate) : new Date(dateStr);
                slotStart.setHours(startTime.getHours());
                slotStart.setMinutes(startTime.getMinutes());
                slotStart.setSeconds(0);
                
                slotEnd = new Date(slotStart);
                slotEnd.setHours(slotStart.getHours() + slotHours);
              }
              
              sessionPromises.push(
                createSessionRequest({
                  parentId: user.id,
                  sitterId: requestMode === 'invite' ? selected!.id : '',
                  childId: child.id,
                  status: 'requested',
                  startTime: slotStart,
                  endTime: slotEnd,
                  location: locationObj,
                  hourlyRate: requestMode === 'invite' && rate > 0 ? rate : 0,
                  notes: notes || undefined,
                  searchScope: requestMode,
                  maxDistanceKm: requestMode === 'nearby' ? maxDistanceKm : undefined,
                })
              );
            }
          });
        });
      } else {
        // Continuous mode: create one session per child for the entire time range
        selectedChildren.forEach(child => {
          sessionPromises.push(
            createSessionRequest({
              parentId: user.id,
              sitterId: requestMode === 'invite' ? selected!.id : '',
              childId: child.id,
              status: 'requested',
              startTime: startDateTime,
              endTime: endDateTime,
              location: locationObj,
              hourlyRate: requestMode === 'invite' && rate > 0 ? rate : 0,
              notes: notes || undefined,
              searchScope: requestMode,
              maxDistanceKm: requestMode === 'nearby' ? maxDistanceKm : undefined,
            })
          );
        });
      }

      const sessionResults = await Promise.allSettled(sessionPromises);
      const successfulSessions = sessionResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failedSessions = sessionResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
      
      // Log detailed error information
      if (failedSessions > 0) {
        sessionResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Session ${index + 1} failed with error:`, result.reason);
          } else if (!result.value.success) {
            console.error(`Session ${index + 1} failed:`, result.value.error);
          }
        });
      }

      if (successfulSessions > 0) {
        const successMessage = requestMode === 'invite'
          ? `Your booking request${selectedChildren.length > 1 ? 's have' : ' has'} been sent to ${selected!.displayName}. They will be notified.`
          : requestMode === 'nearby'
          ? `Your session request${selectedChildren.length > 1 ? 's have' : ' has'} been posted. Sitters within ${maxDistanceKm}km will be notified.`
          : requestMode === 'city'
          ? `Your session request${selectedChildren.length > 1 ? 's have' : ' has'} been posted. Sitters in your city will be notified.`
          : `Your session request${selectedChildren.length > 1 ? 's have' : ' has'} been posted. Sitters nationwide will be notified.`;

        const failedDetails = sessionResults
          .map((result, index) => {
            if (result.status === 'rejected') {
              return `Session ${index + 1}: ${result.reason?.message || 'Unknown error'}`;
            } else if (!result.value.success) {
              return `Session ${index + 1}: ${result.value.error?.message || result.value.error?.code || 'Unknown error'}`;
            }
            return null;
          })
          .filter(Boolean)
          .join('\n');
        
        const message = failedSessions > 0
          ? `${successMessage}\n\n⚠️ ${failedSessions} session${failedSessions > 1 ? 's' : ''} failed to create:\n${failedDetails}`
          : successMessage;

        Alert.alert(
          'Request Sent',
          message,
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
                setSelectedChildren([]);
                setRequestMode('invite');
                setMaxDistanceKm(undefined);
                setSessionLocation(null);
                setLocation('');
                setNotes('');
                // Reset date/time fields
                const now = new Date();
                setStartDate(now);
                setStartTime(now);
                setEndDate(now);
                setEndTime(now);
                setUseTimeSlotMode(false);
                setDailyTimeSlots({});
                setCalculatedHours(0);
                setDaysBreakdown([]);
                router.back();
              },
            },
          ]
        );
      } else {
        // All sessions failed - show detailed error
        const errorMessages = sessionResults
          .map((result, index) => {
            if (result.status === 'rejected') {
              return `Session ${index + 1}: ${result.reason?.message || result.reason || 'Unknown error'}`;
            } else if (!result.value.success) {
              const error = result.value.error;
              if (error?.code === 'UNKNOWN_ERROR' && error?.message?.includes('Network request failed')) {
                return `Session ${index + 1}: Cannot connect to server. Please check:\n  • Backend API is running\n  • Network connection is active\n  • API URL is correct`;
              }
              return `Session ${index + 1}: ${error?.message || error?.code || 'Unknown error'}`;
            }
            return null;
          })
          .filter(Boolean)
          .join('\n\n');
        
        Alert.alert(
          'Error',
          failedSessions > 0 
            ? `Failed to create ${failedSessions} session${failedSessions > 1 ? 's' : ''}:\n\n${errorMessages}`
            : 'Failed to create booking request. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Failed to create session:', error);
      const errorMessage = error?.message?.includes('Network') 
        ? 'Cannot connect to server. Please check if the backend API is running and your network connection.'
        : `Failed to create booking request: ${error?.message || 'Unknown error'}`;
      Alert.alert('Error', errorMessage);
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
        {/* Search bar - show for all request modes */}
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
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

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
                  marginBottom: 12,
                }]}>
                  <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.filterInput, { color: colors.text }]}
                    placeholder="Search address or drop pin on map"
                    placeholderTextColor={colors.textSecondary}
                    value={location}
                    onChangeText={setLocation}
                  />
                  {filterGeocodingLoading && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </View>

                {/* Map View in Filter */}
                <View style={[styles.filterMapContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {mapViewAvailable && MapViewComponent && (typeof MapViewComponent === 'function' || typeof MapViewComponent === 'object' && MapViewComponent !== null && 'render' in MapViewComponent) ? (
                      // Native MapView (works in development builds)
                      // Use JSX syntax instead of React.createElement for better type checking
                      (() => {
                        // Validate MapViewComponent is actually a component
                        if (!MapViewComponent || (typeof MapViewComponent !== 'function' && typeof MapViewComponent !== 'object')) {
                          return null;
                        }
                        const MapView = MapViewComponent as any;
                        return (
                          <MapView
                            ref={filterMapRef}
                            style={styles.filterMap}
                            initialRegion={filterMapRegion || {
                              latitude: 6.9271, // Default to Sri Lanka (Colombo)
                              longitude: 79.8612,
                              latitudeDelta: 0.1,
                              longitudeDelta: 0.1,
                            }}
                            region={filterMapRegion || undefined}
                            onRegionChangeComplete={setFilterMapRegion}
                            onPress={async (event: any) => {
                              const { latitude, longitude } = event.nativeEvent.coordinate;
                              try {
                                const reverseGeocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
                                const timeoutPromise = new Promise((_, reject) =>
                                  setTimeout(() => reject(new Error('Reverse geocoding timeout')), 5000)
                                );
                                const reverseGeocoded = await Promise.race([reverseGeocodePromise, timeoutPromise]) as any[];
                                const address = reverseGeocoded && reverseGeocoded.length > 0
                                  ? `${reverseGeocoded[0].street || ''} ${reverseGeocoded[0].streetNumber || ''}, ${reverseGeocoded[0].city || ''}, ${reverseGeocoded[0].region || ''}`.trim()
                                  : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                                const city = reverseGeocoded && reverseGeocoded.length > 0 ? (reverseGeocoded[0].city || undefined) : undefined;
                                setLocation(address);
                                setFilterLocation({ address, latitude, longitude, city });
                              } catch (error) {
                                const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                                setLocation(address);
                                setFilterLocation({ address, latitude, longitude });
                              }
                            }}
                            showsUserLocation={false}
                            showsMyLocationButton={false}
                            showsCompass={true}
                            showsScale={true}
                          >
                            {filterLocation?.latitude && filterLocation?.longitude && MarkerComponent && typeof MarkerComponent !== 'object' ? (
                              (() => {
                                const Marker = MarkerComponent as any;
                                return (
                                  <Marker
                                    coordinate={{
                                      latitude: filterLocation.latitude,
                                      longitude: filterLocation.longitude,
                                    }}
                                    title="Filter Location"
                                    description={filterLocation.address}
                                    pinColor={colors.primary}
                                  />
                                );
                              })()
                            ) : null}
                          </MapView>
                        );
                      })()
                    ) : (
                      // WebView-based map (works in Expo Go)
                      <WebMapView
                        initialRegion={filterMapRegion || {
                          latitude: 6.9271,
                          longitude: 79.8612,
                          latitudeDelta: 0.1,
                          longitudeDelta: 0.1,
                        }}
                        region={filterMapRegion || undefined}
                        onRegionChangeComplete={setFilterMapRegion}
                        onPress={async (coordinate: { latitude: number; longitude: number }) => {
                          const { latitude, longitude } = coordinate;
                          try {
                            const reverseGeocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
                            const timeoutPromise = new Promise((_, reject) =>
                              setTimeout(() => reject(new Error('Reverse geocoding timeout')), 5000)
                            );
                            const reverseGeocoded = await Promise.race([reverseGeocodePromise, timeoutPromise]) as any[];
                            const address = reverseGeocoded && reverseGeocoded.length > 0
                              ? `${reverseGeocoded[0].street || ''} ${reverseGeocoded[0].streetNumber || ''}, ${reverseGeocoded[0].city || ''}, ${reverseGeocoded[0].region || ''}`.trim()
                              : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                            const city = reverseGeocoded && reverseGeocoded.length > 0 ? (reverseGeocoded[0].city || undefined) : undefined;
                            setLocation(address);
                            setFilterLocation({ address, latitude, longitude, city });
                          } catch (error) {
                            const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                            setLocation(address);
                            setFilterLocation({ address, latitude, longitude });
                          }
                        }}
                        marker={filterLocation?.latitude && filterLocation?.longitude ? {
                          latitude: filterLocation.latitude,
                          longitude: filterLocation.longitude,
                          title: "Filter Location",
                          description: filterLocation.address,
                        } : null}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        showsCompass={true}
                        showsScale={true}
                        style={styles.filterMap}
                      />
                    )}
                  </View>
                )}

                {location && (
                  <View style={[styles.filterSelectedValue, { backgroundColor: colors.primary + '15', marginTop: 12 }]}>
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

            {/* Child Selection - Multiple Selection */}
            <Text style={[styles.label, { color: colors.text }]}>Select Child(ren) *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childPicker}>
              {children
                .filter((child, index, self) => 
                  index === self.findIndex((c) => c.id === child.id)
                )
                .map((child) => {
                const isSelected = selectedChildren.some(c => c.id === child.id);
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.childOption,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.white,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedChildren(selectedChildren.filter(c => c.id !== child.id));
                      } else {
                        setSelectedChildren([...selectedChildren, child]);
                      }
                    }}
                  >
                    {child.photoUrl ? (
                      <Image source={{ uri: child.photoUrl }} style={styles.childAvatar} />
                    ) : (
                      <View style={[styles.childAvatar, { backgroundColor: colors.border }]}>
                        <Ionicons name="person" size={20} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.childSelectionIndicator}>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.childName,
                        {
                          color: isSelected ? colors.white : colors.text,
                        },
                      ]}
                    >
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Booking Mode Toggle */}
            <View style={[styles.bookingModeContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Text style={[styles.bookingModeLabel, { color: colors.text }]}>Booking Mode</Text>
              <View style={styles.bookingModeToggle}>
                <TouchableOpacity
                  style={[
                    styles.bookingModeOption,
                    { 
                      backgroundColor: !useTimeSlotMode ? colors.primary : colors.white,
                      borderColor: !useTimeSlotMode ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setUseTimeSlotMode(false)}
                >
                  <Text style={[
                    styles.bookingModeOptionText,
                    { color: !useTimeSlotMode ? colors.white : colors.text }
                  ]}>
                    Continuous
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.bookingModeOption,
                    { 
                      backgroundColor: useTimeSlotMode ? colors.primary : colors.white,
                      borderColor: useTimeSlotMode ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setUseTimeSlotMode(true)}
                >
                  <Text style={[
                    styles.bookingModeOptionText,
                    { color: useTimeSlotMode ? colors.white : colors.text }
                  ]}>
                    Time Slots
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Start Date/Time */}
            <Text style={[styles.label, { color: colors.text }]}>Start Date & Time *</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.inputRow, { backgroundColor: colors.white, flex: 1, marginRight: 8 }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={colors.text} style={styles.icon} />
                <Text style={[styles.inputFlex, { color: colors.text }]}>
                  {format(startDate, 'MMM dd, yyyy')}
                </Text>
              </TouchableOpacity>
              {showStartDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowStartDatePicker(false);
                    if (date && event.type !== 'dismissed') {
                      setStartDate(date);
                    }
                  }}
                />
              )}
              <TouchableOpacity
                style={[styles.inputRow, { backgroundColor: colors.white, flex: 1, marginLeft: 8 }]}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Ionicons name="time" size={20} color={colors.text} style={styles.icon} />
                <Text style={[styles.inputFlex, { color: colors.text }]}>
                  {format(startTime, 'h:mm a')}
                </Text>
              </TouchableOpacity>
              {showStartTimePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display="default"
                  onChange={(event, time) => {
                    setShowStartTimePicker(false);
                    if (time && event.type !== 'dismissed') {
                      setStartTime(time);
                    }
                  }}
                />
              )}
            </View>

            {/* End Date/Time */}
            <Text style={[styles.label, { color: colors.text }]}>End Date & Time *</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.inputRow, { backgroundColor: colors.white, flex: 1, marginRight: 8 }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={colors.text} style={styles.icon} />
                <Text style={[styles.inputFlex, { color: colors.text }]}>
                  {format(endDate, 'MMM dd, yyyy')}
                </Text>
              </TouchableOpacity>
              {showEndDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  minimumDate={(() => {
                    // If end date is same as start date, allow same day but ensure end time is after start time
                    const minDate = new Date(startDate);
                    return minDate;
                  })()}
                  onChange={(event, date) => {
                    setShowEndDatePicker(false);
                    if (date && event.type !== 'dismissed') {
                      setEndDate(date);
                      // If end date is same as start date, ensure end time is after start time
                      if (date.getTime() === startDate.getTime() && endTime <= startTime) {
                        const newEndTime = new Date(startTime);
                        newEndTime.setHours(newEndTime.getHours() + 1);
                        setEndTime(newEndTime);
                      }
                    }
                  }}
                />
              )}
              <TouchableOpacity
                style={[styles.inputRow, { backgroundColor: colors.white, flex: 1, marginLeft: 8 }]}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Ionicons name="time" size={20} color={colors.text} style={styles.icon} />
                <Text style={[styles.inputFlex, { color: colors.text }]}>
                  {format(endTime, 'h:mm a')}
                </Text>
              </TouchableOpacity>
              {showEndTimePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  display="default"
                  onChange={(event, time) => {
                    setShowEndTimePicker(false);
                    if (time && event.type !== 'dismissed') {
                      setEndTime(time);
                    }
                  }}
                />
              )}
            </View>

            {/* Calculated Duration Display */}
            {!useTimeSlotMode ? (
              // Continuous Mode: Show simple date range
              <View style={[styles.durationDisplay, { 
                backgroundColor: calculatedHours > 0 ? colors.backgroundSecondary : colors.warning + '20', 
                borderColor: calculatedHours > 0 ? colors.border : colors.warning 
              }]}>
                <Ionicons 
                  name="calendar" 
                  size={20} 
                  color={calculatedHours > 0 ? colors.primary : colors.warning} 
                />
                <View style={styles.durationTextContainer}>
                  {calculatedHours > 0 ? (
                    <>
                      <Text style={[styles.durationText, { color: colors.text }]}>
                        {Math.ceil(calculatedHours / 24)} day{Math.ceil(calculatedHours / 24) > 1 ? 's' : ''}
                      </Text>
                      <Text style={[styles.durationSubtext, { color: colors.textSecondary }]}>
                        From {format(startDate, 'MMM dd, yyyy')} to {format(endDate, 'MMM dd, yyyy')}
                      </Text>
                      <Text style={[styles.durationSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
                        {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')} ({calculatedHours.toFixed(1)} hours total)
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.durationText, { color: colors.warning }]}>
                      Please select valid start and end times
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              // Time Slots Mode: Show date range and per-day time configuration
              <>
                <View style={[styles.durationDisplay, { 
                  backgroundColor: calculatedHours > 0 ? colors.backgroundSecondary : colors.warning + '20', 
                  borderColor: calculatedHours > 0 ? colors.border : colors.warning 
                }]}>
                  <Ionicons 
                    name="calendar" 
                    size={20} 
                    color={calculatedHours > 0 ? colors.primary : colors.warning} 
                  />
                  <View style={styles.durationTextContainer}>
                    {calculatedHours > 0 && daysBreakdown.length > 0 ? (
                      <>
                        <Text style={[styles.durationText, { color: colors.text }]}>
                          From {format(startDate, 'MMM dd, yyyy')} to {format(endDate, 'MMM dd, yyyy')}
                        </Text>
                        <Text style={[styles.durationSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
                          {calculatedHours.toFixed(1)} hours total across {daysBreakdown.length} day{daysBreakdown.length > 1 ? 's' : ''}
                        </Text>
                        {(() => {
                          // Calculate hours per day from configured slots
                          const slotHours = Object.values(dailyTimeSlots)
                            .map(s => s?.hours || 0)
                            .filter(h => h > 0);
                          
                          if (slotHours.length === 0) {
                            // No slots configured yet, show average
                            const avgHoursPerDay = calculatedHours / daysBreakdown.length;
                            if (avgHoursPerDay > 0) {
                              return (
                                <Text style={[styles.durationSubtext, { color: colors.textSecondary, marginTop: 2 }]}>
                                  ~{avgHoursPerDay.toFixed(1)} hours per day
                                </Text>
                              );
                            }
                            return null;
                          }
                          
                          const minHours = Math.min(...slotHours);
                          const maxHours = Math.max(...slotHours);
                          
                          let hoursPerDayText = '';
                          if (minHours === maxHours) {
                            hoursPerDayText = `${minHours.toFixed(1)} hours per day`;
                          } else {
                            hoursPerDayText = `${minHours.toFixed(1)} to ${maxHours.toFixed(1)} hours per day`;
                          }
                          
                          return (
                            <Text style={[styles.durationSubtext, { color: colors.textSecondary, marginTop: 2 }]}>
                              {hoursPerDayText}
                            </Text>
                          );
                        })()}
                      </>
                    ) : (
                      <Text style={[styles.durationText, { color: colors.warning }]}>
                        Please select start and end dates
                      </Text>
                    )}
                  </View>
                </View>

                {/* Time Slots Configuration - Per Day Time Selection */}
                {daysBreakdown.length > 0 && (
                  <View style={[styles.timeSlotsContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.timeSlotsTitle, { color: colors.text }]}>
                      Configure Time Per Day
                    </Text>
                    <Text style={[styles.timeSlotsSubtitle, { color: colors.textSecondary }]}>
                      Set start and end time for each day {daysBreakdown.length > 5 && `(${daysBreakdown.length} days total)`}
                    </Text>
                    <ScrollView 
                      style={styles.timeSlotsScrollView}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      {daysBreakdown.map((day, index) => {
                      const slot = dailyTimeSlots[day.date];
                      if (!slot) return null;
                      
                      // Validate dates before using them
                      const slotStartTime = slot.startTime && isValid(slot.startTime) ? slot.startTime : new Date();
                      const slotEndTime = slot.endTime && isValid(slot.endTime) ? slot.endTime : new Date();
                      const slotHours = slot.hours || 0;
                      const showStart = slotTimePickers[day.date]?.showStart || false;
                      const showEnd = slotTimePickers[day.date]?.showEnd || false;
                      
                      // Ensure dates are valid Date objects
                      const startTimeForDisplay = isValid(slotStartTime) ? slotStartTime : new Date();
                      const endTimeForDisplay = isValid(slotEndTime) ? slotEndTime : new Date();
                      
                      return (
                        <View key={index} style={[styles.timeSlotDayContainer, { borderBottomColor: colors.border }]}>
                          <Text style={[styles.timeSlotDayLabel, { color: colors.text }]}>{day.date}</Text>
                          <View style={styles.timeSlotTimeRow}>
                            <TouchableOpacity
                              style={[styles.timeSlotTimeButton, { backgroundColor: colors.white, borderColor: colors.border }]}
                              onPress={() => setSlotTimePickers(prev => ({
                                ...prev,
                                [day.date]: { showStart: true, showEnd: false },
                              }))}
                            >
                              <Ionicons name="time" size={16} color={colors.text} />
                              <Text style={[styles.timeSlotTimeText, { color: colors.text }]}>
                                {isValid(startTimeForDisplay) ? format(startTimeForDisplay, 'h:mm a') : '--:--'}
                              </Text>
                            </TouchableOpacity>
                            {showStart && Platform.OS !== 'web' && (
                              <DateTimePicker
                                value={isValid(startTimeForDisplay) ? startTimeForDisplay : new Date()}
                                mode="time"
                                display="default"
                                onChange={(event, time) => {
                                  setSlotTimePickers(prev => ({
                                    ...prev,
                                    [day.date]: { showStart: false, showEnd: false },
                                  }));
                                  if (time && event.type !== 'dismissed' && isValid(time)) {
                                    const validEndTime = isValid(endTimeForDisplay) ? endTimeForDisplay : new Date();
                                    const newSlot = {
                                      startTime: time,
                                      endTime: validEndTime,
                                      hours: 0,
                                    };
                                    // Calculate hours
                                    const start = new Date(time);
                                    const end = new Date(validEndTime);
                                    if (isValid(start) && isValid(end) && end > start) {
                                      newSlot.hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                    }
                                    setDailyTimeSlots(prev => {
                                      const updated = { ...prev, [day.date]: newSlot };
                                      // Recalculate total
                                      const newTotal = Object.values(updated)
                                        .reduce((sum, s) => sum + (s.hours || 0), 0);
                                      setCalculatedHours(newTotal);
                                      return updated;
                                    });
                                  }
                                }}
                              />
                            )}
                            <Text style={[styles.timeSlotTo, { color: colors.textSecondary }]}>to</Text>
                            <TouchableOpacity
                              style={[styles.timeSlotTimeButton, { backgroundColor: colors.white, borderColor: colors.border }]}
                              onPress={() => setSlotTimePickers(prev => ({
                                ...prev,
                                [day.date]: { showStart: false, showEnd: true },
                              }))}
                            >
                              <Ionicons name="time" size={16} color={colors.text} />
                              <Text style={[styles.timeSlotTimeText, { color: colors.text }]}>
                                {isValid(endTimeForDisplay) ? format(endTimeForDisplay, 'h:mm a') : '--:--'}
                              </Text>
                            </TouchableOpacity>
                            {showEnd && Platform.OS !== 'web' && (
                              <DateTimePicker
                                value={isValid(endTimeForDisplay) ? endTimeForDisplay : new Date()}
                                mode="time"
                                display="default"
                                onChange={(event, time) => {
                                  setSlotTimePickers(prev => ({
                                    ...prev,
                                    [day.date]: { showStart: false, showEnd: false },
                                  }));
                                  if (time && event.type !== 'dismissed' && isValid(time)) {
                                    const validStartTime = isValid(startTimeForDisplay) ? startTimeForDisplay : new Date();
                                    const newSlot = {
                                      startTime: validStartTime,
                                      endTime: time,
                                      hours: 0,
                                    };
                                    // Calculate hours
                                    const start = new Date(validStartTime);
                                    const end = new Date(time);
                                    if (isValid(start) && isValid(end) && end > start) {
                                      newSlot.hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                    }
                                    setDailyTimeSlots(prev => {
                                      const updated = { ...prev, [day.date]: newSlot };
                                      // Recalculate total
                                      const newTotal = Object.values(updated)
                                        .reduce((sum, s) => sum + (s.hours || 0), 0);
                                      setCalculatedHours(newTotal);
                                      return updated;
                                    });
                                  }
                                }}
                              />
                            )}
                            <Text style={[styles.timeSlotHours, { color: colors.primary }]}>
                              ({slotHours.toFixed(1)} hrs)
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {/* Location Card with Map */}
            <View style={styles.locationHeader}>
              <Text style={[styles.label, { color: colors.text }]}>Location *</Text>
              {requestMode === 'nearby' && (
                <Text style={[styles.locationHint, { color: colors.textSecondary }]}>
                  GPS coordinates required for distance calculation
                </Text>
              )}
            </View>
            <Card style={styles.locationCard}>
              {/* Address Search Input */}
              <View style={[styles.inputRow, { backgroundColor: colors.white, marginBottom: 12 }]}>
                <Ionicons name="location" size={20} color={colors.text} style={styles.icon} />
                <TextInput
                  style={[styles.inputFlex, { color: colors.text }]}
                  placeholder="Search address or drop pin on map"
                  placeholderTextColor={colors.textSecondary}
                  value={location}
                  onChangeText={setLocation}
                />
                {geocodingLoading && (
                  <ActivityIndicator size="small" color={colors.primary} style={styles.icon} />
                )}
              </View>

              {/* Use Current Location Button */}
              <Pressable
                style={[styles.currentLocationButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                onPress={handleGetCurrentLocation}
                hitSlop={8}
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="locate" size={18} color={colors.primary} />
                    <Text style={[styles.currentLocationText, { color: colors.primary }]}>
                      Use Current Location
                    </Text>
                  </>
                )}
              </Pressable>

              {/* Map View - Always show for location selection */}
              <View style={[styles.mapContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {/* Show map thumbnail or placeholder */}
                {sessionLocation?.latitude && sessionLocation?.longitude ? (
                  <TouchableOpacity
                    style={styles.mapThumbnail}
                    onPress={() => setFullscreenMapVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{
                        uri: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+FF0000(${sessionLocation.longitude},${sessionLocation.latitude})/${sessionLocation.longitude},${sessionLocation.latitude},15/300x200@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`
                      }}
                      style={styles.mapThumbnailImage}
                      onError={(error) => {
                        console.warn('Mapbox thumbnail failed, using OpenStreetMap fallback');
                      }}
                    />
                    <View style={[styles.mapThumbnailOverlay, { backgroundColor: colors.primary + '20' }]}>
                      <View style={[styles.mapThumbnailBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="location" size={16} color={colors.white} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.mapPreview}>
                    <View style={styles.mapPreviewContent}>
                      <Ionicons name="location-outline" size={48} color={colors.textSecondary} />
                      <Text style={[styles.mapPreviewText, { color: colors.textSecondary }]}>
                        No location selected
                      </Text>
                      <Text style={[styles.mapPreviewHint, { color: colors.textSecondary }]}>
                        Tap "Open Fullscreen Map" to select location
                      </Text>
                    </View>
                  </View>
                )}
                
                {/* Fullscreen Map Button */}
                <TouchableOpacity
                  style={[styles.fullscreenMapButton, { backgroundColor: colors.primary }]}
                  onPress={() => setFullscreenMapVisible(true)}
                  hitSlop={8}
                >
                  <Ionicons name="expand" size={20} color={colors.white} />
                  <Text style={[styles.fullscreenMapButtonText, { color: colors.white }]}>
                    Open Fullscreen Map
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Location Info Card */}
              {sessionLocation && (
                <View style={[styles.locationInfoCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.locationInfoRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <View style={styles.locationInfoTextContainer}>
                      <Text style={[styles.locationInfoAddress, { color: colors.text }]} numberOfLines={2}>
                        {sessionLocation.address}
                      </Text>
                      {sessionLocation.city && (
                        <Text style={[styles.locationInfoCity, { color: colors.textSecondary }]}>
                          {sessionLocation.city}
                        </Text>
                      )}
                      {sessionLocation.latitude && sessionLocation.longitude && (
                        <Text style={[styles.locationInfoCoords, { color: colors.textSecondary }]}>
                          {sessionLocation.latitude.toFixed(6)}, {sessionLocation.longitude.toFixed(6)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </Card>

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
                Total: {total.toFixed(2)} LKR
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
                { 
                  backgroundColor: creating ? colors.border : colors.primary,
                  opacity: creating ? 0.6 : 1,
                },
              ]}
              onPress={handleConfirmBooking}
              disabled={creating}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

      {/* Fullscreen Map Modal */}
      <FullscreenMapModal
        visible={fullscreenMapVisible}
        onClose={() => setFullscreenMapVisible(false)}
        initialLocation={sessionLocation ? {
          latitude: sessionLocation.latitude!,
          longitude: sessionLocation.longitude!,
          address: sessionLocation.address,
        } : undefined}
        onLocationSelect={(location) => {
          setLocation(location.address);
          setSessionLocation({
            address: location.address,
            latitude: location.latitude,
            longitude: location.longitude,
            city: location.city,
          });
          setMapRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }}
      />
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
    top: 80,
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
    maxHeight: '90%',
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
  // Location Card Styles
  locationCard: {
    marginBottom: 16,
    padding: 12,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1,
    minHeight: 250,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 250,
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  mapPlaceholderSubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 8,
  },
  currentLocationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationInfoCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  locationInfoTextContainer: {
    flex: 1,
  },
  locationInfoAddress: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationInfoCity: {
    fontSize: 12,
    marginBottom: 2,
  },
  locationInfoCoords: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  locationHeader: {
    marginBottom: 8,
  },
  locationHint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  fullscreenMapButton: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        }),
  },
  fullscreenMapButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterMapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
  },
  filterMap: {
    flex: 1,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 16,
  },
  durationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  durationTextContainer: {
    flex: 1,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '600',
  },
  durationDaysText: {
    fontSize: 13,
    marginTop: 2,
  },
  bookingModeContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  bookingModeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  bookingModeToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  bookingModeOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  bookingModeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeSlotsContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  timeSlotsScrollView: {
    maxHeight: 300, // Limit height to show ~5 days, then scrollable
  },
  timeSlotsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeSlotsSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  timeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  timeSlotDate: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  timeSlotInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minWidth: 120,
  },
  timeSlotInput: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  timeSlotUnit: {
    fontSize: 12,
  },
  timeSlotDayContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  timeSlotDayLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  timeSlotTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  timeSlotTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  timeSlotTimeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeSlotTo: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeSlotHours: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  durationSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  mapPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  mapPreviewContent: {
    alignItems: 'center',
    padding: 20,
  },
  mapPreviewText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  mapPreviewAddress: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '90%',
  },
  mapPreviewCoords: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  mapPreviewHint: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  mapThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mapThumbnailImage: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  mapThumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapThumbnailBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }),
  },
  mapThumbnailFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: 8,
  },
  mapThumbnailText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  daysBreakdown: {
    marginTop: 8,
    gap: 4,
  },
  daysBreakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  daysBreakdownItem: {
    fontSize: 12,
    marginLeft: 8,
  },
  childSelectionIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
  },
});
