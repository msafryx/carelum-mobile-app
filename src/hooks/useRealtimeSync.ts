/**
 * Real-time Sync Hook - Supabase
 * Subscribes to Supabase Realtime for alerts, messages, and sessions
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { useEffect, useRef } from 'react';

/**
 * Hook to subscribe to real-time updates from Supabase
 * - Alerts: Real-time alert notifications
 * - Chat Messages: Real-time messaging
 * - Sessions: Real-time session updates
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const channelsRef = useRef<Array<{ channel: any; unsubscribe: () => void }>>([]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || !user) {
      return;
    }

    console.log('🔄 Setting up Supabase real-time subscriptions...');

    // Subscribe to alerts
    const alertsChannel = supabase
      .channel('alerts-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `parent_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log('🔔 Alert update:', payload);
          // Emit custom event for UI to listen
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('alertUpdated', { detail: payload }));
          }
        }
      )
      .subscribe();

    // Subscribe to chat messages
    const messagesChannel = supabase
      .channel('chat-messages-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log('💬 Message update:', payload);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('messageReceived', { detail: payload }));
          }
        }
      )
      .subscribe();

    // Subscribe to sessions
    const sessionsChannel = supabase
      .channel('sessions-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `parent_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log('📅 Session update:', payload);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sessionUpdated', { detail: payload }));
          }
        }
      )
      .subscribe();

    // Also subscribe to sessions where user is sitter
    const sitterSessionsChannel = supabase
      .channel('sitter-sessions-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `sitter_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log('📅 Sitter session update:', payload);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sessionUpdated', { detail: payload }));
          }
        }
      )
      .subscribe();

    channelsRef.current = [
      { channel: alertsChannel, unsubscribe: () => supabase.removeChannel(alertsChannel) },
      { channel: messagesChannel, unsubscribe: () => supabase.removeChannel(messagesChannel) },
      { channel: sessionsChannel, unsubscribe: () => supabase.removeChannel(sessionsChannel) },
      { channel: sitterSessionsChannel, unsubscribe: () => supabase.removeChannel(sitterSessionsChannel) },
    ];

    console.log('✅ Real-time subscriptions active');

    return () => {
      console.log('🔄 Cleaning up real-time subscriptions...');
      channelsRef.current.forEach(({ unsubscribe }) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('⚠️ Error unsubscribing:', error);
        }
      });
      channelsRef.current = [];
    };
  }, [user]);

  return {
    isSubscribed: channelsRef.current.length > 0,
  };
}

// Event emitter for children updates (for backward compatibility)
class ChildrenUpdateEmitter {
  private listeners: Array<() => void> = [];

  on(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit() {
    console.log('📢 Emitting children update event...');
    this.listeners.forEach(listener => listener());
  }
}

export const childrenUpdateEmitter = new ChildrenUpdateEmitter();
