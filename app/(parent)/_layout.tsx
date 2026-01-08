import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import ErrorBoundary from '@/src/components/ui/ErrorBoundary';

export default function ParentLayout() {
  const { colors } = useTheme();

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.border,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="activities"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            href: null, // Hide from tabs
          }}
        />
        <Tabs.Screen
          name="session/[id]"
          options={{
            href: null, // Hide from tabs
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            href: null, // Hide from tabs
          }}
        />
        <Tabs.Screen
          name="instructions"
          options={{
            href: null, // Hide from tabs
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: null, // Hide from tabs
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
