import React, { useState } from 'react';
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

export default function LoginScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
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
    const result = await signIn({ email, password });

    if (result.success) {
      // Navigation will be handled by app/index.tsx based on user role
      router.replace('/');
    } else {
      setError(result.error || null);
    }
    setLoading(false);
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
          <Text style={styles.logoText}>Carelum</Text>
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
