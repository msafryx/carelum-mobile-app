import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import ErrorDisplay from '@/src/components/ui/ErrorDisplay';
import { signUp } from '@/src/services/auth.service';
import { validateEmail, validatePassword } from '@/src/utils/validators';
import { USER_ROLES } from '@/src/config/constants';
import { AppError } from '@/src/types/error.types';
import { useAuth } from '@/src/hooks/useAuth';

export default function RegisterScreen() {
  const { colors, spacing, isDark } = useTheme();
  const router = useRouter();
  const { userProfile, initialized } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'parent' | 'babysitter'>('parent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleRegister = async () => {
    setError(null);
    setEmailError('');
    setPasswordError('');

    // Validate inputs
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!displayName.trim()) {
      setError({
        code: 'VALIDATION_ERROR' as any,
        message: 'Please enter your display name',
      });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.errors[0]);
      return;
    }

    setLoading(true);
    try {
      const result = await signUp({
        email,
        password,
        displayName: displayName.trim(),
        role: role === 'parent' ? USER_ROLES.PARENT : USER_ROLES.BABYSITTER,
      });

      if (result.success) {
        // INSTANT NAVIGATION - Like Firebase/MySQL pattern
        // Don't wait for anything - AsyncStorage already has the data
        // Supabase sync happens in background
        setLoading(false);
        
        const route = role === 'parent' 
          ? '/(parent)/home' 
          : '/(sitter)/home';
        
        // Navigate immediately - no delays, no waiting
        router.replace(route as any);
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
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            autoCapitalize="words"
          />

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
            error={passwordError}
          />

          <View style={styles.roleContainer}>
            <Button
              title="Parent"
              onPress={() => setRole('parent')}
              variant={role === 'parent' ? 'primary' : 'outline'}
              size="small"
              style={styles.roleButton}
            />
            <Button
              title="Babysitter"
              onPress={() => setRole('babysitter')}
              variant={role === 'babysitter' ? 'primary' : 'outline'}
              size="small"
              style={styles.roleButton}
            />
          </View>

          {error && (
            <ErrorDisplay error={error} />
          )}

          <Button
            title="Sign Up"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          <Button
            title="Already have an account? Log In"
            onPress={() => router.push('/(auth)/login')}
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
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
  },
  button: {
    marginTop: 8,
  },
  linkButton: {
    marginTop: 16,
  },
});
