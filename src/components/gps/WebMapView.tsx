/**
 * WebView-based Map Component for Expo Go compatibility
 * Uses Google Maps JavaScript API via WebView
 * Works in Expo Go without requiring native builds
 */
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface WebMapViewProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  onRegionChangeComplete?: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => void;
  onPress?: (coordinate: { latitude: number; longitude: number }) => void;
  marker?: {
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
  } | null;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  showsScale?: boolean;
  mapType?: 'standard' | 'satellite' | 'hybrid';
  style?: any;
}

export default function WebMapView({
  initialRegion,
  region,
  onRegionChangeComplete,
  onPress,
  marker,
  showsUserLocation = false,
  showsMyLocationButton = false,
  showsCompass = true,
  showsScale = true,
  mapType = 'standard',
  style,
}: WebMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);

  // Default to Sri Lanka (Colombo) if no region provided
  const defaultLat = 6.9271;
  const defaultLng = 79.8612;
  const defaultZoom = 13;

  const currentRegion = region || initialRegion || {
    latitude: defaultLat,
    longitude: defaultLng,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  // Calculate zoom level from latitudeDelta
  const getZoomFromDelta = (delta: number) => {
    // Approximate conversion: smaller delta = higher zoom
    if (delta >= 0.5) return 8;
    if (delta >= 0.1) return 10;
    if (delta >= 0.05) return 12;
    if (delta >= 0.01) return 14;
    return 16;
  };

  const zoom = getZoomFromDelta(currentRegion.latitudeDelta || 0.1);

  // Generate HTML with Google Maps
  const generateMapHTML = () => {
    const mapTypeId = mapType === 'satellite' ? 'satellite' : mapType === 'hybrid' ? 'hybrid' : 'roadmap';
    const markerLat = marker?.latitude || currentRegion.latitude;
    const markerLng = marker?.longitude || currentRegion.longitude;
    const markerTitle = marker?.title || '';
    const markerDesc = marker?.description || '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
    }
    #map {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map;
    let marker = null;
    let clickMarker = null;
    let isDragging = false;
    let lastCenter = null;

    function initMap() {
      const center = {
        lat: ${currentRegion.latitude},
        lng: ${currentRegion.longitude}
      };

      map = new google.maps.Map(document.getElementById('map'), {
        center: center,
        zoom: ${zoom},
        mapTypeId: '${mapTypeId}',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        scaleControl: ${showsScale},
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy'
      });

      // Add existing marker if provided
      ${marker ? `
        marker = new google.maps.Marker({
          position: { lat: ${markerLat}, lng: ${markerLng} },
          map: map,
          title: '${markerTitle}',
          animation: google.maps.Animation.DROP,
          draggable: false
        });
        ${markerDesc ? `marker.setLabel({ text: '${markerDesc}', color: '#333' });` : ''}
      ` : ''}

      // Handle map clicks for pin dropping
      map.addListener('click', function(event) {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        // Remove previous click marker
        if (clickMarker) {
          clickMarker.setMap(null);
        }
        
        // Add new marker at click location
        clickMarker = new google.maps.Marker({
          position: { lat: lat, lng: lng },
          map: map,
          animation: google.maps.Animation.DROP,
          draggable: true,
          icon: {
            url: 'data:image/svg+xml;base64,' + btoa(\`
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="#FF0000" stroke="#FFFFFF" stroke-width="2"/>
                <circle cx="20" cy="20" r="8" fill="#FFFFFF"/>
              </svg>
            \`)
          }
        });

        // Send coordinates to React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapClick',
            latitude: lat,
            longitude: lng
          }));
        }
      });

      // Handle marker drag end
      if (clickMarker) {
        google.maps.event.addListener(clickMarker, 'dragend', function(event) {
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapClick',
              latitude: lat,
              longitude: lng
            }));
          }
        });
      }

      // Track map center changes
      map.addListener('dragstart', function() {
        isDragging = true;
      });

      map.addListener('dragend', function() {
        isDragging = false;
        updateCenter();
      });

      map.addListener('zoom_changed', function() {
        updateCenter();
      });

      function updateCenter() {
        const center = map.getCenter();
        if (center) {
          const bounds = map.getBounds();
          if (bounds) {
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const latDelta = ne.lat() - sw.lat();
            const lngDelta = ne.lng() - sw.lng();

            // Only send if center actually changed
            const newCenter = { lat: center.lat(), lng: center.lng() };
            if (!lastCenter || 
                Math.abs(lastCenter.lat - newCenter.lat) > 0.0001 ||
                Math.abs(lastCenter.lng - newCenter.lng) > 0.0001) {
              lastCenter = newCenter;
              
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'regionChange',
                  latitude: center.lat(),
                  longitude: center.lng(),
                  latitudeDelta: latDelta,
                  longitudeDelta: lngDelta
                }));
              }
            }
          }
        }
      }

      // Notify React Native that map is ready
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapReady'
        }));
      }
    }

    // Load Google Maps script
    function loadGoogleMaps() {
      const script = document.createElement('script');
      // Use Google Maps without API key for basic functionality (works with usage limits)
      // For production, add your Google Maps API key here
      script.src = 'https://maps.googleapis.com/maps/api/js?key=&callback=initMap&libraries=places';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Start loading when page is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadGoogleMaps);
    } else {
      loadGoogleMaps();
    }
  </script>
</body>
</html>
    `;
  };

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        setMapReady(true);
      } else if (data.type === 'mapClick' && onPress) {
        onPress({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      } else if (data.type === 'regionChange' && onRegionChangeComplete) {
        onRegionChangeComplete({
          latitude: data.latitude,
          longitude: data.longitude,
          latitudeDelta: data.latitudeDelta,
          longitudeDelta: data.longitudeDelta,
        });
      }
    } catch (error) {
      console.warn('Failed to parse WebView message:', error);
    }
  };

  // Update map when region or marker changes
  useEffect(() => {
    if (mapReady && webViewRef.current) {
      const markerLat = marker?.latitude || currentRegion.latitude;
      const markerLng = marker?.longitude || currentRegion.longitude;
      const mapTypeId = mapType === 'satellite' ? 'satellite' : mapType === 'hybrid' ? 'hybrid' : 'roadmap';
      const zoom = getZoomFromDelta(currentRegion.latitudeDelta || 0.1);

      const script = `
        if (map) {
          map.setCenter({ lat: ${currentRegion.latitude}, lng: ${currentRegion.longitude} });
          map.setZoom(${zoom});
          map.setMapTypeId('${mapTypeId}');
          
          ${marker ? `
            if (marker) {
              marker.setPosition({ lat: ${markerLat}, lng: ${markerLng} });
            } else {
              marker = new google.maps.Marker({
                position: { lat: ${markerLat}, lng: ${markerLng} },
                map: map,
                title: '${marker?.title || ''}',
                animation: google.maps.Animation.DROP
              });
            }
          ` : `
            if (marker) {
              marker.setMap(null);
              marker = null;
            }
          `}
        }
      `;

      webViewRef.current.injectJavaScript(script);
    }
  }, [region, marker, mapType, mapReady]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        bounces={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
