import ErrorBoundary from '@/src/components/ui/ErrorBoundary';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function ParentLayout() {
  const { colors } = useTheme();

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: 2,
            marginBottom: 4,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.border,
            height: 60,
            paddingBottom: 4,
            paddingTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="activities"
          options={{
            title: 'Bookings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
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
        <Tabs.Screen
          name="chatbot"
          options={{
            href: null, // Hide from tabs
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
