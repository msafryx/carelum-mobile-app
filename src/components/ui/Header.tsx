import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import { useRouter, useSegments } from 'expo-router';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  rightComponent?: React.ReactNode;
  showLogo?: boolean;
}

export default function Header({
  title,
  showBack = true,
  rightComponent,
  showLogo = false,
}: HeaderProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const router = useRouter();
  const segments = useSegments();
  
  // Ensure spacing is always available (fallback to default values)
  const safeSpacing = spacing || {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  };

  const handleBack = () => {
    try {
      const currentSegment = segments[0];
      const currentRoute = segments[1];

      // For tab screens in parent, navigate to home tab
      if (currentSegment === '(parent)') {
        if (['activities', 'notifications', 'messages', 'profile'].includes(currentRoute || '')) {
          router.push('/(parent)/home' as any);
          return;
        }
        // For other parent screens (search, session, etc.), try to go back
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/(parent)/home' as any);
        }
        return;
      }

      // For sitter screens
      if (currentSegment === '(sitter)') {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/(sitter)/home' as any);
        }
        return;
      }

      // For admin screens
      if (currentSegment === '(admin)') {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push('/(admin)/home' as any);
        }
        return;
      }

      // Default: try to go back, fallback to home
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push('/' as any);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback: navigate to appropriate home
      const currentSegment = segments[0];
      if (currentSegment === '(parent)') {
        router.push('/(parent)/home' as any);
      } else if (currentSegment === '(sitter)') {
        router.push('/(sitter)/home' as any);
      } else if (currentSegment === '(admin)') {
        router.push('/(admin)/home' as any);
      } else {
        router.push('/' as any);
      }
    }
  };

  return (
    <View
        style={[
          styles.header,
          {
            backgroundColor: colors.white,
            paddingTop: safeSpacing.xl + 20,
            paddingBottom: safeSpacing.md,
            paddingHorizontal: safeSpacing.md,
            borderBottomColor: colors.border,
          },
        ]}
    >
      <View style={styles.leftSection}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {showLogo && (
          <View style={styles.logoContainer}>
            <View style={styles.logoRow}>
              <Image
                source={require('@/assets/images/logo-icon.png')}
                style={[styles.logo, { marginLeft: showBack ? 0 : 30 }]}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>Carelum</Text>
            </View>
            {title && (
              <Text style={[styles.pageTitle, { color: colors.textDark, marginTop: 12 }]}>
                {title}
              </Text>
            )}
          </View>
        )}
        {!showLogo && title && (
          <Text style={[styles.title, { color: colors.textDark }]}>
            {title}
          </Text>
        )}
      </View>
      {rightComponent && <View style={styles.rightSection}>{rightComponent}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  backButton: {
    marginRight: 10,
    marginTop: 2,
    zIndex: 10,
    padding: 4,
  },
  logoContainer: {
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 15,
    transform: [{ scale: 3 }],
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgb(86, 28, 161)',
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  rightSection: {
    marginLeft: 12,
    marginTop: 2,
  },
});
