import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import EmptyState from '@/src/components/ui/EmptyState';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import AlertsList from '@/src/components/alerts/AlertsList';
import Card from '@/src/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/hooks/useAuth';
import { useLocalSearchParams } from 'expo-router';
import { Alert as AlertType } from '@/src/services/alert.service';

export default function AlertsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [menuVisible, setMenuVisible] = useState(false);
  const [hasAlerts, setHasAlerts] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        showLogo={true} 
        title={params.sessionId ? "Session Alerts" : "Alerts"} 
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
      
      <View style={styles.content}>
        <AlertsList
          userId={user.id}
          sessionId={params.sessionId}
          onAlertPress={(alert: AlertType) => {
            // Handle alert press - could navigate to session detail or show alert details
            console.log('Alert pressed:', alert);
          }}
          onAlertsChange={setHasAlerts}
        />
        {!hasAlerts && (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon="notifications-outline"
              title="No Alerts"
              message={
                params.sessionId
                  ? "No alerts for this session yet."
                  : "You're all caught up! Alerts will appear here when crying is detected or emergencies occur."
              }
            />
          </Card>
        )}
      </View>

      <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  emptyCard: {
    margin: 16,
  },
});
