/**
 * MessageList Component
 * Displays a list of conversations (1 parent + 1 sitter = 1 conversation)
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
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import { getConversationsForUser, subscribeToConversationsList, ConversationWithMeta } from '@/src/services/chatService';
import { formatDistanceToNow } from 'date-fns';

interface MessageListProps {
  userId: string;
  userRole: 'parent' | 'sitter';
  onConversationPress: (conversationId: string, otherUserId: string, otherUserName: string) => void;
  onConversationsChange?: (hasConversations: boolean) => void;
}

export default function MessageList({ userId, userRole, onConversationPress, onConversationsChange }: MessageListProps) {
  const { colors } = useTheme();
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getConversationsForUser(userId, userRole);
      if (result.success && result.data) {
        const sorted = [...result.data].sort((a, b) => {
          const aTime = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : new Date(a.conversation.created_at).getTime();
          const bTime = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : new Date(b.conversation.created_at).getTime();
          return bTime - aTime;
        });
        setConversations(sorted);
        onConversationsChange?.(sorted.length > 0);
      } else {
        setConversations([]);
        onConversationsChange?.(false);
      }
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

  // Real-time: when any new message arrives in any conversation, refresh the list
  const conversationIdsKey = conversations.length ? [...conversations.map((c) => c.conversation.id)].sort().join(',') : '';
  useEffect(() => {
    if (!conversationIdsKey) return;
    const ids = conversationIdsKey.split(',');
    const unsubscribe = subscribeToConversationsList(ids, () => loadConversations(true));
    return () => unsubscribe();
  }, [conversationIdsKey, loadConversations]);

  const renderConversation = ({ item }: { item: ConversationWithMeta }) => {
    const timeText = item.lastMessage
      ? formatDistanceToNow(new Date(item.lastMessage.created_at), { addSuffix: true })
      : formatDistanceToNow(new Date(item.conversation.created_at), { addSuffix: true });
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={[styles.conversationItem, { backgroundColor: (colors as any).card ?? colors.background }]}
        onPress={() => onConversationPress(item.conversation.id, item.otherUser.id, item.otherUser.name)}
        activeOpacity={0.8}
      >
        <View style={[styles.avatarWrap, hasUnread && styles.avatarWrapUnread]}>
          {item.otherUser.imageUrl ? (
            <Image
              source={{ uri: item.otherUser.imageUrl }}
              style={styles.avatar}
              defaultSource={require('@/assets/images/adult.webp')}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
              <Ionicons name="person" size={26} color={colors.textSecondary} />
            </View>
          )}
          {hasUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>

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
            <Text
              style={[
                styles.lastMessage,
                { color: colors.textSecondary },
                hasUnread && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage?.message || 'No messages yet'}
            </Text>
            {hasUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
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
    const emptyTitle = 'No messages yet';
    const emptyMessage =
      userRole === 'parent'
        ? 'Your conversations with sitters will appear here after you book a session. Start a session from Home or Search to message a sitter.'
        : 'Your conversations with parents will appear here once you accept or complete sessions.';
    return (
      <Card style={styles.emptyCard}>
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title={emptyTitle}
          message={emptyMessage}
        />
      </Card>
    );
  }

  return (
    <FlatList
      data={conversations}
      renderItem={renderConversation}
      keyExtractor={(item) => item.conversation.id}
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
    paddingBottom: 24,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 2,
    borderRadius: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarWrapUnread: {},
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationContent: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  conversationName: {
    fontSize: 17,
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
    gap: 8,
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
  },
  lastMessageUnread: {
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    margin: 16,
  },
});
