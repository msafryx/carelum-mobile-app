import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { discoverAvailableSessions, acceptSessionRequest, cancelSession, subscribeToUserSessions } from '@/src/services/session.service';
import { getChildById } from '@/src/services/child.service';
import { getUserById } from '@/src/services/admin.service';
import { Session, getRequestMode, getRequestStatus, RequestMode, RequestStatus } from '@/src/types/session.types';
import { format, differenceInHours, differenceInMinutes, isAfter } from 'date-fns';
import { Child } from '@/src/types/child.types';
import { User } from '@/src/types/user.types';
import { formatExpectedDuration } from '@/src/utils/sessionSearchUtils';

interface SessionWithDetails extends Session {
  childName?: string;
  childAge?: number;
  parentName?: string;
  parentCity?: string;
  requestMode?: RequestMode;
  requestStatus?: RequestStatus;
  children?: Array<{ id: string; name: string; age?: number; photoUrl?: string }>;
}

export default function SitterRequestsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [requests, setRequests] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const subscriptionRef = useRef<(() => void) | null>(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (!user || !userProfile) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Discover all available sessions (invite, nearby, city, nationwide)
      const result = await discoverAvailableSessions(
        undefined, // scope - undefined means get all
        undefined, // maxDistance
        userProfile.city || undefined // sitterCity for city filtering
      );

      if (result.success && result.data) {
        // Filter out ignored requests
        const filteredSessions = result.data.filter(s => !ignoredIds.has(s.id));
        
        // Fetch child and parent details for each request
        const requestsWithDetails = await Promise.all(
          filteredSessions.map(async (session) => {
            const details: SessionWithDetails = { 
              ...session,
              requestMode: getRequestMode(session.searchScope),
              requestStatus: getRequestStatus(session),
            };
            
            // Get all children in the session
            const children: Array<{ id: string; name: string; age?: number; photoUrl?: string }> = [];
            
            // Load primary child
            if (session.childId) {
              const childResult = await getChildById(session.childId);
              if (childResult.success && childResult.data) {
                const child = childResult.data;
                children.push({
                  id: child.id,
                  name: child.name,
                  age: child.age,
                  photoUrl: child.photoUrl,
                });
                details.childName = child.name;
                details.childAge = child.age;
              }
            }
            
            // Load additional children if childIds exists
            if (session.childIds && session.childIds.length > 1) {
              const additionalChildren = await Promise.all(
                session.childIds
                  .filter(id => id !== session.childId)
                  .map(async (childId) => {
                    const childResult = await getChildById(childId);
                    if (childResult.success && childResult.data) {
                      return {
                        id: childResult.data.id,
                        name: childResult.data.name,
                        age: childResult.data.age,
                        photoUrl: childResult.data.photoUrl,
                      };
                    }
                    return null;
                  })
              );
              children.push(...additionalChildren.filter(c => c !== null) as any[]);
            }
            
            details.children = children;
            
            // Get parent name and city
            if (session.parentId) {
              const parentResult = await getUserById(session.parentId);
              if (parentResult.success && parentResult.data) {
                details.parentName = parentResult.data.displayName || 'Parent';
                details.parentCity = parentResult.data.city || undefined;
              }
            }

            return details;
          })
        );

        // Sort: Invite requests first (pinned), then by start time
        const sortedRequests = requestsWithDetails.sort((a, b) => {
          // Invite requests go first
          if (a.requestMode === 'INVITE' && b.requestMode !== 'INVITE') return -1;
          if (a.requestMode !== 'INVITE' && b.requestMode === 'INVITE') return 1;
          // Then by start time (soonest first)
          return a.startTime.getTime() - b.startTime.getTime();
        });

        // Filter out expired, cancelled, and accepted by others
        const activeRequests = sortedRequests.filter(req => {
          if (req.requestStatus === 'EXPIRED' || req.requestStatus === 'CANCELLED') return false;
          if (req.requestStatus === 'ACCEPTED' && req.sitterId && req.sitterId !== user.id) return false;
          return true;
        });

        setRequests(activeRequests);
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
  }, [user, userProfile, ignoredIds]);

  useEffect(() => {
    loadRequests();
    
    // Subscribe to real-time updates
    if (user) {
      subscriptionRef.current = subscribeToUserSessions(
        user.id,
        'sitter',
        () => {
          // Reload requests when sessions change
          loadRequests();
        }
      );
    }
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
      }
    };
  }, [loadRequests, user]);

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
              const result = await cancelSession(sessionId, 'Declined by sitter');
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

  const handleIgnore = (sessionId: string) => {
    setIgnoredIds(prev => new Set([...prev, sessionId]));
    // Remove from requests immediately
    setRequests(prev => prev.filter(r => r.id !== sessionId));
  };

  const handleViewDetails = (sessionId: string) => {
    router.push(`/(sitter)/session/${sessionId}` as any);
  };

  const getModeBadgeColor = (mode: RequestMode) => {
    switch (mode) {
      case 'INVITE':
        return colors.primary || '#3b82f6';
      case 'NEARBY':
        return colors.success || '#10b981';
      case 'CITY':
        return colors.warning || '#f59e0b';
      case 'NATIONWIDE':
        return colors.info || '#6366f1';
      default:
        return colors.textSecondary || '#6b7280';
    }
  };

  const getModeLabel = (mode: RequestMode) => {
    switch (mode) {
      case 'INVITE':
        return 'Invite';
      case 'NEARBY':
        return 'Nearby';
      case 'CITY':
        return 'City';
      case 'NATIONWIDE':
        return 'Nationwide';
      default:
        return 'Request';
    }
  };

  const formatDuration = (session: SessionWithDetails): string => {
    if (session.timeSlots && session.timeSlots.length > 0) {
      return formatExpectedDuration(session);
    }
    if (session.endTime) {
      const hours = differenceInHours(session.endTime, session.startTime);
      const minutes = differenceInMinutes(session.endTime, session.startTime) % 60;
      if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else {
        return `${minutes}m`;
      }
    }
    return 'Ongoing';
  };

  // Helper function to extract readable address from location
  const getReadableLocation = (location: any): string | null => {
    if (!location) return null;
    
    // If it's already a plain string, check if it's JSON
    if (typeof location === 'string') {
      try {
        const parsed = JSON.parse(location);
        if (parsed && typeof parsed === 'object') {
          return parsed.address || parsed.city || location;
        }
      } catch {
        // Not JSON, return as-is
        return location;
      }
      return location;
    }
    
    // If it's an object
    if (typeof location === 'object') {
      if (location.address) return location.address;
      if (location.city) return location.city;
      if (location.coordinates) return 'Location set';
    }
    
    return null;
  };

  const getLocationDisplay = (session: SessionWithDetails): string => {
    const readableLocation = getReadableLocation(session.location);
    
    if (!readableLocation) {
      return 'Location not specified';
    }
    
    if (session.requestMode === 'INVITE') {
      // For invite mode, show full address
      return readableLocation;
    } else {
      // For other modes, show city-level only
      // Try to extract city from address string
      const parts = readableLocation.split(',');
      return parts[parts.length - 1]?.trim() || readableLocation;
    }
  };

  const inviteRequests = requests.filter(r => r.requestMode === 'INVITE');
  const otherRequests = requests.filter(r => r.requestMode !== 'INVITE');

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
          {/* Invite Requests Section (Pinned) */}
          {inviteRequests.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="mail" size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Direct Invitations ({inviteRequests.length})
                </Text>
              </View>
              {inviteRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  colors={colors}
                  processingId={processingId}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  onIgnore={handleIgnore}
                  onViewDetails={handleViewDetails}
                  getModeBadgeColor={getModeBadgeColor}
                  getModeLabel={getModeLabel}
                  formatDuration={formatDuration}
                  getLocationDisplay={getLocationDisplay}
                  isInvite={true}
                />
              ))}
            </View>
          )}

          {/* Other Requests Section */}
          {otherRequests.length > 0 && (
            <View style={styles.section}>
              {inviteRequests.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Ionicons name="search" size={20} color={colors.textSecondary} />
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    Available Requests ({otherRequests.length})
                  </Text>
                </View>
              )}
              {otherRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  colors={colors}
                  processingId={processingId}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  onIgnore={handleIgnore}
                  onViewDetails={handleViewDetails}
                  getModeBadgeColor={getModeBadgeColor}
                  getModeLabel={getModeLabel}
                  formatDuration={formatDuration}
                  getLocationDisplay={getLocationDisplay}
                  isInvite={false}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
      
      <SitterHamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
      />
    </View>
  );
}

