// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  expo: {
    name: 'Carelum-Frontend',
    slug: 'Carelum-Frontend',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'carelumfrontend',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      bundleIdentifier: 'com.anonymous.CarelumFrontend',
      supportsTablet: true,
    },
    android: {
      package: 'com.anonymous.CarelumFrontend',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      [
        'react-native-maps',
        {
          googleMapsApiKey: '',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      // Supabase configuration from environment variables
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      // API URL
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
    },
  },
};
