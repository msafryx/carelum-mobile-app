import LoadingSpinner from '@/src/components/ui/LoadingSpinner';
import { USER_ROLES } from '@/src/config/constants';
import { useTheme } from '@/src/config/theme';
import { useAuth } from '@/src/hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const HAS_SEEN_LANDING_KEY = '@carelum:has_seen_landing';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Match with the right caregiver',
    description: 'Post a job, compare profiles and read reviews.',
    image: require('@/assets/images/slide1.jpg'),
  },
  {
    id: '2',
    title: 'Find the care you need now',
    description: 'Child care, senior care, pet care, housekeeping and more.',
    image: require('@/assets/images/slide2.jpg'),
  },
  {
    id: '3',
    title: 'Your safety is our priority',
    description: 'Tools to help you search, connect, screen, and hire.',
    image: require('@/assets/images/slide3.jpg'),
  },
];

export default function LandingScreen() {
  // Call ALL hooks first (before any conditional returns)
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { colors } = useTheme();
  const { user, userProfile, initialized, loading } = useAuth();

  // Set up carousel auto-scroll effect (always call, even if we return early)
  useEffect(() => {
    // Only set up interval if we're actually showing the landing screen
    if (initialized && !loading && (!user || !userProfile)) {
      const interval = setInterval(() => {
        const nextIndex = (currentIndex + 1) % slides.length;
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        setCurrentIndex(nextIndex);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [currentIndex, initialized, loading, user, userProfile]);

  // Now do conditional rendering AFTER all hooks
  // If still loading auth, show loading spinner
  if (!initialized || loading) {
    return <LoadingSpinner fullScreen />;
  }

  // If user is already logged in, redirect immediately (before rendering landing screen)
  if (user && userProfile) {
    const route = 
      userProfile.role === USER_ROLES.PARENT ? '/(parent)/home' :
      userProfile.role === USER_ROLES.BABYSITTER ? '/(sitter)/home' :
      userProfile.role === USER_ROLES.ADMIN ? '/(admin)/home' :
      '/(auth)/login';
    return <Redirect href={route as any} />;
  }

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const renderItem = ({ item }: any) => (
    <ImageBackground source={item.image} style={styles.slide} resizeMode="cover">
      <View style={styles.darkOverlay}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    </ImageBackground>
  );

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/logo-icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>Carelum</Text>
      </View>
      <FlatList
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ref={flatListRef}
      />

      <View style={[styles.bottomCard, { backgroundColor: colors.white }]}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentIndex ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.getStarted, { backgroundColor: colors.primary }]}
          onPress={async () => {
            await AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
            router.replace('/(auth)/register');
          }}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.login, { borderColor: colors.primary }]}
          onPress={async () => {
            await AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
            router.replace('/(auth)/login');
          }}
        >
          <Text style={[styles.loginText, { color: colors.darkGreen }]}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    width,
    height,
    justifyContent: 'flex-start',
  },
  darkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 400,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: '#eee',
    textAlign: 'center',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  getStarted: {
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  getStartedText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  login: {
    borderWidth: 2,
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  loginText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    top: 60,
    left: 20,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 20,
    transform: [{ scale: 5 }],
  },
  logoText: {
    color: '#fff',
    fontSize: 35,
    fontWeight: 'bold',
    textShadowColor: '#7D3DD2',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
});
