/**
 * Sitter tab badge counts (Requests and Notifications).
 * Used by sitter layout to show superscript badges on tab bar icons.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { discoverAvailableSessions } from '@/src/services/session.service';
import { getUserAlerts } from '@/src/services/alert.service';

interface SitterTabBadgesContextValue {
  requestCount: number;
  notificationCount: number;
  setRequestCount: (n: number) => void;
  setNotificationCount: (n: number) => void;
  refreshRequestCount: () => Promise<void>;
  refreshNotificationCount: () => Promise<void>;
}

const SitterTabBadgesContext = createContext<SitterTabBadgesContextValue | null>(null);

export function SitterTabBadgesProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [requestCount, setRequestCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  const refreshRequestCount = useCallback(async () => {
    if (!user || !userProfile) return;
    try {
      const result = await discoverAvailableSessions(
        undefined,
        undefined,
        userProfile.city || undefined
      );
      if (result.success && result.data) {
        setRequestCount(result.data.length);
      }
    } catch {
      setRequestCount(0);
    }
  }, [user?.id, userProfile?.city]);

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
      setRequestCount(0);
      setNotificationCount(0);
      return;
    }
    refreshRequestCount();
    refreshNotificationCount();
  }, [user?.id, refreshRequestCount, refreshNotificationCount]);

  const value: SitterTabBadgesContextValue = {
    requestCount,
    notificationCount,
    setRequestCount,
    setNotificationCount,
    refreshRequestCount,
    refreshNotificationCount,
  };

  return (
    <SitterTabBadgesContext.Provider value={value}>
      {children}
    </SitterTabBadgesContext.Provider>
  );
}

export function useSitterTabBadges() {
  const ctx = useContext(SitterTabBadgesContext);
  return ctx;
}
