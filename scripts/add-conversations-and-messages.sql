-- =============================================================================
-- Conversation-based chat: 1 parent + 1 sitter = 1 conversation
-- Run this after create-supabase-schema.sql
-- =============================================================================

-- Conversations: one row per (parent, sitter) pair
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sitter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, sitter_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_parent_id ON conversations(parent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_sitter_id ON conversations(sitter_id);

-- Messages: linked to conversation (not session)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('parent', 'sitter', 'system')),
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'location', 'system')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- RLS: conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversations: parent and sitter can read own"
  ON conversations FOR SELECT USING (
    parent_id = auth.uid() OR sitter_id = auth.uid()
  );

CREATE POLICY "Conversations: parent or sitter can insert (create conversation)"
  ON conversations FOR INSERT WITH CHECK (parent_id = auth.uid() OR sitter_id = auth.uid());

-- RLS: messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages: conversation participants can read"
  ON messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.parent_id = auth.uid() OR c.sitter_id = auth.uid())
    )
  );

CREATE POLICY "Messages: conversation participants can insert"
  ON messages FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.parent_id = auth.uid() OR c.sitter_id = auth.uid())
    )
  );

CREATE POLICY "Messages: conversation participants can update (e.g. read_at)"
  ON messages FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.parent_id = auth.uid() OR c.sitter_id = auth.uid())
    )
  );
