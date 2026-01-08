import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  elevation?: number;
}

export default function Card({
  children,
  style,
  padding,
  elevation = 2,
}: CardProps) {
  const { colors, spacing, borderRadius } = useTheme();
  const cardPadding = padding !== undefined ? padding : spacing.md;

  // Platform-specific shadow styles
  const shadowStyle = Platform.select({
    web: {
      boxShadow: `0 ${elevation}px ${elevation * 2}px rgba(0, 0, 0, 0.1)`,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevation },
      shadowOpacity: 0.1,
      shadowRadius: elevation * 2,
      elevation,
    },
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.white,
          borderRadius: borderRadius.md,
          padding: cardPadding,
          ...shadowStyle,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
});
