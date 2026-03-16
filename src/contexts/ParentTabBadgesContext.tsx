/**
 * Parent tab badge count (Notifications).
 * Used by parent layout to show badge on Notifications tab.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { getUserAlerts, subscribeToUserAlerts } from '@/src/services/alert.service';

interface ParentTabBadgesContextValue {
  notificationCount: number;
  setNotificationCount: (n: number) => void;
  refreshNotificationCount: () => Promise<void>;
}

const ParentTabBadgesContext = createContext<ParentTabBadgesContextValue | null>(null);

export function ParentTabBadgesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);

  const refreshNotificationCount = useCallback(async () => {
    if (!user) return;
    try {
      const result = await getUserAlerts(user.id, 'new');
      if (result.success && result.data) {
        setNotificationCount(result.data.length);
      } else {
        setNotificationCount(0);
      }
    } catch {
      setNotificationCount(0);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotificationCount(0);
      return;
    }
    refreshNotificationCount();
  }, [user?.id, refreshNotificationCount]);

  // Realtime: when alerts change, refresh badge count so tab updates without pull
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToUserAlerts(user.id, 'parent', () => {
      refreshNotificationCount();
    });
    return () => unsubscribe();
  }, [user?.id, refreshNotificationCount]);

  const value: ParentTabBadgesContextValue = {
    notificationCount,
    setNotificationCount,
    refreshNotificationCount,
  };

  return (
    <ParentTabBadgesContext.Provider value={value}>
      {children}
    </ParentTabBadgesContext.Provider>
  );
}

export function useParentTabBadges() {
  return useContext(ParentTabBadgesContext);
}
