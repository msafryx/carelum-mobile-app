/**
 * Chatbot Interface Component
 * Complete chat UI with message bubbles, input field, loading states, and error handling
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import {
  getOrCreateConversation,
  sendChatbotMessage,
  ChatbotMessage,
  ChatbotConversation,
} from '@/src/services/chatbot.service';
import { format } from 'date-fns';

interface ChatbotInterfaceProps {
  sessionId: string;
  childId: string;
  sitterId: string;
  onClose?: () => void;
}

export default function ChatbotInterface({
  sessionId,
  childId,
  sitterId,
  onClose,
}: ChatbotInterfaceProps) {
  const { colors, spacing } = useTheme();
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ChatbotConversation | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize conversation
  useEffect(() => {
    initializeConversation();
  }, [sessionId, childId, sitterId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const initializeConversation = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOrCreateConversation(sessionId, sitterId, childId);
      if (result.success && result.data) {
        setConversation(result.data);
        setMessages(result.data.messages || []);
      } else {
        setError(result.error?.message || 'Failed to initialize conversation');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || sending || !conversation) return;

    const userMessage: ChatbotMessage = {
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setSending(true);
    setError(null);

    try {
      const result = await sendChatbotMessage(
        conversation.id || '',
        userMessage.content,
        sessionId,
        childId
      );

      if (result.success && result.data) {
        const assistantMessage: ChatbotMessage = {
          role: 'assistant',
          content: result.data.answer || 'I apologize, but I couldn\'t generate a response.',
          timestamp: new Date(),
          sources: result.data.sources,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Update conversation
        if (conversation) {
          const updatedConversation: ChatbotConversation = {
            ...conversation,
            messages: [...messages, userMessage, assistantMessage],
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          };
          setConversation(updatedConversation);
        }
      } else {
        setError(result.error?.message || 'Failed to send message');
        // Remove user message on error
        setMessages((prev) => prev.slice(0, -1));
        Alert.alert('Error', result.error?.message || 'Failed to send message');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setMessages((prev) => prev.slice(0, -1));
      Alert.alert('Error', err.message || 'An error occurred while sending message');
    } finally {
      setSending(false);
    }
  }, [inputText, sending, conversation, sessionId, childId, messages]);

  const renderMessage = (message: ChatbotMessage, index: number) => {
    const isUser = message.role === 'user';
    return (
      <View
        key={index}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isUser ? colors.primary : colors.backgroundSecondary,
              alignSelf: isUser ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isUser ? colors.white : colors.text },
            ]}
          >
            {message.content}
          </Text>
          {message.sources && message.sources.length > 0 && (
            <View style={styles.sourcesContainer}>
              <Text style={[styles.sourcesLabel, { color: colors.textSecondary }]}>
                Sources:
              </Text>
              {message.sources.map((source, idx) => (
                <Text key={idx} style={[styles.sourceText, { color: colors.textSecondary }]}>
                  • {source}
                </Text>
              ))}
            </View>
          )}
          <Text
            style={[
              styles.messageTime,
              { color: isUser ? colors.white + 'CC' : colors.textSecondary },
            ]}
          >
            {format(message.timestamp, 'h:mm a')}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading chatbot...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.white, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubbles" size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Assistant</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.error + '20' }]}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Start a conversation
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Ask me anything about child care instructions for this session.
            </Text>
          </View>
        ) : (
          messages.map((message, index) => renderMessage(message, index))
        )}
        {sending && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={[styles.typingText, { color: colors.textSecondary }]}>
              AI is thinking...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Type your message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!sending}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() && !sending ? colors.primary : colors.border,
            },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={20} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  messageContainer: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  sourcesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  sourcesLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  sourceText: {
    fontSize: 11,
    marginLeft: 8,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
