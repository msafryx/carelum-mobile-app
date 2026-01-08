import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';
import AdminHamburgerMenu from '@/src/components/ui/AdminHamburgerMenu';
import { Ionicons } from '@expo/vector-icons';

export default function VerificationsScreen() {
  const { colors } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        showLogo={true} 
        title="Verification Queue"
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
      <EmptyState
        icon="document-outline"
        title="No Pending Verifications"
        message="All verification requests have been processed"
      />
      <AdminHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
