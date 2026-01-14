import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import Badge from '@/src/components/ui/Badge';
import EmptyState from '@/src/components/ui/EmptyState';
import AdminHamburgerMenu from '@/src/components/ui/AdminHamburgerMenu';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/hooks/useAuth';
import { getAllUsers, getUserById, updateUser, deleteUser, changeUserRole } from '@/src/services/admin.service';
import type { User } from '@/src/types/user.types';
import { format } from 'date-fns';
import { supabase } from '@/src/config/supabase';

export default function UsersScreen() {
  const { colors, spacing } = useTheme();
  const { user: currentUser } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'parent' | 'babysitter' | 'admin'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetailModalVisible, setUserDetailModalVisible] = useState(false);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [userDetail, setUserDetail] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const role = roleFilter === 'all' ? undefined : roleFilter;
      const result = await getAllUsers(role, 500);
      if (result.success && result.data) {
        setUsers(result.data);
        applyFilters(result.data, searchQuery, roleFilter);
      } else {
        console.error('Failed to load users:', result.error);
        Alert.alert('Error', result.error?.message || 'Failed to load users');
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter]);

  const applyFilters = useCallback((userList: User[], query: string, role: string) => {
    let filtered = [...userList];

    // Apply role filter
    if (role !== 'all') {
      filtered = filtered.filter(u => u.role === role);
    }

    // Apply search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(u =>
        u.displayName?.toLowerCase().includes(lowerQuery) ||
        u.email?.toLowerCase().includes(lowerQuery) ||
        u.userNumber?.toString().includes(lowerQuery) ||
        u.phoneNumber?.toLowerCase().includes(lowerQuery)
      );
    }

    setFilteredUsers(filtered);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Realtime subscription for user updates
  useEffect(() => {
    if (!supabase) return;

    console.log('🔄 Setting up realtime subscription for users...');
    const channel = supabase
      .channel('users_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          console.log('🔄 User changed:', payload.eventType);
          // Reload users when any change occurs
          loadUsers();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, [loadUsers]);

  useEffect(() => {
    applyFilters(users, searchQuery, roleFilter);
  }, [searchQuery, roleFilter, users, applyFilters]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers();
  }, [loadUsers]);

  const handleViewUser = async (user: User) => {
    setSelectedUser(user);
    setLoadingUserDetail(true);
    setUserDetailModalVisible(true);

    try {
      const result = await getUserById(user.id);
      if (result.success && result.data) {
        setUserDetail(result.data);
      } else {
        setUserDetail(user); // Fallback to basic user data
      }
    } catch (error: any) {
      console.error('Error loading user details:', error);
      setUserDetail(user); // Fallback to basic user data
    } finally {
      setLoadingUserDetail(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'parent' | 'babysitter' | 'admin') => {
    Alert.alert(
      'Change User Role',
      `Are you sure you want to change this user's role to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await changeUserRole(userId, newRole);
              if (result.success) {
                Alert.alert('Success', 'User role updated successfully');
                loadUsers();
                if (userDetailModalVisible) {
                  setUserDetailModalVisible(false);
                }
              } else {
                Alert.alert('Error', result.error?.message || 'Failed to update user role');
              }
            } catch (error: any) {
              Alert.alert('Error', 'Failed to update user role');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteUser(userId);
              if (result.success) {
                Alert.alert('Success', 'User deleted successfully');
                loadUsers();
                if (userDetailModalVisible) {
                  setUserDetailModalVisible(false);
                }
              } else {
                Alert.alert('Error', result.error?.message || 'Failed to delete user');
              }
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const handleToggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      const result = await updateUser(userId, { isVerified: !currentStatus } as any);
      if (result.success) {
        Alert.alert('Success', `User ${!currentStatus ? 'verified' : 'unverified'} successfully`);
        loadUsers();
        if (userDetailModalVisible && userDetail) {
          setUserDetail({ ...userDetail, isVerified: !currentStatus } as User);
        }
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update verification status');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update verification status');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'babysitter':
        return 'warning';
      case 'parent':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading && users.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          showLogo={true}
          title="Manage Users"
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <AdminHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        showLogo={true}
        title="Manage Users"
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

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Search and Filter */}
        <Card style={styles.filterCard}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Search by name, email, or phone..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.roleFilterContainer}>
            {(['all', 'parent', 'babysitter', 'admin'] as const).map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleFilterButton,
                  {
                    backgroundColor: roleFilter === role ? colors.primary : colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setRoleFilter(role)}
              >
                <Text
                  style={[
                    styles.roleFilterText,
                    { color: roleFilter === role ? '#fff' : colors.text },
                  ]}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
          </Text>
        </Card>

        {/* Users List */}
        {filteredUsers.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No users found"
            message={searchQuery || roleFilter !== 'all' ? 'Try adjusting your search or filters' : 'No users in the system'}
          />
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} style={styles.userCard}>
              <TouchableOpacity
                style={styles.userCardContent}
                onPress={() => handleViewUser(user)}
                activeOpacity={0.7}
              >
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    {user.profileImageUrl ? (
                      <Image
                        source={{ uri: user.profileImageUrl }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                        <Ionicons name="person" size={24} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.userDetails}>
                      <View style={styles.userNameRow}>
                        <Text style={[styles.userName, { color: colors.text }]}>
                          {user.displayName || 'No Name'}
                        </Text>
                        {user.isVerified && (
                          <Ionicons name="checkmark-circle" size={16} color={colors.success || '#10b981'} />
                        )}
                      </View>
                      <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
                      {user.phoneNumber && (
                        <Text style={[styles.userPhone, { color: colors.textSecondary }]}>
                          {user.phoneNumber}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.userBadges}>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                    {user.role === 'babysitter' && user.verificationStatus && (
                      <Badge
                        variant={
                          user.verificationStatus === 'approved'
                            ? 'success'
                            : user.verificationStatus === 'rejected'
                            ? 'error'
                            : 'warning'
                        }
                        style={styles.verificationBadge}
                      >
                        {user.verificationStatus === 'approved'
                          ? 'Verified'
                          : user.verificationStatus === 'rejected'
                          ? 'Rejected'
                          : 'Pending'}
                      </Badge>
                    )}
                  </View>
                </View>
                <View style={styles.userMeta}>
                  <Text style={[styles.userMetaText, { color: colors.textSecondary }]}>
                    Joined: {format(user.createdAt, 'MMM dd, yyyy')}
                  </Text>
                  {user.userNumber && (
                    <Text style={[styles.userMetaText, { color: colors.textSecondary }]}>
                      ID: {user.userNumber}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      {/* User Detail Modal */}
      <Modal
        visible={userDetailModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setUserDetailModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.background }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>User Details</Text>
              <TouchableOpacity 
                onPress={() => setUserDetailModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingUserDetail ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : userDetail ? (
              <>
                <ScrollView 
                  style={styles.modalBody}
                  contentContainerStyle={styles.modalBodyContent}
                  showsVerticalScrollIndicator={true}
                >
                  <View style={styles.detailSection}>
                    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Name:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {userDetail.displayName || 'Not set'}
                      </Text>
                    </View>
                    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Email:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{userDetail.email}</Text>
                    </View>
                    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Role:</Text>
                      <Badge variant={getRoleBadgeVariant(userDetail.role)}>
                        {userDetail.role === 'babysitter' ? 'Babysitter' : userDetail.role?.charAt(0).toUpperCase() + userDetail.role?.slice(1)}
                      </Badge>
                    </View>
                    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Phone:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {userDetail.phoneNumber || 'Not set'}
                      </Text>
                    </View>
                    {userDetail.userNumber && (
                      <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>User ID:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{userDetail.userNumber}</Text>
                      </View>
                    )}
                    {userDetail.role === 'babysitter' && (
                      <>
                        <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Hourly Rate:</Text>
                          <Text style={[styles.detailValue, { color: colors.text }]}>
                            ${(userDetail as any).hourlyRate?.toFixed(2) || 'Not set'}
                          </Text>
                        </View>
                        <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Bio:</Text>
                          <Text style={[styles.detailValue, { color: colors.text }]}>
                            {(userDetail as any).bio || 'Not set'}
                          </Text>
                        </View>
                        <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Verification Status:</Text>
                          <Badge
                            variant={
                              userDetail.verificationStatus === 'approved'
                                ? 'success'
                                : userDetail.verificationStatus === 'rejected'
                                ? 'error'
                                : 'warning'
                            }
                          >
                            {userDetail.verificationStatus === 'approved'
                              ? 'Verified'
                              : userDetail.verificationStatus === 'rejected'
                              ? 'Rejected'
                              : userDetail.verificationStatus || 'Pending'}
                          </Badge>
                        </View>
                      </>
                    )}
                    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Verified:</Text>
                      <Badge variant={userDetail.isVerified ? 'success' : 'warning'}>
                        {userDetail.isVerified ? 'Yes' : 'No'}
                      </Badge>
                    </View>
                    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Joined:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {format(userDetail.createdAt, 'MMM dd, yyyy HH:mm')}
                      </Text>
                    </View>
                    {userDetail.updatedAt && (
                      <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Last Updated:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {format(userDetail.updatedAt, 'MMM dd, yyyy HH:mm')}
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>

                {/* Actions - Fixed at bottom */}
                <View style={[styles.modalActions, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                  {userDetail.role !== 'admin' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        const newRole = userDetail.role === 'parent' ? 'babysitter' : 'parent';
                        handleChangeRole(userDetail.id, newRole);
                      }}
                    >
                      <Ionicons name="swap-horizontal" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Change Role</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: userDetail.isVerified
                          ? colors.warning || '#f59e0b'
                          : colors.success || '#10b981',
                      },
                    ]}
                    onPress={() => handleToggleVerification(userDetail.id, userDetail.isVerified || false)}
                  >
                    <Ionicons
                      name={userDetail.isVerified ? 'close-circle' : 'checkmark-circle'}
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.actionButtonText}>
                      {userDetail.isVerified ? 'Unverify' : 'Verify'}
                    </Text>
                  </TouchableOpacity>
                  {userDetail.id !== currentUser?.id && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.error || '#ef4444' }]}
                      onPress={() => handleDeleteUser(userDetail.id, userDetail.displayName || 'User')}
                    >
                      <Ionicons name="trash" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Delete User</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <AdminHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCard: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  roleFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleFilterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  roleFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultCount: {
    fontSize: 12,
    textAlign: 'center',
  },
  userCard: {
    marginBottom: 12,
  },
  userCardContent: {
    padding: 4,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  verificationBadge: {
    marginLeft: 4,
  },
  userMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  userMetaText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#fff', // Solid white background - will be overridden by theme
  },
  modalContent: {
    flex: 1,
    flexDirection: 'column',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalBody: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 100,
    flexGrow: 1,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  modalActions: {
    gap: 12,
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
