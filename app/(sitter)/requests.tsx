import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import EmptyState from '@/src/components/ui/EmptyState';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import Badge from '@/src/components/ui/Badge';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { getUserSessions, acceptSessionRequest, declineSessionRequest } from '@/src/services/session.service';
import { getChildById } from '@/src/services/child.service';
import { getUserById } from '@/src/services/admin.service';
import { Session } from '@/src/types/session.types';
import { format } from 'date-fns';
import { SESSION_STATUS } from '@/src/config/constants';

interface SessionWithDetails extends Session {
  childName?: string;
  parentName?: string;
}

export default function SitterRequestsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [requests, setRequests] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (!user) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Load sessions with status 'requested' for this sitter
      const result = await getUserSessions(user.id, 'sitter', 'requested');

      if (result.success && result.data) {
        // Fetch child and parent names for each request
        const requestsWithDetails = await Promise.all(
          result.data.map(async (session) => {
            const details: SessionWithDetails = { ...session };
            
            // Get child name
            if (session.childId) {
              const childResult = await getChildById(session.childId);
              if (childResult.success && childResult.data) {
                details.childName = childResult.data.name;
              }
            }

            // Get parent name
            if (session.parentId) {
              const parentResult = await getUserById(session.parentId);
              if (parentResult.success && parentResult.data) {
                details.parentName = parentResult.data.displayName || 'Parent';
              }
            }

            return details;
          })
        );

        setRequests(requestsWithDetails);
      } else {
        setRequests([]);
      }
    } catch (error: any) {
      console.error('Failed to load requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAccept = async (sessionId: string) => {
    setProcessingId(sessionId);
    try {
      const result = await acceptSessionRequest(sessionId);
      if (result.success) {
        Alert.alert('Request Accepted', 'You have accepted this session request.', [
          { text: 'OK', onPress: () => loadRequests() },
        ]);
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to accept request');
      }
    } catch (error: any) {
      console.error('Failed to accept request:', error);
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (sessionId: string) => {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(sessionId);
            try {
              const result = await declineSessionRequest(sessionId);
              if (result.success) {
                Alert.alert('Request Declined', 'You have declined this session request.', [
                  { text: 'OK', onPress: () => loadRequests() },
                ]);
              } else {
                Alert.alert('Error', result.error?.message || 'Failed to decline request');
              }
            } catch (error: any) {
              console.error('Failed to decline request:', error);
              Alert.alert('Error', 'Failed to decline request. Please try again.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleViewDetails = (sessionId: string) => {
    router.push(`/(sitter)/session/${sessionId}` as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.burgerButton}
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="menu" size={30} color={colors.text} />
      </TouchableOpacity>
      <Header showLogo={true} title="Session Requests" showBack={true} />
      
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <ScrollView 
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} />
          }
        >
          <Card>
            <EmptyState
              icon="mail-outline"
              title="No Requests"
              message="You don't have any session requests at the moment. Complete your profile to start receiving requests."
              actionLabel="Complete Profile"
              onAction={() => router.push('/(sitter)/profile-setup')}
            />
          </Card>
        </ScrollView>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} />
          }
        >
          {requests.map((request) => (
            <Card key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.requestInfo}>
                  <Text style={[styles.requestTitle, { color: colors.text }]}>
                    {request.childName || 'Child'}
                  </Text>
                  {request.parentName && (
                    <Text style={[styles.parentName, { color: colors.textSecondary }]}>
                      from {request.parentName}
                    </Text>
                  )}
                </View>
                <Badge
                  label="Requested"
                  color={colors.warning || '#f59e0b'}
                />
              </View>

              <View style={styles.requestDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {format(request.startTime, 'MMM dd, yyyy • h:mm a')}
                  </Text>
                </View>
                {request.location?.address && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {request.location.address}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    ${request.hourlyRate}/hr
                  </Text>
                </View>
                {request.notes && (
                  <View style={styles.detailRow}>
                    <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={2}>
                      {request.notes}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.declineButton, { borderColor: colors.error || '#ef4444' }]}
                  onPress={() => handleDecline(request.id)}
                  disabled={processingId === request.id}
                >
                  {processingId === request.id ? (
                    <ActivityIndicator size="small" color={colors.error || '#ef4444'} />
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={18} color={colors.error || '#ef4444'} />
                      <Text style={[styles.actionButtonText, { color: colors.error || '#ef4444' }]}>
                        Decline
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleAccept(request.id)}
                  disabled={processingId === request.id}
                >
                  {processingId === request.id ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                      <Text style={[styles.actionButtonText, { color: colors.white }]}>
                        Accept
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
      
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
    padding: 16,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestCard: {
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  parentName: {
    fontSize: 14,
  },
  requestDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  acceptButton: {
    // backgroundColor set inline
  },
  declineButton: {
    borderWidth: 2,
    backgroundColor: 'transparent',
    // borderColor set inline
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
