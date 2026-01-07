import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import HamburgerMenu from '@/src/components/ui/HamburgerMenu';
import Header from '@/src/components/ui/Header';
import { useTheme } from '@/src/config/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { syncToLocalDB } from '@/src/services/db-sync-server.service';
import { COLLECTIONS } from '@/src/services/firebase-collections.service';
import { getAll, save, STORAGE_KEYS } from '@/src/services/local-storage.service';
import { syncFromFirebase } from '@/src/services/storage-sync.service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ParentHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Auto-sync on screen load (only once)
  useEffect(() => {
    handleSync();
  }, []);
  
  // Sync current user from Firebase to AsyncStorage if not already there
  useEffect(() => {
    if (user && userProfile) {
      syncUserToLocal();
    }
  }, [user, userProfile]);
  
  const syncUserToLocal = async () => {
    try {
      if (!user || !userProfile) return;
      
      // Check if user already in AsyncStorage
      const usersResult = await getAll(STORAGE_KEYS.USERS);
      const existingUser = usersResult.data?.find((u: any) => u.id === user.uid);
      
      if (!existingUser) {
        // Sync from Firebase to AsyncStorage
        const syncResult = await syncFromFirebase(
          COLLECTIONS.USERS,
          user.uid,
          STORAGE_KEYS.USERS
        );
        
        if (syncResult.success) {
          console.log('✅ User synced from Firebase to AsyncStorage');
        } else {
          // If sync fails, save user profile directly
          const { id, ...profileWithoutId } = userProfile;
          await save(STORAGE_KEYS.USERS, {
            id: user.uid,
            ...profileWithoutId,
            createdAt: userProfile.createdAt instanceof Date 
              ? userProfile.createdAt.getTime() 
              : Date.now(),
            updatedAt: Date.now(),
          });
          console.log('✅ User saved to AsyncStorage');
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to sync user to local:', error.message);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // First, check what's in AsyncStorage
      const usersResult = await getAll(STORAGE_KEYS.USERS);
      const usersCount = usersResult.data?.length || 0;
      console.log(`📊 Users in AsyncStorage: ${usersCount}`);
      
      if (usersCount === 0) {
        console.log('⚠️ No data in AsyncStorage. Data might be in Firebase only.');
        console.log('💡 Tip: Make sure you\'re logged in and data syncs from Firebase to local storage.');
      }
      
      // Then sync to MySQL
      const result = await syncToLocalDB();
      if (result.success) {
        console.log('✅ Synced to MySQL successfully!');
        // Don't show alert on auto-sync, only on manual sync
      } else {
        console.error('❌ Sync failed:', result.error?.message);
      }
    } catch (error: any) {
      console.error('❌ Sync error:', error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      // Check AsyncStorage first
      const usersResult = await getAll(STORAGE_KEYS.USERS);
      const usersCount = usersResult.data?.length || 0;
      
      if (usersCount === 0) {
        Alert.alert(
          'No Data to Sync',
          'AsyncStorage is empty. Make sure you\'re logged in and data has synced from Firebase to local storage.',
          [{ text: 'OK' }]
        );
        setSyncing(false);
        return;
      }
      
      // Sync to MySQL
      const result = await syncToLocalDB();
      if (result.success) {
        Alert.alert('Success', `Synced ${usersCount} user(s) to MySQL!`);
      } else {
        Alert.alert('Sync Failed', result.error?.message || 'Unknown error');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        showLogo={true} 
        showBack={false}
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
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          placeholder="Search sitters"
          placeholderTextColor={colors.textSecondary}
          style={[styles.search, { backgroundColor: colors.white, color: colors.text }]}
        />

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(parent)/search')}
          >
            <Text style={styles.quickText}>Book Sitter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(parent)/activities')}
          >
            <Text style={styles.quickText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.primary }]}
            onPress={() => {}}
          >
            <Text style={styles.quickText}>Track</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Sessions</Text>
        <Card>
          <EmptyState
            icon="calendar-outline"
            title="No upcoming sessions"
            message="You don't have any upcoming sessions scheduled"
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Sessions</Text>
        <Card>
          <EmptyState
            icon="radio-outline"
            title="No active sessions"
            message="You don't have any active babysitting sessions at the moment"
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended Sitters</Text>
        <Card>
          <EmptyState
            icon="star-outline"
            title="Coming soon"
            message="Recommended babysitters will appear here"
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activities</Text>
        <Card>
          <EmptyState
            icon="time-outline"
            title="Nothing yet"
            message="Your recent activities will appear here"
          />
        </Card>
      </ScrollView>

      <TouchableOpacity
        style={[styles.chatbotButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(parent)/messages')}
      >
        <Ionicons name="chatbubbles" size={28} color={colors.white} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.syncButton, 
          { 
            backgroundColor: syncing ? colors.textSecondary : colors.success,
            opacity: syncing ? 0.7 : 1
          }
        ]}
        onPress={handleManualSync}
        disabled={syncing}
      >
        <Ionicons 
          name={syncing ? "sync" : "cloud-upload-outline"} 
          size={24} 
          color="#fff"
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.emergencyButton, { backgroundColor: colors.emergency }]}
        onPress={() => {}}
      >
        <Ionicons name="call" size={26} color={colors.white} />
      </TouchableOpacity>

      <HamburgerMenu
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
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  search: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 20,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  quickButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickText: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
  },
  chatbotButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  syncButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  emergencyButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
