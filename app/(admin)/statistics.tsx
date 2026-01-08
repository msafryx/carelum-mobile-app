import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import AdminHamburgerMenu from '@/src/components/ui/AdminHamburgerMenu';
import LoadingSpinner from '@/src/components/ui/LoadingSpinner';
import { getAdminStats } from '@/src/services/admin.service';

export default function StatisticsScreen() {
  const { colors } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalParents: 0,
    totalSitters: 0,
    totalAdmins: 0,
    pendingVerifications: 0,
    activeSessions: 0,
  });

  const loadStats = async () => {
    const result = await getAdminStats();
    if (result.success && result.data) {
      setStats(result.data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showLogo={true} title="Statistics" showBack={true} />
        <LoadingSpinner fullScreen />
      </View>
    );
  }

  const StatCard = ({ icon, label, value, color }: any) => (
    <Card style={styles.statCard}>
      <View style={styles.statContent}>
        <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={styles.statTextContainer}>
          <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.burgerButton}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="menu" size={30} color={colors.text} />
      </TouchableOpacity>
      <Header showLogo={true} title="Statistics" showBack={true} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.statsGrid}>
          <StatCard
            icon="people"
            label="Total Users"
            value={stats.totalUsers}
            color={colors.primary}
          />
          <StatCard
            icon="person"
            label="Parents"
            value={stats.totalParents}
            color={colors.info}
          />
          <StatCard
            icon="person-outline"
            label="Babysitters"
            value={stats.totalSitters}
            color={colors.success}
          />
          <StatCard
            icon="shield-checkmark"
            label="Admins"
            value={stats.totalAdmins}
            color={colors.warning}
          />
        </View>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>System Status</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons name="document-check-outline" size={20} color={colors.warning} />
              <Text style={[styles.statusLabel, { color: colors.text }]}>Pending Verifications</Text>
              <Text style={[styles.statusValue, { color: colors.warning }]}>
                {stats.pendingVerifications}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons name="radio-outline" size={20} color={colors.success} />
              <Text style={[styles.statusLabel, { color: colors.text }]}>Active Sessions</Text>
              <Text style={[styles.statusValue, { color: colors.success }]}>
                {stats.activeSessions}
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Ionicons name="download-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>Export Report</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>View Analytics</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </Card>
      </ScrollView>
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
  burgerButton: {
    position: 'absolute',
    top: 60,
    right: 10,
    zIndex: 1000,
    padding: 8,
  },
  content: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    marginBottom: 0,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
    fontSize: 18,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  actionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
});