interface RequestCardProps {
  request: SessionWithDetails;
  colors: any;
  processingId: string | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onIgnore: (id: string) => void;
  onViewDetails: (id: string) => void;
  getModeBadgeColor: (mode: RequestMode) => string;
  getModeLabel: (mode: RequestMode) => string;
  formatDuration: (session: SessionWithDetails) => string;
  getLocationDisplay: (session: SessionWithDetails) => string;
  isInvite: boolean;
}

function RequestCard({
  request,
  colors,
  processingId,
  onAccept,
  onDecline,
  onIgnore,
  onViewDetails,
  getModeBadgeColor,
  getModeLabel,
  formatDuration,
  getLocationDisplay,
  isInvite,
}: RequestCardProps) {
  const children = request.children || [];
  const primaryChild = children[0] || { name: request.childName || 'Child', age: request.childAge };

  return (
    <Card 
      style={[
        styles.requestCard,
        isInvite && { borderLeftWidth: 4, borderLeftColor: colors.primary },
      ]}
      // Remove any onPress from Card - only buttons should be clickable
    >
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <View style={styles.childInfo}>
            <Text style={[styles.requestTitle, { color: colors.text }]}>
              {primaryChild.name}
              {primaryChild.age && `, ${primaryChild.age} ${primaryChild.age === 1 ? 'year' : 'years'} old`}
            </Text>
            {children.length > 1 && (
              <Text style={[styles.multipleChildren, { color: colors.textSecondary }]}>
                +{children.length - 1} more {children.length === 2 ? 'child' : 'children'}
              </Text>
            )}
          </View>
          {request.parentName && (
            <Text style={[styles.parentName, { color: colors.textSecondary }]}>
              from {request.parentName}
            </Text>
          )}
        </View>
        <Badge
          label={getModeLabel(request.requestMode || 'INVITE')}
          color={getModeBadgeColor(request.requestMode || 'INVITE')}
        />
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.detailRow}>
          <View style={[styles.detailIconContainer, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="calendar" size={14} color={colors.primary} />
          </View>
          <Text style={[styles.detailText, { color: colors.text }]}>
            {format(request.startTime, 'MMM dd, yyyy • h:mm a')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <View style={[styles.detailIconContainer, { backgroundColor: colors.success + '10' }]}>
            <Ionicons name="time" size={14} color={colors.success || '#10b981'} />
          </View>
          <Text style={[styles.detailText, { color: colors.text }]}>
            {formatDuration(request)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <View style={[styles.detailIconContainer, { backgroundColor: colors.warning + '10' }]}>
            <Ionicons name="location" size={14} color={colors.warning || '#f59e0b'} />
          </View>
          <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={1}>
            {getLocationDisplay(request)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <View style={[styles.detailIconContainer, { backgroundColor: colors.info + '10' || colors.primary + '10' }]}>
            <Ionicons name="cash" size={14} color={colors.info || colors.primary} />
          </View>
          <Text style={[styles.detailText, { color: colors.text, fontWeight: '600' }]}>
            Rs. {request.hourlyRate?.toFixed(0) || '0'}/hr
          </Text>
        </View>
        {request.notes && (
          <View style={styles.detailRow}>
            <View style={[styles.detailIconContainer, { backgroundColor: colors.textSecondary + '10' }]}>
              <Ionicons name="document-text" size={14} color={colors.textSecondary} />
            </View>
            <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={2}>
              {request.notes}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.requestActions}>
        {isInvite ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton, { borderColor: colors.error || '#ef4444' }]}
              onPress={() => onDecline(request.id)}
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
              onPress={() => onAccept(request.id)}
              disabled={processingId === request.id}
            >
              {processingId === request.id ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                    Accept
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.ignoreButton, { borderColor: colors.textSecondary || '#6b7280' }]}
              onPress={() => onIgnore(request.id)}
              disabled={processingId === request.id}
            >
              <Ionicons name="eye-off-outline" size={18} color={colors.textSecondary || '#6b7280'} />
              <Text style={[styles.actionButtonText, { color: colors.textSecondary || '#6b7280' }]}>
                Ignore
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton, { backgroundColor: colors.primary }]}
              onPress={() => onAccept(request.id)}
              disabled={processingId === request.id}
            >
              {processingId === request.id ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                    Accept
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </Card>
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  requestInfo: {
    flex: 1,
    marginRight: 12,
  },
  childInfo: {
    marginBottom: 6,
  },
  requestTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  multipleChildren: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  parentName: {
    fontSize: 14,
    marginTop: 2,
  },
  requestDetails: {
    gap: 10,
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomColor: '#f0f0f0',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
    minHeight: 48,
  },
  acceptButton: {
    // backgroundColor set inline
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  declineButton: {
    borderWidth: 2,
    backgroundColor: 'transparent',
    // borderColor set inline
  },
  ignoreButton: {
    borderWidth: 2,
    backgroundColor: 'transparent',
    // borderColor set inline
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});