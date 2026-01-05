import * as Location from 'expo-location';
import { ServiceResult } from '@/src/types/error.types';
import { LocationUpdate } from '@/src/types/session.types';
import { updateDocument } from './firestore.service';
import { COLLECTIONS, LOCATION_UPDATE_INTERVAL } from '@/src/config/constants';
import { ErrorCode } from '@/src/types/error.types';

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
 * Update session location in Firestore
 */
export async function updateSessionLocation(
  sessionId: string,
  location: LocationUpdate
): Promise<ServiceResult<void>> {
  try {
    // Get current session
    const { getDocument } = await import('./firestore.service');
    const sessionResult = await getDocument(COLLECTIONS.SESSIONS, sessionId);
    
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND' as any,
          message: 'Session not found',
        },
      };
    }

    const session = sessionResult.data as any;
    const locations = session.location || [];
    locations.push(location);

    return updateDocument(COLLECTIONS.SESSIONS, sessionId, {
      location: locations,
    });
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
