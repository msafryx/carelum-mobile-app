import { Redirect } from 'expo-router';

/**
 * Root index - Always redirects to splash screen first
 * Flow: Splash -> Landing -> Auth/Dashboard
 */
export default function RootIndex() {
  // Always start with splash screen
  return <Redirect href="/splash" />;
}
