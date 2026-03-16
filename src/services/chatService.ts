/**
 * Carelum Chat Service – conversation-based chat (1 parent + 1 sitter = 1 conversation)
 * Uses Supabase: conversations + messages tables, realtime subscriptions
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ServiceResult } from '@/src/types/error.types';

export interface Conversation {
  id: string;
  parent_id: string;
  sitter_id: string;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: 'parent' | 'sitter' | 'system';
  message: string;
  message_type: string;
  created_at: string;
  read_at: string | null;
}

export interface ConversationWithMeta {
  conversation: Conversation;
  otherUser: { id: string; name: string; imageUrl?: string };
  lastMessage?: ChatMessageRow;
  unreadCount: number;
}

/**
 * Get existing conversation or create one for this parent + sitter.
 */
export async function getOrCreateConversation(
  parentId: string,
  sitterId: string
): Promise<ServiceResult<Conversation>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.', details: null } };
    }

    const { data: existing, error: selectError } = await supabase
      .from('conversations')
      .select('*')
      .eq('parent_id', parentId)
      .eq('sitter_id', sitterId)
      .maybeSingle();

    if (selectError) {
      console.error('getOrCreateConversation select error:', selectError);
      return { success: false, error: { code: 'FETCH_FAILED', message: selectError.message, details: selectError.message } };
    }

    if (existing) {
      return { success: true, data: existing as Conversation };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('conversations')
      .insert({ parent_id: parentId, sitter_id: sitterId })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const retry = await supabase
          .from('conversations')
          .select('*')
          .eq('parent_id', parentId)
          .eq('sitter_id', sitterId)
          .single();
        if (retry.data) return { success: true, data: retry.data as Conversation };
      }
      return { success: false, error: { code: 'CREATE_FAILED', message: insertError.message, details: insertError.message } };
    }

    return { success: true, data: inserted as Conversation };
  } catch (e: any) {
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: e?.message ?? 'Failed to get or create conversation.', details: e?.message ?? null } };
  }
}

/**
 * Load messages for a conversation (oldest first).
 */
export async function loadConversationMessages(
  conversationId: string,
  limit = 100
): Promise<ServiceResult<ChatMessageRow[]>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.', details: null } };
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message, details: error.message } };
    }
    return { success: true, data: (data ?? []) as ChatMessageRow[] };
  } catch (e: any) {
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: e?.message ?? 'Failed to load messages.', details: e?.message ?? null } };
  }
}

/**
 * Send a text (or other type) message. Use sender_role 'parent' or 'sitter'.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderRole: 'parent' | 'sitter',
  text: string,
  messageType: 'text' | 'image' | 'audio' | 'location' = 'text'
): Promise<ServiceResult<ChatMessageRow>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.', details: null } };
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        message: text,
        message_type: messageType,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: 'SEND_FAILED', message: error.message, details: error.message } };
    }
    return { success: true, data: data as ChatMessageRow };
  } catch (e: any) {
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: e?.message ?? 'Failed to send message.', details: e?.message ?? null } };
  }
}

/**
 * Subscribe to new messages in a conversation (realtime).
 */
