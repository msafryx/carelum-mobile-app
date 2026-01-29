import ErrorBoundary from '@/src/components/ui/ErrorBoundary';
import { SitterTabBadgesProvider, useSitterTabBadges } from '@/src/contexts/SitterTabBadgesContext';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

function SitterLayoutTabs() {
  const { colors } = useTheme();
  const badges = useSitterTabBadges();
  const requestCount = badges?.requestCount ?? 0;
  const notificationCount = badges?.notificationCount ?? 0;

  return (
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
        // Center the badge number in the red circle (overrides default padding/lineHeight)
        tabBarBadgeStyle: {
          minWidth: 18,
          height: 18,
          lineHeight: 18,
          paddingHorizontal: 0,
          textAlign: 'center',
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
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail" color={color} size={size} />
          ),
          tabBarBadge: requestCount > 0 ? requestCount : undefined,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" color={color} size={size} />
          ),
          tabBarBadge: notificationCount > 0 ? notificationCount : undefined,
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
        name="profile-setup"
        options={{
          href: null, // Hide from tabs
        }}
      />
      <Tabs.Screen
        name="verification-status"
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
        name="activities"
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
  );
}

export default function SitterLayout() {
  return (
    <ErrorBoundary>
      <SitterTabBadgesProvider>
        <SitterLayoutTabs />
      </SitterTabBadgesProvider>
    </ErrorBoundary>
  );
}
