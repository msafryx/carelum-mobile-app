import { Stack } from 'expo-router';
import ErrorBoundary from '@/src/components/ui/ErrorBoundary';

export default function AuthLayout() {
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </ErrorBoundary>
  );
}
