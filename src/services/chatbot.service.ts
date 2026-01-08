/**
 * Chatbot Service - Supabase
 * Handles chatbot interactions and conversation storage
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { BotAskResponse } from '@/src/types/api.types';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { askBot } from './api.service';

export interface ChatbotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

export interface ChatbotConversation {
  id?: string;
  sessionId: string;
  sitterId: string;
  childId: string;
  messages: ChatbotMessage[];
  instructionsUsed?: string[];
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get or create conversation for a session
 */
export async function getOrCreateConversation(
  sessionId: string,
  sitterId: string,
  childId: string
): Promise<ServiceResult<ChatbotConversation>> {
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

    // Note: Chatbot conversations can be stored in a separate table if needed
    // For now, we'll use a simple in-memory approach or store in AsyncStorage
    // This can be extended to use Supabase if needed

    const conversation: ChatbotConversation = {
      sessionId,
      sitterId,
      childId,
      messages: [],
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { success: true, data: conversation };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Send message to chatbot
 */
export async function sendChatbotMessage(
  conversationId: string,
  message: string,
  sessionId: string,
  childId: string
): Promise<ServiceResult<BotAskResponse>> {
  try {
    // Call API service
    const result = await askBot(message, sessionId, childId);
    
    if (!result.success) {
      return result;
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Save conversation
 */
export async function saveConversation(
  conversation: ChatbotConversation
): Promise<ServiceResult<void>> {
  // Conversations can be stored in AsyncStorage or Supabase if needed
  // For now, this is a placeholder
  return { success: true };
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  sessionId: string
): Promise<ServiceResult<ChatbotConversation | null>> {
  // Can be implemented to fetch from Supabase or AsyncStorage
  return { success: true, data: null };
}
