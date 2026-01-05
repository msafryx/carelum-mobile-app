import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import { AppError } from '@/src/types/error.types';
import Button from './Button';

interface ErrorDisplayProps {
  error: AppError | string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: any;
}

export default function ErrorDisplay({
  error,
  onRetry,
  retryLabel = 'Try Again',
  style,
}: ErrorDisplayProps) {
  const { colors, spacing } = useTheme();
  const errorMessage =
    typeof error === 'string' ? error : error.message || 'An error occurred';

  return (
    <View style={[styles.container, { padding: spacing.lg }, style]}>
      <Ionicons
        name="alert-circle-outline"
        size={48}
        color={colors.error}
        style={styles.icon}
      />
      <Text style={[styles.message, { color: colors.text }]}>
        {errorMessage}
      </Text>
      {onRetry && (
        <View style={styles.retryContainer}>
          <Button
            title={retryLabel}
            onPress={onRetry}
            variant="primary"
            size="medium"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryContainer: {
    marginTop: 8,
  },
});
