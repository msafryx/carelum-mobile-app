/**
 * ChatInterface Component
 * Displays a chat thread for a session with real-time messaging
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { getMessages, sendMessage, subscribeToMessages, ChatMessage, markMessageAsRead } from '@/src/services/chat-messages.service';
import { format } from 'date-fns';

interface ChatInterfaceProps {
  sessionId: string;
  userId: string;
  otherUserName: string;
  onBack?: () => void;
}

export default function ChatInterface({
  sessionId,
  userId,
  otherUserName,
  onBack,
}: ChatInterfaceProps) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getMessages(sessionId, undefined, undefined, 100);
      if (result.success && result.data) {
        // Sort by creation time (oldest first)
        const sortedMessages = [...result.data].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );
        setMessages(sortedMessages);

        // Mark unread messages as read
        const unreadMessages = sortedMessages.filter(
          (msg) => msg.receiverId === userId && !msg.readAt && msg.id
        );
        for (const msg of unreadMessages) {
          if (msg.id) {
            await markMessageAsRead(msg.id);
          }
        }

        // Scroll to bottom after a short delay
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error: any) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, userId]);

  useEffect(() => {
    loadMessages();

    // Subscribe to new messages
    const unsubscribe = subscribeToMessages(sessionId, userId, (newMessage) => {
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some((msg) => msg.id === newMessage.id)) {
          return prev;
        }
        // Add new message and sort
        const updated = [...prev, newMessage].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return updated;
      });

      // Mark as read if we're the receiver
      if (newMessage.receiverId === userId && newMessage.id) {
        markMessageAsRead(newMessage.id);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId, userId, loadMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // Determine receiver ID (the other user in the session)
      // We need to get the session to find the other user
      const { getSessionById } = await import('@/src/services/session.service');
      const sessionResult = await getSessionById(sessionId);
      
      if (!sessionResult.success || !sessionResult.data) {
        throw new Error('Session not found');
      }

      const session = sessionResult.data;
      const receiverId = session.parentId === userId ? session.sitterId : session.parentId;

      if (!receiverId) {
        throw new Error('Receiver ID not found');
      }

      const result = await sendMessage({
        sessionId,
        senderId: userId,
        receiverId,
        message: messageText,
        messageType: 'text',
      });

      if (!result.success) {
        // Restore input text on error
        setInputText(messageText);
        console.error('Failed to send message:', result.error);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isSent = item.senderId === userId;
    const showTime = true; // Always show time for now

    return (
      <View
        style={[
          styles.messageContainer,
          isSent ? styles.sentMessage : styles.receivedMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isSent ? colors.primary : colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isSent ? colors.white : colors.text },
            ]}
          >
            {item.message}
          </Text>
          {showTime && (
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.messageTime,
                  { color: isSent ? colors.white + 'CC' : colors.textSecondary },
                ]}
              >
                {format(item.createdAt, 'h:mm a')}
              </Text>
              {isSent && item.readAt && (
                <Ionicons
                  name="checkmark-done"
                  size={14}
                  color={colors.white + 'CC'}
                  style={styles.readIcon}
                />
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {onBack && (
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{otherUserName}</Text>
          <View style={styles.backButton} />
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.id || `message-${index}`}
        contentContainerStyle={styles.messagesList}
        inverted={false}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No messages yet. Start the conversation!
            </Text>
          </View>
        }
      />

      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
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
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
    gap: 8,
  },
  messageContainer: {
    marginBottom: 8,
  },
  sentMessage: {
    alignItems: 'flex-end',
  },
  receivedMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  readIcon: {
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
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
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
