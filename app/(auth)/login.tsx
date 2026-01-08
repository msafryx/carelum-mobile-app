import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/config/theme';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import ErrorDisplay from '@/src/components/ui/ErrorDisplay';
import LoadingSpinner from '@/src/components/ui/LoadingSpinner';
import { signIn } from '@/src/services/auth.service';
import { validateEmail } from '@/src/utils/validators';
import { AppError } from '@/src/types/error.types';
import { useAuth } from '@/src/hooks/useAuth';
import { USER_ROLES } from '@/src/config/constants';

export default function LoginScreen() {
  const { colors, spacing, isDark } = useTheme();
  const router = useRouter();
  const { userProfile, initialized } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [emailError, setEmailError] = useState('');

  const handleLogin = async () => {
    setError(null);
    setEmailError('');

    // Validate email
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError({
        code: 'VALIDATION_ERROR' as any,
        message: 'Please enter your password',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await signIn({ email, password });

      if (result.success) {
        // INSTANT NAVIGATION - Like Firebase/MySQL pattern
        // AsyncStorage already has the data from previous session
        // If not, useAuth will create minimal profile instantly
        setLoading(false);
        
        // Navigate immediately - useAuth hook will handle profile loading
        // Don't wait for anything
        router.replace('/landing'); // Landing will redirect based on auth state
      } else {
        setError(result.error || null);
        setLoading(false);
      }
    } catch (err: any) {
      setError({
        code: 'UNKNOWN_ERROR' as any,
        message: err.message || 'An unexpected error occurred',
      });
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/logo-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[
            styles.logoText,
            { color: isDark ? '#ff8c42' : 'rgb(86, 28, 161)' }
          ]}>Carelum</Text>
        </View>
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            error={error?.code === 'INVALID_PASSWORD' ? error.message : undefined}
          />

          {error && error.code !== 'INVALID_PASSWORD' && (
            <ErrorDisplay error={error} />
          )}

          <Button
            title="Log In"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          <Button
            title="Don't have an account? Sign Up"
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
            style={styles.linkButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 15,
    transform: [{ scale: 3 }],
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: 'rgb(86, 28, 161)',
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: 8,
  },
  linkButton: {
    marginTop: 16,
  },
});
