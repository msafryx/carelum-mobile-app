/**
 * Chat Messages Service - Supabase
 * Handles real-time chat messaging
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';

export interface ChatMessage {
  id?: string;
  sessionId?: string;
  senderId: string;
  receiverId: string;
  message: string;
  messageType?: 'text' | 'image' | 'audio' | 'location';
  attachmentUrl?: string;
  readAt?: Date;
  createdAt: Date;
}

/**
 * Send a chat message
 */
export async function sendMessage(
  messageData: Omit<ChatMessage, 'id' | 'createdAt'>
): Promise<ServiceResult<ChatMessage>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: messageData.sessionId || null,
        sender_id: messageData.senderId,
        receiver_id: messageData.receiverId,
        message: messageData.message,
        message_type: messageData.messageType || 'text',
        attachment_url: messageData.attachmentUrl || null,
        read_at: null,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to send message: ${error.message}`,
        },
      };
    }

    const message: ChatMessage = {
      id: data.id,
      sessionId: data.session_id,
      senderId: data.sender_id,
      receiverId: data.receiver_id,
      message: data.message,
      messageType: data.message_type,
      attachmentUrl: data.attachment_url,
      readAt: data.read_at ? new Date(data.read_at) : undefined,
      createdAt: new Date(data.created_at),
    };

    return { success: true, data: message };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get messages for a session or between two users
 */
export async function getMessages(
  sessionId?: string,
  userId1?: string,
  userId2?: string,
  limitCount: number = 50
): Promise<ServiceResult<ChatMessage[]>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    let query = supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limitCount);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else if (userId1 && userId2) {
      query = query.or(`sender_id.eq.${userId1},receiver_id.eq.${userId1}`)
        .or(`sender_id.eq.${userId2},receiver_id.eq.${userId2}`);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch messages: ${error.message}`,
        },
      };
    }

    const messages: ChatMessage[] = (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      message: row.message,
      messageType: row.message_type,
      attachmentUrl: row.attachment_url,
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      createdAt: new Date(row.created_at),
    }));

    // Reverse to show oldest first
    return { success: true, data: messages.reverse() };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(messageId: string): Promise<ServiceResult<void>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    const { error } = await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to mark message as read: ${error.message}`,
        },
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Subscribe to messages (real-time)
 * Uses Supabase Realtime
 */
export function subscribeToMessages(
  sessionId: string | undefined,
  userId: string,
  callback: (message: ChatMessage) => void
): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('⚠️ Supabase not configured, cannot subscribe to messages');
    return () => {};
  }

  let filter = `receiver_id=eq.${userId}`;
  if (sessionId) {
    filter = `session_id=eq.${sessionId}`;
  }

  const channel = supabase
    .channel(`messages-${userId}-${sessionId || 'all'}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: filter,
      },
      (payload: any) => {
        const message: ChatMessage = {
          id: payload.new.id,
          sessionId: payload.new.session_id,
          senderId: payload.new.sender_id,
          receiverId: payload.new.receiver_id,
          message: payload.new.message,
          messageType: payload.new.message_type,
          attachmentUrl: payload.new.attachment_url,
          readAt: payload.new.read_at ? new Date(payload.new.read_at) : undefined,
          createdAt: new Date(payload.new.created_at),
        };
        callback(message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
