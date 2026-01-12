/**
 * Chat Messages Service - REST API
 * Handles real-time chat messaging
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { apiRequest } from './api-base.service';
import { API_ENDPOINTS } from '@/src/config/constants';

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
    if (!messageData.sessionId) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'Session ID is required',
        },
      };
    }

    const apiData = {
      receiverId: messageData.receiverId,
      message: messageData.message,
      messageType: messageData.messageType || 'text',
      attachmentUrl: messageData.attachmentUrl || undefined,
    };

    const result = await apiRequest<any>(API_ENDPOINTS.SESSION_MESSAGES(messageData.sessionId), {
      method: 'POST',
      body: JSON.stringify(apiData),
    });

    if (!result.success) {
      return result;
    }

    const apiMessage = result.data;
    const message: ChatMessage = {
      id: apiMessage.id,
      sessionId: apiMessage.sessionId,
      senderId: apiMessage.senderId,
      receiverId: apiMessage.receiverId,
      message: apiMessage.message,
      messageType: apiMessage.messageType,
      attachmentUrl: apiMessage.attachmentUrl,
      readAt: apiMessage.readAt ? new Date(apiMessage.readAt) : undefined,
      createdAt: new Date(apiMessage.createdAt),
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
    // API only supports session-based messages
    if (!sessionId) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'Session ID is required for API',
        },
      };
    }

    const endpoint = `${API_ENDPOINTS.SESSION_MESSAGES(sessionId)}?limit=${limitCount}`;
    const result = await apiRequest<any[]>(endpoint);

    if (!result.success) {
      return result;
    }

    const messages: ChatMessage[] = (result.data || []).map((apiMessage: any) => ({
      id: apiMessage.id,
      sessionId: apiMessage.sessionId,
      senderId: apiMessage.senderId,
      receiverId: apiMessage.receiverId,
      message: apiMessage.message,
      messageType: apiMessage.messageType,
      attachmentUrl: apiMessage.attachmentUrl,
      readAt: apiMessage.readAt ? new Date(apiMessage.readAt) : undefined,
      createdAt: new Date(apiMessage.createdAt),
    }));

    return { success: true, data: messages };
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
    const result = await apiRequest<any>(API_ENDPOINTS.MESSAGE_READ(messageId), {
      method: 'PUT',
    });

    if (!result.success) {
      return result;
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
