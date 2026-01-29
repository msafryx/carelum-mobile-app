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
    
    // More comprehensive Expo Go detection
    const isStoreClient = Constants.executionEnvironment === 'storeClient';
    const isExpoOwned = Constants.appOwnership === 'expo';
    const isStandaloneExpo = Constants.executionEnvironment === 'standalone' && isExpoOwned;
    const isUndefinedExpo = Constants.executionEnvironment === undefined && isExpoOwned;
    
    // Also check if we're in a development environment that might not support native modules
    const isDev = __DEV__ === true;
    
    // If any of these conditions are true, we're likely in Expo Go
    isExpoGoResult = isStoreClient || isStandaloneExpo || isUndefinedExpo || (isDev && isExpoOwned);
    
    expoGoCheckDone = true;
    
    if (isExpoGoResult) {
      console.log('🔍 Expo Go detected - native maps will be disabled');
    }
    
    return isExpoGoResult;
  } catch (error: any) {
    // If expo-constants is not available, assume we're in Expo Go to be safe
    // This prevents trying to load native modules that might not be available
    console.warn('⚠️ Could not check Expo Go status, assuming Expo Go (safe fallback):', error?.message);
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
  // Check BEFORE any require() calls - do this FIRST
  try {
    const inExpoGo = isExpoGo();
    if (inExpoGo) {
      mapsLoadFailed = true;
      mapsLoaded = true;
      console.warn('⚠️ Skipping react-native-maps: Expo Go detected (native modules not supported)');
      console.warn('💡 Use a development build (expo run:android/ios) to enable native maps');
      return { MapView: null, Marker: null, Polyline: null, Circle: null };
    }
  } catch (expoCheckError: any) {
    // If Expo Go check fails, assume we're in Expo Go to be safe
    mapsLoadFailed = true;
    mapsLoaded = true;
    console.warn('⚠️ Expo Go check failed, assuming Expo Go (safe fallback):', expoCheckError?.message);
    return { MapView: null, Marker: null, Polyline: null, Circle: null };
  }

  // Try to load the module - but be VERY defensive
  try {
    // Double-check before requiring (defensive programming)
    const expoGoCheck = isExpoGo();
    if (expoGoCheck) {
      mapsLoadFailed = true;
      mapsLoaded = true;
      console.warn('⚠️ Skipping react-native-maps: Expo Go detected (double-check)');
      return { MapView: null, Marker: null, Polyline: null, Circle: null };
    }
    
    // CRITICAL: Use a function that can catch errors during require() evaluation
    // The require() call itself can throw during module evaluation, so we need
    // to wrap it in a way that catches errors at the evaluation level
    let mapsModule: any = null;
    
    // Use a separate function to isolate the require() call
    const safeRequireMaps = (): any => {
      try {
        // This is where the error happens - require() throws during evaluation
        // We need to catch it here before it propagates
        const module = require('react-native-maps');
        return module;
      } catch (requireError: any) {
        // Catch any error during require() - including codegenNativeCommands
        const errorMsg = requireError?.message || String(requireError) || 'Unknown error';
        const errorName = requireError?.name || '';
        
        // Check for codegenNativeCommands errors
        if (errorMsg.includes('codegenNativeCommands') || 
            errorMsg.includes('is not a function') ||
            errorMsg.includes('undefined') ||
            errorName === 'TypeError') {
          // This is expected in Expo Go - don't throw, just return null
          throw new Error(`codegenNativeCommands: ${errorMsg}`);
        }
        // Re-throw other errors
        throw requireError;
      }
    };
    
    // Call the safe require function
    try {
      mapsModule = safeRequireMaps();
    } catch (requireError: any) {
      // If require itself fails (codegenNativeCommands), mark as failed
      const errorMsg = requireError?.message || String(requireError);
      if (errorMsg.includes('codegenNativeCommands') || 
          errorMsg.includes('is not a function') ||
          errorMsg.includes('undefined')) {
        mapsLoadFailed = true;
        mapsLoaded = true;
        console.warn('⚠️ react-native-maps require failed (codegenNativeCommands):', errorMsg);
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
      // Access components with additional error checking
      if (typeof mapsModule === 'undefined' || mapsModule === null) {
        throw new Error('react-native-maps module is null or undefined');
      }
      
      MapViewDefault = mapsModule.default || mapsModule;
      Marker = mapsModule.Marker;
      Polyline = mapsModule.Polyline;
      Circle = mapsModule.Circle;
      
      // Check if codegenNativeCommands error occurred during component access
      if (typeof MapViewDefault === 'undefined' || MapViewDefault === null) {
        throw new Error('MapView component is undefined - codegenNativeCommands may have failed');
      }
      
      // Try to access a property to trigger any codegenNativeCommands errors early
      if (typeof MapViewDefault === 'function') {
        // Check if it's actually a valid component (not just a function stub)
        try {
          const componentName = MapViewDefault.name || MapViewDefault.displayName || 'Unknown';
          if (componentName === 'Unknown' && typeof MapViewDefault !== 'function') {
            throw new Error('MapView is not a valid component');
          }
        } catch (checkError: any) {
          // If checking the component fails, it's likely a codegenNativeCommands issue
          throw new Error(`codegenNativeCommands error: ${checkError?.message || 'Component validation failed'}`);
        }
      }
      
      mapsLoaded = true;
      return { MapView: MapViewDefault, Marker, Polyline, Circle };
    } catch (componentError: any) {
      // Error accessing components (codegenNativeCommands)
      const errorMsg = componentError?.message || String(componentError);
      if (errorMsg.includes('codegenNativeCommands') || 
          errorMsg.includes('is not a function') ||
          errorMsg.includes('undefined')) {
        mapsLoadFailed = true;
        mapsLoaded = true;
        console.warn('⚠️ react-native-maps component access failed (codegenNativeCommands):', errorMsg);
        console.warn('💡 This is expected in Expo Go - use a development build for native maps');
        return { MapView: null, Marker: null, Polyline: null, Circle: null };
      }
      throw new Error(`Failed to access map components: ${errorMsg}`);
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
    const result = loadMapsModule();
    return result?.MapView || null;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('codegenNativeCommands')) {
      console.warn('⚠️ getMapView failed:', errorMsg);
    }
    return null;
  }
};

export const getMarker = () => {
  try {
    const result = loadMapsModule();
    return result?.Marker || null;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('codegenNativeCommands')) {
      console.warn('⚠️ getMarker failed:', errorMsg);
    }
    return null;
  }
};

export const getPolyline = () => {
  try {
    const result = loadMapsModule();
    return result?.Polyline || null;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('codegenNativeCommands')) {
      console.warn('⚠️ getPolyline failed:', errorMsg);
    }
    return null;
  }
};

export const getCircle = () => {
  try {
    const result = loadMapsModule();
    return result?.Circle || null;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('codegenNativeCommands')) {
      console.warn('⚠️ getCircle failed:', errorMsg);
    }
    return null;
  }
};

// For backward compatibility, export null initially
// Components should use getMapView() etc. or check if null
export const MapView = null;
// Note: Marker, Polyline, and Circle are declared as let variables above
// and should be accessed via getMarker(), getPolyline(), getCircle()
