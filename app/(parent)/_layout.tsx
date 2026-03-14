import ErrorBoundary from '@/src/components/ui/ErrorBoundary';
import { ParentTabBadgesProvider, useParentTabBadges } from '@/src/contexts/ParentTabBadgesContext';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

function ParentLayoutTabs() {
  const { colors } = useTheme();
  const badges = useParentTabBadges();
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
        <Tabs.Screen
          name="meeting-requests"
          options={{
            href: null, // Hide from tabs
          }}
        />
      </Tabs>
  );
}

export default function ParentLayout() {
  return (
    <ErrorBoundary>
      <ParentTabBadgesProvider>
        <ParentLayoutTabs />
      </ParentTabBadgesProvider>
    </ErrorBoundary>
  );
}
