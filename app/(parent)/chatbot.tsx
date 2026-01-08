/**
 * Chatbot Screen for Parent
 * Full-screen chatbot interface for asking questions about child care
 */
import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import ChatbotInterface from '@/src/components/chatbot/ChatbotInterface';
import Header from '@/src/components/ui/Header';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import { Ionicons } from '@expo/vector-icons';

export default function ChatbotScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { sessionId, childId, sitterId } = useLocalSearchParams<{
    sessionId?: string;
    childId?: string;
    sitterId?: string;
  }>();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  // If no session context, show empty state or redirect
  if (!sessionId || !childId || !sitterId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          showLogo={true} 
          title="AI Assistant" 
          showBack={true}
          rightComponent={
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="menu" size={30} color={colors.text} />
            </TouchableOpacity>
          }
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Please access the chatbot from an active session
          </Text>
        </View>
        <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ChatbotInterface
        sessionId={sessionId}
        childId={childId}
        sitterId={sitterId}
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
