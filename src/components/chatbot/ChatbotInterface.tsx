/**
 * Child Assistant Interface (instruction-based)
 * Ask about the child: allergies, feeding, sleep, medicine, emergency contacts.
 * Not a messaging system – knowledge assistant from child profile + instructions.
 */
import React, { useState, useRef, useEffect } from 'react';
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
import { askChildAssistant } from '@/src/services/chatbot.service';
import { format } from 'date-fns';

const QUICK_PROMPTS = [
  'Allergies',
  'Feeding instructions',
  'Sleep routine',
  'Medicine schedule',
  'Emergency contacts',
] as const;

interface ChatbotInterfaceProps {
  sessionId: string;
  childId: string;
  sitterId?: string;
  onClose?: () => void;
}

interface QAMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatbotInterface({
  sessionId,
  childId,
  onClose,
}: ChatbotInterfaceProps) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const ask = async (question: string) => {
    if (!question.trim() || sending) return;
    const q = question.trim();
    setMessages((prev) => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
    setInputText('');
    setSending(true);
    setError(null);

    const result = await askChildAssistant(sessionId, childId, q);
    setSending(false);

    if (result.success && result.data) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.data!.answer, timestamp: new Date() },
      ]);
    } else {
      setError(result.error?.message || 'Failed to get answer');
      setMessages((prev) => prev.slice(0, -1));
      Alert.alert('Error', result.error?.message || 'Failed to get answer');
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || sending) return;
    ask(inputText.trim());
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="reader-outline" size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Child Assistant</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: (colors.error || '#dc2626') + '20' }]}>
          <Ionicons name="alert-circle" size={20} color={colors.error || '#dc2626'} />
          <Text style={[styles.errorText, { color: colors.error || '#dc2626' }]}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={20} color={colors.error || '#dc2626'} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Ask about the child</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Get quick answers from the child’s profile and instructions.
            </Text>
            <View style={styles.quickPrompts}>
              {QUICK_PROMPTS.map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.quickBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                  onPress={() => ask(label)}
                  disabled={sending}
                >
                  <Text style={[styles.quickBtnText, { color: colors.primary }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          messages.map((msg, i) => (
            <View
              key={i}
              style={[
                styles.bubbleWrap,
                msg.role === 'user' ? styles.userWrap : styles.assistantWrap,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: msg.role === 'user' ? colors.primary : colors.backgroundSecondary,
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: msg.role === 'user' ? '#fff' : colors.text },
                  ]}
                >
                  {msg.content}
                </Text>
                <Text
                  style={[
                    styles.time,
                    { color: msg.role === 'user' ? 'rgba(255,255,255,0.8)' : colors.textSecondary },
                  ]}
                >
                  {format(msg.timestamp, 'h:mm a')}
                </Text>
              </View>
            </View>
          ))
        )}
        {sending && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={[styles.typingText, { color: colors.textSecondary }]}>Looking up...</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Type a question..."
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
            styles.sendBtn,
            {
              backgroundColor: inputText.trim() && !sending ? colors.primary : colors.border,
            },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  empty: { paddingVertical: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, marginBottom: 20 },
  quickPrompts: { gap: 10 },
  quickBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  quickBtnText: { fontSize: 15, fontWeight: '600' },
  bubbleWrap: { marginBottom: 12 },
  userWrap: { alignItems: 'flex-end' },
  assistantWrap: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  typingText: { fontSize: 14, fontStyle: 'italic' },
  inputRow: {
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
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
