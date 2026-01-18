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

const loadMapsModule = () => {
  // If loading previously failed, return null immediately without trying again
  if (mapsLoadFailed) {
    return { MapView: null, Marker: null, Polyline: null, Circle: null };
  }
  
  // If already loaded successfully, return cached components
  if (mapsLoaded && MapViewDefault !== null) {
    return { MapView: MapViewDefault, Marker, Polyline, Circle };
  }

  // Try to load the module
  try {
    // Only require when explicitly called, not at module load
    // This will throw codegenNativeCommands error in Expo Go - we catch it below
    const mapsModule = require('react-native-maps');
    
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
