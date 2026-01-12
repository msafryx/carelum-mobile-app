/**
 * Native-only map imports
 * This file is only used on iOS/Android, not on web
 */
let MapViewDefault: any = null;
let Marker: any = null;
let Polyline: any = null;
let Circle: any = null;

try {
  // Try to import react-native-maps - may fail in Expo Go or certain environments
  const mapsModule = require('react-native-maps');
  MapViewDefault = mapsModule.default || mapsModule;
  Marker = mapsModule.Marker;
  Polyline = mapsModule.Polyline;
  Circle = mapsModule.Circle;
} catch (error) {
  console.warn('⚠️ react-native-maps not available:', error);
  // Components will be null, and the UI should handle this gracefully
}

export const MapView = MapViewDefault;
export { Marker, Polyline, Circle };
