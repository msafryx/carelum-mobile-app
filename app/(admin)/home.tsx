import AdminHamburgerMenu from '@/src/components/ui/AdminHamburgerMenu';
import Button from '@/src/components/ui/Button';
import Card from '@/src/components/ui/Card';
import Header from '@/src/components/ui/Header';
import LoadingSpinner from '@/src/components/ui/LoadingSpinner';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import { getAdminStats } from '@/src/services/admin.service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/src/config/supabase';

export default function AdminHomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalParents: 0,
    totalSitters: 0,
    totalAdmins: 0,
    pendingVerifications: 0,
    activeSessions: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  // Realtime subscription for stats updates
  useEffect(() => {
    if (!supabase) return;

    console.log('🔄 Setting up realtime subscription for admin stats...');
    const channel = supabase
      .channel('admin_stats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          console.log('🔄 User changed, refreshing stats:', payload.eventType);
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'verification_requests',
        },
        (payload) => {
          console.log('🔄 Verification changed, refreshing stats:', payload.eventType);
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
        },
        (payload) => {
          console.log('🔄 Session changed, refreshing stats:', payload.eventType);
          loadStats();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStats = async () => {
    try {
      console.log('🔄 Loading admin stats...');
      const result = await getAdminStats();
      if (result.success && result.data) {
        console.log('✅ Admin stats loaded:', result.data);
        setStats(result.data);
      } else {
        console.error('❌ Failed to load admin stats:', result.error);
        // Don't show alert, just log - stats will show 0
      }
    } catch (error: any) {
      console.error('❌ Exception loading admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const QuickStat = ({ icon, label, value, color, onPress }: any) => (
    <TouchableOpacity
      style={[styles.quickStat, { backgroundColor: colors.white, borderColor: colors.border }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.quickStatValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

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
      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statsRow}>
            <QuickStat
              icon="people"
              label="Total Users"
              value={stats.totalUsers}
              color={colors.primary}
              onPress={() => router.push('/(admin)/users')}
            />
            <QuickStat
              icon="document-check-outline"
              label="Pending"
              value={stats.pendingVerifications}
              color={colors.warning}
              onPress={() => router.push('/(admin)/verifications')}
            />
            <QuickStat
              icon="radio-outline"
              label="Active"
              value={stats.activeSessions}
              color={colors.success}
              onPress={() => {}}
            />
          </View>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
            <Button
              title="Verification Queue"
              onPress={() => router.push('/(admin)/verifications')}
              style={styles.button}
            />
            <TouchableOpacity
              style={[
                styles.manageUsersButton,
                {
                  backgroundColor: colors.primary,
                  borderWidth: 2,
                  borderColor: colors.primaryDark,
                  borderRadius: 15,
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  elevation: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                },
              ]}
              onPress={() => router.push('/(admin)/users')}
              activeOpacity={0.8}
            >
              <Ionicons name="people" size={20} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700' }}>Manage Users</Text>
            </TouchableOpacity>
            <Button
              title="View Statistics"
              onPress={() => router.push('/(admin)/statistics')}
              style={styles.button}
              variant="outline"
            />
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>User Breakdown</Text>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Ionicons name="person" size={20} color={colors.info} />
                <Text style={[styles.breakdownValue, { color: colors.text }]}>{stats.totalParents}</Text>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Parents</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Ionicons name="person-outline" size={20} color={colors.success} />
                <Text style={[styles.breakdownValue, { color: colors.text }]}>{stats.totalSitters}</Text>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Sitters</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
                <Text style={[styles.breakdownValue, { color: colors.text }]}>{stats.totalAdmins}</Text>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Admins</Text>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Navigation</Text>
            <TouchableOpacity
              style={[styles.navItem, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/(admin)/profile')}
            >
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} style={styles.navIcon} />
              <Text style={[styles.navText, { color: colors.text }]}>Profile</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navItem, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/(admin)/settings')}
            >
              <Ionicons name="settings-outline" size={20} color={colors.primary} style={styles.navIcon} />
              <Text style={[styles.navText, { color: colors.text }]}>Settings</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(admin)/statistics')}
            >
              <Ionicons name="stats-chart-outline" size={20} color={colors.primary} style={styles.navIcon} />
              <Text style={[styles.navText, { color: colors.text }]}>Statistics</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </Card>
        </ScrollView>
      )}
      <AdminHamburgerMenu
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
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickStat: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  quickStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
    fontSize: 18,
  },
  button: {
    marginBottom: 12,
  },
  manageUsersButton: {
    // Will be styled inline with theme colors
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navIcon: {
    marginRight: 12,
  },
  navText: {
    flex: 1,
    fontSize: 16,
  },
});
