import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import MessageList from '@/src/components/messages/MessageList';
import ChatInterface from '@/src/components/messages/ChatInterface';
import { useAuth } from '@/src/hooks/useAuth';

export default function SitterMessagesScreen() {
  const { colors } = useTheme();
  const { user, userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(null);
  const [selectedOtherUserName, setSelectedOtherUserName] = useState<string | null>(null);
  const [hasConversations, setHasConversations] = useState(false);

  const handleConversationPress = (sessionId: string, otherUserId: string, otherUserName: string) => {
    setSelectedSessionId(sessionId);
    setSelectedOtherUserId(otherUserId);
    setSelectedOtherUserName(otherUserName);
  };

  const handleCloseChat = () => {
    setSelectedSessionId(null);
    setSelectedOtherUserId(null);
    setSelectedOtherUserName(null);
  };

  if (!user || !userProfile) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.burgerButton}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="menu" size={30} color={colors.text} />
      </TouchableOpacity>
      <Header showLogo={true} title="Messages" showBack={true} />
      
      <View style={styles.content}>
        <MessageList
          userId={user.id}
          userRole="sitter"
          onConversationPress={handleConversationPress}
          onConversationsChange={setHasConversations}
        />
        {selectedSessionId === null && !hasConversations && (
          <Card style={styles.emptyCard}>
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No messages"
              message="Your conversations with parents will appear here. Start a session to begin messaging."
          />
        </Card>
        )}
      </View>

      <Modal
        visible={selectedSessionId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseChat}
      >
        {selectedSessionId && selectedOtherUserId && selectedOtherUserName && (
          <ChatInterface
            sessionId={selectedSessionId}
            userId={user.id}
            otherUserName={selectedOtherUserName}
            onBack={handleCloseChat}
          />
        )}
      </Modal>

      <SitterHamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  burgerButton: {
    position: 'absolute',
    top: 60,
    right: 10,
    zIndex: 1000,
    padding: 8,
  },
  content: {
    flex: 1,
  },
  emptyCard: {
    margin: 16,
  },
});
