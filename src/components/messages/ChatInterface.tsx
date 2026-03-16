/**
 * ChatInterface Component
 * Conversation-based chat: 1 parent + 1 sitter = 1 conversation (real-time)
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
import {
  loadConversationMessages,
  sendMessage as sendChatMessage,
  subscribeToConversation,
  markMessagesAsRead,
  ChatMessageRow,
} from '@/src/services/chatService';
import { format } from 'date-fns';

interface ChatInterfaceProps {
  conversationId: string;
  userId: string;
  userRole: 'parent' | 'sitter';
  otherUserName: string;
  onBack?: () => void;
}

export default function ChatInterface({
  conversationId,
  userId,
  userRole,
  otherUserName,
  onBack,
}: ChatInterfaceProps) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loadConversationMessages(conversationId, 100);
      if (result.success && result.data) {
        setMessages(result.data);
        await markMessagesAsRead(conversationId, userId);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (error: any) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    loadMessages();

    const unsubscribe = subscribeToConversation(conversationId, (payload: ChatMessageRow) => {
      const newMessage = payload as ChatMessageRow;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        const updated = [...prev, newMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        if (newMessage.sender_id !== userId && newMessage.id) {
          markMessagesAsRead(conversationId, userId);
        }
        return updated;
      });
    });

    return () => unsubscribe();
  }, [conversationId, userId, loadMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const result = await sendChatMessage(conversationId, userId, userRole, text, 'text');
      if (!result.success) {
        setInputText(text);
        console.error('Failed to send message:', result.error);
      }
    } catch (error: any) {
      setInputText(text);
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessageRow }) => {
    const isSystem = item.sender_role === 'system';
    const isSent = item.sender_id === userId;

    if (isSystem) {
      return (
        <View style={styles.systemMessageWrap}>
          <View style={[styles.systemBubble, { backgroundColor: (colors as any).card ?? colors.background, borderColor: colors.border }]}>
            <Text style={[styles.systemText, { color: colors.textSecondary }]}>{item.message}</Text>
          </View>
        </View>
      );
    }

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
            isSent ? styles.messageBubbleSent : styles.messageBubbleReceived,
            {
              backgroundColor: isSent ? colors.primary : (colors as any).card ?? colors.background,
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
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                { color: isSent ? colors.white + 'CC' : colors.textSecondary },
              ]}
            >
              {format(new Date(item.created_at), 'h:mm a')}
            </Text>
            {isSent && item.read_at && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={colors.white + 'CC'}
                style={styles.readIcon}
              />
            )}
          </View>
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
        <View style={[styles.header, styles.headerShadow, { backgroundColor: (colors as any).card ?? colors.background }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{otherUserName}</Text>
          <View style={styles.backButton} />
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No messages yet. Start the conversation!
            </Text>
          </View>
        }
      />

      <View style={[styles.inputContainer, styles.inputContainerShadow, { backgroundColor: (colors as any).card ?? colors.background }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
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
            <Ionicons name="send" size={22} color={colors.white} />
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
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  headerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  messageContainer: {
    marginBottom: 10,
  },
  sentMessage: {
    alignItems: 'flex-end',
  },
  receivedMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  messageBubbleSent: {
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  messageBubbleReceived: {
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
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
    marginLeft: 2,
  },
  systemMessageWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '90%',
  },
  systemText: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  inputContainerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
