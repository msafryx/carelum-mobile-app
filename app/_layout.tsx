import { Stack } from 'expo-router';
import ErrorBoundary from '@/src/components/ui/ErrorBoundary';
import { ThemeProvider } from '@/src/components/ui/ThemeProvider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="splash" />
          <Stack.Screen name="landing" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(parent)" />
          <Stack.Screen name="(sitter)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
