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
    
    // Global error handler to catch codegenNativeCommands errors
    // Check if ErrorUtils is available (may not be in all React Native environments)
    if (ErrorUtils && typeof ErrorUtils.getGlobalHandler === 'function' && typeof ErrorUtils.setGlobalHandler === 'function') {
      try {
        const originalHandler = ErrorUtils.getGlobalHandler();
        ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
          const errorMessage = error?.message || String(error) || '';
          
          // Suppress codegenNativeCommands errors (react-native-maps in Expo Go)
          if (errorMessage.includes('codegenNativeCommands') || 
              (errorMessage.includes('is not a function') && errorMessage.includes('react-native-maps'))) {
            console.warn('⚠️ Global error handler: Suppressing codegenNativeCommands error');
            console.warn('💡 This is expected in Expo Go - the app will continue with WebView maps');
            // Don't call original handler - suppress the error
            return;
          }
          
          // Call original handler for other errors
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        });
        
        // Cleanup on unmount
        return () => {
          if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
            ErrorUtils.setGlobalHandler(originalHandler);
          }
        };
      } catch (errorHandlerError) {
        // If setting global handler fails, just log and continue
        console.warn('⚠️ Could not set global error handler:', errorHandlerError);
      }
    } else {
      // ErrorUtils not available - log warning but continue
      if (__DEV__) {
        console.warn('⚠️ ErrorUtils not available - global error handler not set');
      }
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
