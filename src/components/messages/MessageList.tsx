/**
 * MessageList Component
 * Displays a list of conversations (sessions with messages)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { getUserSessions } from '@/src/services/session.service';
import { getMessages, ChatMessage } from '@/src/services/chat-messages.service';
import { getChildById } from '@/src/services/child.service';
import { getUserById } from '@/src/services/admin.service';
import { Session } from '@/src/types/session.types';
import { format, formatDistanceToNow } from 'date-fns';
import { SESSION_STATUS } from '@/src/config/constants';

interface Conversation {
  sessionId: string;
  session: Session;
  otherUser: {
    id: string;
    name: string;
    imageUrl?: string;
  };
  lastMessage?: ChatMessage;
  unreadCount: number;
  childName?: string;
}

interface MessageListProps {
  userId: string;
  userRole: 'parent' | 'sitter';
  onConversationPress: (sessionId: string, otherUserId: string, otherUserName: string) => void;
  onConversationsChange?: (hasConversations: boolean) => void;
}

export default function MessageList({ userId, userRole, onConversationPress, onConversationsChange }: MessageListProps) {
  const { colors } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Get all sessions for this user (active, accepted, completed)
      const [activeResult, acceptedResult, completedResult] = await Promise.all([
        getUserSessions(userId, userRole, SESSION_STATUS.ACTIVE),
        getUserSessions(userId, userRole, SESSION_STATUS.ACCEPTED),
        getUserSessions(userId, userRole, SESSION_STATUS.COMPLETED),
      ]);

      const allSessions: Session[] = [
        ...(activeResult.success ? activeResult.data || [] : []),
        ...(acceptedResult.success ? acceptedResult.data || [] : []),
        ...(completedResult.success ? completedResult.data || [] : []),
      ];

      // Build conversations from sessions
      const conversationsData: Conversation[] = await Promise.all(
        allSessions.map(async (session) => {
          // Get the other user (parent or sitter)
          const otherUserId = userRole === 'parent' ? session.sitterId : session.parentId;
          if (!otherUserId) {
            return null;
          }

          // Get other user details
          const otherUserResult = await getUserById(otherUserId);
          const otherUser = {
            id: otherUserId,
            name: otherUserResult.success && otherUserResult.data
              ? otherUserResult.data.displayName || 'User'
              : 'User',
            imageUrl: otherUserResult.success && otherUserResult.data
              ? otherUserResult.data.profileImageUrl
              : undefined,
          };

          // Get child name
          let childName: string | undefined;
          if (session.childId) {
            const childResult = await getChildById(session.childId);
            if (childResult.success && childResult.data) {
              childName = childResult.data.name;
            }
          }

          // Get last message
          const messagesResult = await getMessages(session.id, undefined, undefined, 1);
          const lastMessage = messagesResult.success && messagesResult.data && messagesResult.data.length > 0
            ? messagesResult.data[0]
            : undefined;

          // Count unread messages (messages not read by current user)
          const allMessagesResult = await getMessages(session.id, undefined, undefined, 100);
          const unreadCount = allMessagesResult.success && allMessagesResult.data
            ? allMessagesResult.data.filter(
                (msg) => msg.receiverId === userId && !msg.readAt
              ).length
            : 0;

          return {
            sessionId: session.id,
            session,
            otherUser,
            lastMessage,
            unreadCount,
            childName,
          };
        })
      );

      // Filter out nulls and sort by last message time
      const validConversations = conversationsData.filter(
        (conv): conv is Conversation => conv !== null
      ).sort((a, b) => {
        const aTime = a.lastMessage?.createdAt.getTime() || a.session.createdAt.getTime();
        const bTime = b.lastMessage?.createdAt.getTime() || b.session.createdAt.getTime();
        return bTime - aTime;
      });

      setConversations(validConversations);
      onConversationsChange?.(validConversations.length > 0);
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      setConversations([]);
      onConversationsChange?.(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, userRole, onConversationsChange]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const renderConversation = ({ item }: { item: Conversation }) => {
    const timeText = item.lastMessage
      ? formatDistanceToNow(item.lastMessage.createdAt, { addSuffix: true })
      : format(item.session.createdAt, 'MMM dd, yyyy');

    return (
      <TouchableOpacity
        style={[styles.conversationItem, { backgroundColor: colors.card }]}
        onPress={() => onConversationPress(item.sessionId, item.otherUser.id, item.otherUser.name)}
        activeOpacity={0.7}
      >
        {item.otherUser.imageUrl ? (
          <Image
            source={{ uri: item.otherUser.imageUrl }}
            style={styles.avatar}
            defaultSource={require('@/assets/images/adult.webp')}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="person" size={24} color={colors.textSecondary} />
          </View>
        )}

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationName, { color: colors.text }]} numberOfLines={1}>
              {item.otherUser.name}
            </Text>
            <Text style={[styles.conversationTime, { color: colors.textSecondary }]}>
              {timeText}
            </Text>
          </View>

          <View style={styles.conversationFooter}>
            {item.childName && (
              <Text style={[styles.childName, { color: colors.textSecondary }]}>
                {item.childName} •{' '}
              </Text>
            )}
            <Text
              style={[styles.lastMessage, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.lastMessage?.message || 'No messages yet'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (conversations.length === 0) {
    return null; // Empty state handled by parent
  }

  return (
    <FlatList
      data={conversations}
      renderItem={renderConversation}
      keyExtractor={(item) => item.sessionId}
      refreshing={refreshing}
      onRefresh={() => loadConversations(true)}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
    gap: 4,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  conversationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  childName: {
    fontSize: 14,
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
