/**
 * Location Service - REST API
 * Handles location tracking and updates
 */
import * as Location from 'expo-location';
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { LOCATION_UPDATE_INTERVAL, API_ENDPOINTS } from '@/src/config/constants';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { LocationUpdate } from '@/src/types/session.types';
import { apiRequest } from './api-base.service';

/**
 * Request location permissions
 */
export async function requestLocationPermission(): Promise<ServiceResult<boolean>> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      return {
        success: false,
        error: {
          code: ErrorCode.LOCATION_PERMISSION_DENIED,
          message: 'Location permission is required',
        },
      };
    }

    return { success: true, data: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.LOCATION_ERROR,
        message: 'Failed to request location permission',
      },
    };
  }
}

/**
 * Get current location
 */
export async function getCurrentLocation(): Promise<ServiceResult<LocationUpdate>> {
  try {
    const permissionResult = await requestLocationPermission();
    if (!permissionResult.success) {
      return permissionResult;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const locationUpdate: LocationUpdate = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: new Date(),
    };

    return { success: true, data: locationUpdate };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.LOCATION_ERROR,
        message: 'Failed to get current location',
      },
    };
  }
}

/**
 * Update session location via API
 */
export async function updateSessionLocation(
  sessionId: string,
  location: LocationUpdate
): Promise<ServiceResult<void>> {
  try {
    const apiData = {
      sessionId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || undefined,
      speed: location.speed || undefined,
      heading: undefined, // Not in LocationUpdate type
    };

    const result = await apiRequest<any>(API_ENDPOINTS.GPS_TRACK, {
      method: 'POST',
      body: JSON.stringify(apiData),
    });

    if (!result.success) {
      return result;
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: ErrorCode.LOCATION_ERROR,
        message: 'Failed to update session location',
      },
    };
  }
}

/**
 * Start location tracking for a session
 */
export function startLocationTracking(
  sessionId: string,
  onLocationUpdate: (location: LocationUpdate) => void,
  interval: number = LOCATION_UPDATE_INTERVAL
): () => void {
  let intervalId: NodeJS.Timeout | null = null;

  const updateLocation = async () => {
    const result = await getCurrentLocation();
    if (result.success && result.data) {
      onLocationUpdate(result.data);
      await updateSessionLocation(sessionId, result.data);
    }
  };

  // Start tracking
  updateLocation(); // Initial update
  intervalId = setInterval(updateLocation, interval);

  // Return stop function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}
