import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface BadgeProps {
  label?: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export default function Badge({ label, variant = 'default', style, children }: BadgeProps) {
  const { colors, spacing, borderRadius } = useTheme();

  const getVariantColor = (): string => {
    switch (variant) {
      case 'success':
        return colors.success || '#10b981';
      case 'warning':
        return colors.warning || '#f59e0b';
      case 'error':
        return colors.error || '#ef4444';
      case 'info':
        return colors.info || '#3b82f6';
      default:
        return colors.primary;
    }
  };

  const badgeText = children || label || '';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getVariantColor(),
          borderRadius: borderRadius.full || 12,
          paddingHorizontal: spacing.sm || 8,
          paddingVertical: spacing.xs || 4,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: colors.white || '#fff' }]}>{badgeText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
