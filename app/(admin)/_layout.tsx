import { Stack } from 'expo-router';
import ErrorBoundary from '@/src/components/ui/ErrorBoundary';

export default function AdminLayout() {
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="verifications" />
        <Stack.Screen name="users" />
      </Stack>
    </ErrorBoundary>
  );
}
