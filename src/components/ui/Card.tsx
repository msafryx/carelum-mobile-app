import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/src/config/theme';

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

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.white,
          borderRadius: borderRadius.md,
          padding: cardPadding,
          elevation,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: elevation },
          shadowOpacity: 0.1,
          shadowRadius: elevation * 2,
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
