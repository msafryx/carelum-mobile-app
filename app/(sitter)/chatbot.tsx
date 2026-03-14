/**
 * Child Assistant Screen for Sitter
 * Instruction-based Q&A about the child (allergies, feeding, sleep, medicine, emergency).
 */
import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { useAuth } from '@/src/hooks/useAuth';
import ChatbotInterface from '@/src/components/chatbot/ChatbotInterface';
import Header from '@/src/components/ui/Header';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { Ionicons } from '@expo/vector-icons';

export default function SitterChatbotScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { sessionId, childId } = useLocalSearchParams<{
    sessionId?: string;
    childId?: string;
  }>();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  if (!sessionId || !childId || !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          showLogo={true}
          title="Child Assistant"
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
          <Ionicons name="reader-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Please open the Child Assistant from an active session.
          </Text>
        </View>
        <SitterHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
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
