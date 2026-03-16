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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { askChildAssistant } from '@/src/services/chatbot.service';
import { format } from 'date-fns';

const QUICK_PROMPTS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Allergies', icon: 'warning-outline' },
  { label: 'Feeding instructions', icon: 'restaurant-outline' },
  { label: 'Sleep routine', icon: 'moon-outline' },
  { label: 'Medicine schedule', icon: 'medical-outline' },
  { label: 'Emergency contacts', icon: 'call-outline' },
];

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
  const insets = useSafeAreaInsets();
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
      // Show error in-app only (no duplicate Alert) for cleaner UX
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
      <View
        style={[
          styles.header,
          {
            paddingTop: (insets.top || 0) + 20,
            paddingBottom: 18,
            paddingHorizontal: 20,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="reader-outline" size={20} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Child Assistant</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: (colors.error || '#dc2626') + '15', borderLeftColor: colors.error || '#dc2626' }]}>
          <Ionicons name="alert-circle" size={20} color={colors.error || '#dc2626'} />
          <Text style={[styles.errorText, { color: colors.text }]} numberOfLines={2}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)} style={styles.errorDismiss}>
            <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
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
              {QUICK_PROMPTS.map(({ label, icon }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.quickBtn, { backgroundColor: colors.backgroundSecondary || (colors.background + '99'), borderColor: colors.border }]}
                  onPress={() => ask(label)}
                  disabled={sending}
                  activeOpacity={0.7}
                >
                  <Ionicons name={icon} size={20} color={colors.primary} style={styles.quickBtnIcon} />
                  <Text style={[styles.quickBtnText, { color: colors.text }]}>{label}</Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  closeBtn: { padding: 6 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderLeftWidth: 4,
  },
  errorDismiss: { padding: 4 },
  errorText: { flex: 1, fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  empty: { paddingVertical: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, marginBottom: 20 },
  quickPrompts: { gap: 10 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  quickBtnIcon: { marginRight: 12 },
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
