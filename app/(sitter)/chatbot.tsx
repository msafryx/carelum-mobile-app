/**
 * Chatbot Screen for Sitter
 * Full-screen chatbot interface for asking questions about child care
 */
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import ChatbotInterface from '@/src/components/chatbot/ChatbotInterface';
import Header from '@/src/components/ui/Header';
import { Ionicons } from '@expo/vector-icons';

export default function SitterChatbotScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { sessionId, childId } = useLocalSearchParams<{
    sessionId?: string;
    childId?: string;
  }>();
  const { user } = useAuth();

  // If no session context, show empty state
  if (!sessionId || !childId || !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showLogo={true} title="AI Assistant" showBack={true} />
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Please access the chatbot from an active session
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ChatbotInterface
        sessionId={sessionId}
        childId={childId}
        sitterId={user.id}
        onClose={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});
