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
          // Note: CustomEvent is not available in React Native
          // Components should listen to Supabase real-time updates directly or use the event emitter pattern
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
        async (payload: any) => {
          console.log('💬 Message update:', payload);
          // Sync to AsyncStorage
          try {
            const { save, STORAGE_KEYS } = await import('@/src/services/local-storage.service');
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const msg = payload.new;
              await save(STORAGE_KEYS.CHAT_MESSAGES, {
                id: msg.id,
                sessionId: msg.session_id,
                senderId: msg.sender_id,
                receiverId: msg.receiver_id,
                message: msg.message,
                read: msg.read || false,
                readAt: msg.read_at ? new Date(msg.read_at).getTime() : null,
                createdAt: new Date(msg.created_at).getTime(),
              });
              console.log('✅ Message synced to AsyncStorage from real-time');
            }
          } catch (error: any) {
            console.warn('⚠️ Failed to sync message:', error);
          }
          // Note: CustomEvent is not available in React Native
          // Components should listen to Supabase real-time updates directly
        }
      )
      .subscribe();

    // Subscribe to children (for real-time sync)
    const childrenChannel = supabase
      .channel('children-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'children',
          filter: `parent_id=eq.${user.id}`,
        },
        async (payload: any) => {
          console.log('👶 Children update:', payload);
          // Sync to AsyncStorage
          try {
            const { save, getAll, STORAGE_KEYS } = await import('@/src/services/local-storage.service');
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const child = payload.new;
              await save(STORAGE_KEYS.CHILDREN, {
                id: child.id,
                parentId: child.parent_id,
                childNumber: child.child_number,
                parentNumber: child.parent_number,
                sitterNumber: child.sitter_number,
                name: child.name,
                age: child.age,
                dateOfBirth: child.date_of_birth ? new Date(child.date_of_birth).getTime() : null,
                gender: child.gender,
                photoUrl: child.photo_url,
                createdAt: new Date(child.created_at).getTime(),
                updatedAt: new Date(child.updated_at).getTime(),
              });
              console.log('✅ Child synced to AsyncStorage from real-time');
            } else if (payload.eventType === 'DELETE') {
              // Handle delete - remove from AsyncStorage
              const allChildren = await getAll(STORAGE_KEYS.CHILDREN);
              if (allChildren.success && allChildren.data) {
                const remaining = allChildren.data.filter((c: any) => c.id !== payload.old.id);
                // Re-save remaining children
                const { clear } = await import('@/src/services/local-storage.service');
                await clear(STORAGE_KEYS.CHILDREN);
                for (const child of remaining) {
                  await save(STORAGE_KEYS.CHILDREN, child);
                }
              }
            }
            // Emit event for UI refresh via emitter (React Native compatible)
            childrenUpdateEmitter.emit();
          } catch (error: any) {
            console.warn('⚠️ Failed to sync child to AsyncStorage:', error);
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
          // Note: CustomEvent is not available in React Native
          // Components should listen to Supabase real-time updates directly
          // You can use the sessionUpdateEmitter pattern if needed (similar to childrenUpdateEmitter)
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
          // Note: CustomEvent is not available in React Native
          // Components should listen to Supabase real-time updates directly
        }
      )
      .subscribe();

    channelsRef.current = [
      { channel: alertsChannel, unsubscribe: () => supabase.removeChannel(alertsChannel) },
      { channel: messagesChannel, unsubscribe: () => supabase.removeChannel(messagesChannel) },
      { channel: childrenChannel, unsubscribe: () => supabase.removeChannel(childrenChannel) },
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
