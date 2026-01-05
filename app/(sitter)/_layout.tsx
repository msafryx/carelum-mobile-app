import { Stack } from 'expo-router';
import ErrorBoundary from '@/src/components/ui/ErrorBoundary';

export default function SitterLayout() {
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="verification-status" />
        <Stack.Screen name="requests" />
        <Stack.Screen name="session/[id]" />
      </Stack>
    </ErrorBoundary>
  );
}
