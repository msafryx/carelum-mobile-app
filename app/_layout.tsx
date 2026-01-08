import ErrorBoundary from '@/src/components/ui/ErrorBoundary';
import { ThemeProvider } from '@/src/components/ui/ThemeProvider';
import { useDatabaseInit } from '@/src/hooks/useDatabaseInit';
import { useRealtimeSync } from '@/src/hooks/useRealtimeSync';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function RootLayout() {
  const { localDbReady, supabaseConfigured, error } = useDatabaseInit();
  
  // Enable real-time sync from Supabase → AsyncStorage
  useRealtimeSync();

  useEffect(() => {
    if (error) {
      console.error('Database initialization error:', error);
    }
  }, [error]);

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
