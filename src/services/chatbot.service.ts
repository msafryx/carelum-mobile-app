/**
 * Chatbot Service
 * Handles chatbot interactions and conversation storage
 */
import { firestore } from '@/src/config/firebase';
import { BotAskResponse } from '@/src/types/api.types';
import { ServiceResult } from '@/src/types/error.types';
import { handleFirestoreError, retryWithBackoff } from '@/src/utils/errorHandler';
import {
    collection,
    doc,
    getDocs,
    limit,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import { askBot } from './api.service';

const COLLECTION_NAME = 'chatbotConversations';

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
    // Try to find existing conversation
    const q = query(
      collection(firestore!, COLLECTION_NAME),
      where('sessionId', '==', sessionId),
      limit(1)
    );

    const snapshot = await retryWithBackoff(async () => getDocs(q));

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        success: true,
        data: {
          id: doc.id,
          ...data,
          messages: data.messages?.map((msg: any) => ({
            ...msg,
            timestamp: (msg.timestamp as Timestamp)?.toDate() || new Date(),
          })),
          lastActivityAt: (data.lastActivityAt as Timestamp)?.toDate() || new Date(),
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
        } as ChatbotConversation,
      };
    }

    // Create new conversation
    const conversationRef = doc(collection(firestore!, COLLECTION_NAME));
    const newConversation: ChatbotConversation = {
      id: conversationRef.id,
      sessionId,
      sitterId,
      childId,
      messages: [],
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await retryWithBackoff(async () => {
      await setDoc(conversationRef, {
        ...newConversation,
        lastActivityAt: Timestamp.fromDate(newConversation.lastActivityAt),
        createdAt: Timestamp.fromDate(newConversation.createdAt),
        updatedAt: Timestamp.fromDate(newConversation.updatedAt),
      });
    });

    return { success: true, data: newConversation };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Ask chatbot a question
 */
export async function askChatbot(
  sessionId: string,
  sitterId: string,
  childId: string,
  question: string
): Promise<ServiceResult<BotAskResponse>> {
  try {
    // 1. Get or create conversation
    const conversationResult = await getOrCreateConversation(sessionId, sitterId, childId);
    if (!conversationResult.success || !conversationResult.data) {
      return conversationResult as any;
    }

    const conversation = conversationResult.data;

    // 2. Add user message to conversation
    const userMessage: ChatbotMessage = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    // 3. Call FastAPI chatbot endpoint
    const botResponse = await askBot({
      sessionId,
      question,
    });

    if (!botResponse.success || !botResponse.data) {
      return botResponse;
    }

    // 4. Add assistant message to conversation
    const assistantMessage: ChatbotMessage = {
      role: 'assistant',
      content: botResponse.data.answer,
      timestamp: new Date(),
      sources: botResponse.data.sources,
    };

    // 5. Update conversation in Firestore
    const conversationRef = doc(firestore!, COLLECTION_NAME, conversation.id!);
    await retryWithBackoff(async () => {
      await updateDoc(conversationRef, {
        messages: [
          ...conversation.messages,
          {
            ...userMessage,
            timestamp: Timestamp.fromDate(userMessage.timestamp),
          },
          {
            ...assistantMessage,
            timestamp: Timestamp.fromDate(assistantMessage.timestamp),
          },
        ],
        instructionsUsed: botResponse.data?.sources || [],
        lastActivityAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });

    return botResponse;
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  sessionId: string
): Promise<ServiceResult<ChatbotConversation | null>> {
  try {
    const q = query(
      collection(firestore!, COLLECTION_NAME),
      where('sessionId', '==', sessionId),
      limit(1)
    );

    const snapshot = await retryWithBackoff(async () => getDocs(q));

    if (snapshot.empty) {
      return { success: true, data: null };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      success: true,
      data: {
        id: doc.id,
        ...data,
        messages: data.messages?.map((msg: any) => ({
          ...msg,
          timestamp: (msg.timestamp as Timestamp)?.toDate() || new Date(),
        })),
        lastActivityAt: (data.lastActivityAt as Timestamp)?.toDate() || new Date(),
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
      } as ChatbotConversation,
    };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}
