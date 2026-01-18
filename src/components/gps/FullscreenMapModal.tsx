/**
 * Fullscreen Map Modal Component
 * Uber-like map experience with search and pin dropping
 * Uses OpenStreetMap via Leaflet (no API key required)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import * as Location from 'expo-location';

interface FullscreenMapModalProps {
  visible: boolean;
  onClose: () => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address: string;
    city?: string;
  }) => void;
}

export default function FullscreenMapModal({
  visible,
  onClose,
  initialLocation,
  onLocationSelect,
}: FullscreenMapModalProps) {
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation ? {
    latitude: initialLocation.latitude,
    longitude: initialLocation.longitude,
  } : null);
  const [mapReady, setMapReady] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);

  // Default to Sri Lanka (Colombo)
  const defaultLat = initialLocation?.latitude || 6.9271;
  const defaultLng = initialLocation?.longitude || 79.8612;

  // Generate map HTML with Leaflet (OpenStreetMap)
  const generateMapHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body, html {
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #map {
      width: 100%;
      height: 100%;
    }
    .custom-marker {
      position: relative;
      width: 0;
      height: 0;
    }
    .pin {
      width: 30px;
      height: 30px;
      position: relative;
    }
    .pin-top {
      width: 30px;
      height: 30px;
      background: #FF0000;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      position: absolute;
      top: 0;
      left: 0;
    }
    .pin-top::after {
      content: '';
      width: 12px;
      height: 12px;
      background: #FFFFFF;
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(45deg);
    }
    .pin-needle {
      width: 4px;
      height: 20px;
      background: #CC0000;
      position: absolute;
      top: 25px;
      left: 13px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    let map;
    let marker = null;
    let isDragging = false;

    function initMap() {
      // Initialize map
      map = L.map('map', {
        center: [${defaultLat}, ${defaultLng}],
        zoom: 13,
        zoomControl: true,
        attributionControl: true
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      ${selectedLocation ? `
        // Add initial marker with needle pin
        marker = L.marker([${selectedLocation.latitude}, ${selectedLocation.longitude}], {
          draggable: true,
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div class="pin"><div class="pin-top"></div><div class="pin-needle"></div></div>',
            iconSize: [30, 50],
            iconAnchor: [15, 50]
          })
        }).addTo(map);
      ` : ''}

      // Handle map clicks
      map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Remove existing marker
        if (marker) {
          map.removeLayer(marker);
        }
        
        // Add new marker with needle pin
        marker = L.marker([lat, lng], {
          draggable: true,
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div class="pin"><div class="pin-top"></div><div class="pin-needle"></div></div>',
            iconSize: [30, 50],
            iconAnchor: [15, 50]
          })
        }).addTo(map);

        // Center map on marker
        map.setView([lat, lng], map.getZoom());

        // Send coordinates to React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapClick',
            latitude: lat,
            longitude: lng
          }));
        }
      });

      // Handle marker drag
      if (marker) {
        marker.on('dragend', function(e) {
          const lat = e.target.getLatLng().lat;
          const lng = e.target.getLatLng().lng;
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapClick',
              latitude: lat,
              longitude: lng
            }));
          }
        });
      }

      // Track map movement
      map.on('moveend', function() {
        if (!isDragging && marker) {
          const center = map.getCenter();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapMove',
              latitude: center.lat,
              longitude: center.lng
            }));
          }
        }
      });

      // Notify React Native that map is ready
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapReady'
        }));
      }
    }

    // Initialize map when page loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMap);
    } else {
      initMap();
    }

    // Handle messages from React Native
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'setMarker') {
        const { latitude, longitude } = event.data;
        if (marker) {
          map.removeLayer(marker);
        }
        marker = L.marker([latitude, longitude], {
          draggable: true,
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div class="pin"><div class="pin-top"></div><div class="pin-needle"></div></div>',
            iconSize: [30, 50],
            iconAnchor: [15, 50]
          })
        }).addTo(map);
        map.setView([latitude, longitude], map.getZoom());
      }
    });
  </script>
</body>
</html>
    `;
  };

  // Handle messages from WebView
  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        setMapReady(true);
      } else if (data.type === 'mapClick') {
        const { latitude, longitude } = data;
        setSelectedLocation({ latitude, longitude });
        setReverseGeocoding(true);
        
        try {
          // Reverse geocode to get address
          const reverseGeocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (reverseGeocoded && reverseGeocoded.length > 0) {
            const addr = reverseGeocoded[0];
            const address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim() || 
                          `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            const city = addr.city || undefined;
            
            setSearchQuery(address);
            setSelectedLocation({ latitude, longitude });
          }
        } catch (error) {
          console.warn('Reverse geocoding failed:', error);
          setSearchQuery(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        } finally {
          setReverseGeocoding(false);
        }
      }
    } catch (error) {
      console.warn('Failed to parse WebView message:', error);
    }
  };

  // Search for locations using Nominatim (OpenStreetMap geocoding)
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Use Nominatim for geocoding (free, no API key)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CarelumApp/1.0'
          }
        }
      );
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Handle search result selection
  const handleSelectResult = async (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const address = result.display_name || result.name || `${lat}, ${lng}`;
    const city = result.address?.city || result.address?.town || result.address?.village;

    setSelectedLocation({ latitude: lat, longitude: lng });
    setSearchQuery(address);
    setSearchResults([]);

    // Update map marker
    if (webViewRef.current && mapReady) {
      webViewRef.current.injectJavaScript(`
        if (map && marker) {
          map.removeLayer(marker);
        }
        marker = L.marker([${lat}, ${lng}], {
          draggable: true,
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div class="pin"><div class="pin-top"></div><div class="pin-needle"></div></div>',
            iconSize: [30, 50],
            iconAnchor: [15, 50]
          })
        }).addTo(map);
        map.setView([${lat}, ${lng}], 16);
      `);
    }
  };

  // Handle confirm
  const handleConfirm = async () => {
    if (!selectedLocation) return;

    let address = searchQuery;
    let city: string | undefined;

    // If no address from search, try reverse geocoding
    if (!address || address === `${selectedLocation.latitude}, ${selectedLocation.longitude}`) {
      try {
        const reverseGeocoded = await Location.reverseGeocodeAsync(selectedLocation);
        if (reverseGeocoded && reverseGeocoded.length > 0) {
          const addr = reverseGeocoded[0];
          address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim() || 
                   `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`;
          city = addr.city || undefined;
        }
      } catch (error) {
        address = `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`;
      }
    }

    onLocationSelect({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      address,
      city,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.white, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Select Location</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!selectedLocation}
            style={[styles.confirmButton, { opacity: selectedLocation ? 1 : 0.5 }]}
            hitSlop={8}
          >
            <Text style={[styles.confirmButtonText, { color: colors.primary }]}>Confirm</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.white, borderBottomColor: colors.border }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search for a place..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.searchIcon} />
            )}
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={[styles.searchResults, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
              {searchResults.map((result, index) => (
                <Pressable
                  key={index}
                  style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelectResult(result)}
                >
                  <Ionicons name="location" size={20} color={colors.primary} />
                  <View style={styles.searchResultText}>
                    <Text style={[styles.searchResultTitle, { color: colors.text }]} numberOfLines={1}>
                      {result.name || result.display_name.split(',')[0]}
                    </Text>
                    <Text style={[styles.searchResultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {result.display_name}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: generateMapHTML() }}
            style={styles.map}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            bounces={false}
            scrollEnabled={false}
          />
          {reverseGeocoding && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>Getting address...</Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={[styles.instructions, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
          <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
          <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
            Tap on the map to drop a pin or search for a location
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  confirmButton: {
    padding: 4,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    borderBottomWidth: 1,
    zIndex: 1000,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchResults: {
    maxHeight: 200,
    borderTopWidth: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 13,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  instructionsText: {
    fontSize: 13,
    flex: 1,
  },
});