export function subscribeToConversation(
  conversationId: string,
  callback: (message: ChatMessageRow) => void
): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel(`conversation-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: { new: ChatMessageRow }) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to new messages in any of the given conversations (for list auto-update).
 * When any new message is inserted, onNewMessage() is called so the list can refetch.
 */
export function subscribeToConversationsList(
  conversationIds: string[],
  onNewMessage: () => void
): () => void {
  if (!isSupabaseConfigured() || !supabase || conversationIds.length === 0) {
    return () => {};
  }

  const channelName = `conversations-list-${conversationIds.join('-').slice(0, 50)}`;
  let channel = supabase.channel(channelName);

  conversationIds.forEach((id) => {
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      },
      () => onNewMessage()
    );
  });

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Mark all unread messages in a conversation as read (for the current user as receiver).
 */
export async function markMessagesAsRead(
  conversationId: string,
  readerId: string
): Promise<ServiceResult<void>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.', details: null } };
    }

    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', readerId)
      .is('read_at', null);

    if (error) {
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message, details: error.message } };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: e?.message ?? 'Failed to mark as read.', details: e?.message ?? null } };
  }
}

/**
 * Insert a system message (e.g. "Baby cry detected – Hungry").
 */
export async function sendSystemMessage(
  conversationId: string,
  message: string
): Promise<ServiceResult<ChatMessageRow>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.', details: null } };
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: (await supabase.auth.getUser()).data.user?.id ?? '00000000-0000-0000-0000-000000000000',
        sender_role: 'system',
        message,
        message_type: 'system',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: 'SEND_FAILED', message: error.message, details: error.message } };
    }
    return { success: true, data: data as ChatMessageRow };
  } catch (e: any) {
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: e?.message ?? 'Failed to send system message.', details: e?.message ?? null } };
  }
}

/**
 * List conversations for a user (parent or sitter) with last message and unread count.
 * Ensures a conversation exists for every session partner (creates on first open).
 */
export async function getConversationsForUser(
  userId: string,
  role: 'parent' | 'sitter'
): Promise<ServiceResult<ConversationWithMeta[]>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.', details: null } };
    }

    const { getUserSessions } = await import('@/src/services/session.service');
    const { SESSION_STATUS } = await import('@/src/config/constants');
    const [activeRes, acceptedRes, completedRes] = await Promise.all([
      getUserSessions(userId, role, SESSION_STATUS.ACTIVE),
      getUserSessions(userId, role, SESSION_STATUS.ACCEPTED),
      getUserSessions(userId, role, SESSION_STATUS.COMPLETED),
    ]);
    const sessions = [
      ...(activeRes.success ? activeRes.data ?? [] : []),
      ...(acceptedRes.success ? acceptedRes.data ?? [] : []),
      ...(completedRes.success ? completedRes.data ?? [] : []),
    ];
    const otherIds = new Set<string>();
    sessions.forEach((s) => {
      const other = role === 'parent' ? s.sitterId : s.parentId;
      if (other) otherIds.add(other);
    });

    const column = role === 'parent' ? 'parent_id' : 'sitter_id';
    const { data: convs, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq(column, userId)
      .order('created_at', { ascending: false });

    if (convError) {
      return { success: false, error: { code: 'FETCH_FAILED', message: convError.message, details: convError.message } };
    }

    const existingConvs = new Map<string, Conversation>();
    (convs ?? []).forEach((c) => {
      const other = role === 'parent' ? c.sitter_id : c.parent_id;
      existingConvs.set(other, c as Conversation);
    });

    for (const otherId of otherIds) {
      if (existingConvs.has(otherId)) continue;
      const parentId = role === 'parent' ? userId : otherId;
      const sitterId = role === 'parent' ? otherId : userId;
      const created = await getOrCreateConversation(parentId, sitterId);
      if (created.success && created.data) existingConvs.set(otherId, created.data);
    }

    const list: ConversationWithMeta[] = [];
    const { getUserById } = await import('@/src/services/admin.service');
    for (const c of Array.from(existingConvs.values())) {
      const otherId = role === 'parent' ? c.sitter_id : c.parent_id;
      const userRes = await getUserById(otherId);
      const otherUser = {
        id: otherId,
        name: userRes.success && userRes.data ? userRes.data.displayName || userRes.data.email?.split('@')[0] || 'User' : 'User',
        imageUrl: userRes.success && userRes.data ? (userRes.data as any).profileImageUrl : undefined,
      };

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const lastMessage = msgs?.[0] as ChatMessageRow | undefined;

      const { data: unread } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', c.id)
        .neq('sender_id', userId)
        .is('read_at', null);
      const unreadCount = unread?.length ?? 0;

      list.push({
        conversation: c,
        otherUser,
        lastMessage,
        unreadCount,
      });
    }

    list.sort((a, b) => {
      const aTime = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : new Date(a.conversation.created_at).getTime();
      const bTime = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : new Date(b.conversation.created_at).getTime();
      return bTime - aTime;
    });

    return { success: true, data: list };
  } catch (e: any) {
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: e?.message ?? 'Failed to load conversations.', details: e?.message ?? null } };
  }
}
