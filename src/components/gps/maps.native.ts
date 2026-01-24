/**
 * Native-only map imports
 * This file is only used on iOS/Android, not on web
 * DO NOT require at module level to avoid codegenNativeCommands errors
 */

// Lazy load function - only loads when called
let MapViewDefault: any = null;
let Marker: any = null;
let Polyline: any = null;
let Circle: any = null;
let mapsLoaded = false;
let mapsLoadFailed = false; // Track if loading failed to prevent retries

// Check if running in Expo Go (where native modules don't work)
// Cache the result to avoid repeated checks
let expoGoCheckDone = false;
let isExpoGoResult = false;

const isExpoGo = (): boolean => {
  if (expoGoCheckDone) {
    return isExpoGoResult;
  }
  
  try {
    // Use expo-constants to detect Expo Go
    const Constants = require('expo-constants');
    isExpoGoResult = (
      Constants.executionEnvironment === 'storeClient' ||
      Constants.executionEnvironment === 'standalone' && Constants.appOwnership === 'expo' ||
      (Constants.executionEnvironment === undefined && Constants.appOwnership === 'expo')
    );
    expoGoCheckDone = true;
    return isExpoGoResult;
  } catch {
    // If expo-constants is not available, assume we're in Expo Go to be safe
    isExpoGoResult = true;
    expoGoCheckDone = true;
    return true;
  }
};

const loadMapsModule = () => {
  // If loading previously failed, return null immediately without trying again
  if (mapsLoadFailed) {
    return { MapView: null, Marker: null, Polyline: null, Circle: null };
  }
  
  // If already loaded successfully, return cached components
  if (mapsLoaded && MapViewDefault !== null) {
    return { MapView: MapViewDefault, Marker, Polyline, Circle };
  }

  // CRITICAL: Skip require entirely if in Expo Go to prevent codegenNativeCommands error
  // Check BEFORE any require() calls
  const inExpoGo = isExpoGo();
  if (inExpoGo) {
    mapsLoadFailed = true;
    mapsLoaded = true;
    console.warn('⚠️ Skipping react-native-maps: Expo Go detected (native modules not supported)');
    console.warn('💡 Use a development build (expo run:android/ios) to enable native maps');
    return { MapView: null, Marker: null, Polyline: null, Circle: null };
  }

  // Try to load the module
  try {
    // Only require when explicitly called, not at module load
    // This will throw codegenNativeCommands error in Expo Go - we catch it below
    // Double-check before requiring (defensive programming)
    const expoGoCheck = isExpoGo();
    if (expoGoCheck) {
      mapsLoadFailed = true;
      mapsLoaded = true;
      console.warn('⚠️ Skipping react-native-maps: Expo Go detected (double-check)');
      return { MapView: null, Marker: null, Polyline: null, Circle: null };
    }
    
    // Additional safety: wrap require in try-catch to catch codegenNativeCommands error
    let mapsModule: any;
    try {
      mapsModule = require('react-native-maps');
    } catch (requireError: any) {
      // If require itself fails (codegenNativeCommands), mark as failed
      if (requireError?.message?.includes('codegenNativeCommands') || 
          requireError?.message?.includes('is not a function')) {
        mapsLoadFailed = true;
        mapsLoaded = true;
        console.warn('⚠️ react-native-maps require failed (codegenNativeCommands):', requireError?.message);
        console.warn('💡 This is expected in Expo Go - use a development build for native maps');
        return { MapView: null, Marker: null, Polyline: null, Circle: null };
      }
      throw requireError; // Re-throw if it's a different error
    }
    
    // Check if the module is actually available
    if (!mapsModule) {
      throw new Error('react-native-maps module is undefined');
    }
    
    // Try to access the components - this might throw codegenNativeCommands error
    try {
      MapViewDefault = mapsModule.default || mapsModule;
      Marker = mapsModule.Marker;
      Polyline = mapsModule.Polyline;
      Circle = mapsModule.Circle;
      
      // Validate that we got valid components
      if (!MapViewDefault) {
        throw new Error('MapView component not found in react-native-maps');
      }
      
      mapsLoaded = true;
      return { MapView: MapViewDefault, Marker, Polyline, Circle };
    } catch (componentError: any) {
      // Error accessing components (codegenNativeCommands)
      throw new Error(`Failed to access map components: ${componentError?.message || componentError}`);
    }
  } catch (error: any) {
    // Mark as failed to prevent repeated attempts
    mapsLoadFailed = true;
    mapsLoaded = true;
    MapViewDefault = null;
    Marker = null;
    Polyline = null;
    Circle = null;
    
    // Only log warning, don't throw - allow app to continue
    console.warn('⚠️ react-native-maps not available:', error?.message || error);
    console.warn('💡 Note: Native maps require a development build and do not work in Expo Go');
    console.warn('💡 The app will continue using WebView-based maps as fallback');
    return { MapView: null, Marker: null, Polyline: null, Circle: null };
  }
};

// Export getters that lazy-load with error handling
export const getMapView = () => {
  try {
    return loadMapsModule().MapView;
  } catch (error: any) {
    console.warn('⚠️ getMapView failed:', error?.message || error);
    return null;
  }
};

export const getMarker = () => {
  try {
    return loadMapsModule().Marker;
  } catch (error: any) {
    console.warn('⚠️ getMarker failed:', error?.message || error);
    return null;
  }
};

export const getPolyline = () => {
  try {
    return loadMapsModule().Polyline;
  } catch (error: any) {
    console.warn('⚠️ getPolyline failed:', error?.message || error);
    return null;
  }
};

export const getCircle = () => {
  try {
    return loadMapsModule().Circle;
  } catch (error: any) {
    console.warn('⚠️ getCircle failed:', error?.message || error);
    return null;
  }
};

// For backward compatibility, export null initially
// Components should use getMapView() etc. or check if null
export const MapView = null;
// Note: Marker, Polyline, and Circle are declared as let variables above
// and should be accessed via getMarker(), getPolyline(), getCircle()
