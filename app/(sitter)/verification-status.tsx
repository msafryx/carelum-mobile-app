import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import Badge from '@/src/components/ui/Badge';
import EmptyState from '@/src/components/ui/EmptyState';
import SitterHamburgerMenu from '@/src/components/ui/SitterHamburgerMenu';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { getSitterVerification } from '@/src/services/verification.service';
import type { VerificationRequest } from '@/src/services/verification.service';
import { format } from 'date-fns';
import { supabase } from '@/src/config/supabase';

export default function VerificationStatusScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [verification, setVerification] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVerification = useCallback(async () => {
    if (!user) return;

    try {
      const result = await getSitterVerification(user.id);
      if (result.success) {
        setVerification(result.data);
      } else {
        console.error('Failed to load verification:', result.error);
      }
    } catch (error: any) {
      console.error('Error loading verification:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadVerification();
  }, [loadVerification]);

  // Realtime subscription for verification updates
  useEffect(() => {
    if (!user || !supabase) return;

    console.log('🔄 Setting up realtime subscription for verification status...');
    const channel = supabase
      .channel(`verification_status_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'verification_requests',
          filter: `sitter_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Verification status changed:', payload.eventType);
          // Reload verification when any change occurs
          loadVerification();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, [user, loadVerification]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadVerification();
  }, [loadVerification]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return colors.success || '#10b981';
      case 'rejected':
        return colors.error || '#ef4444';
      case 'under_review':
        return colors.warning || '#f59e0b';
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'under_review':
        return 'time';
      default:
        return 'hourglass-outline';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          showLogo={true}
          title="Verification Status"
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
        <SitterHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      </View>
    );
  }

  if (!verification) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          showLogo={true}
          title="Verification Status"
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
          <EmptyState
            icon="document-outline"
            title="No Verification Request"
            message="You haven't submitted a verification request yet. Complete your profile setup to get verified."
          />
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(sitter)/profile-setup')}
          >
            <Text style={styles.setupButtonText}>Go to Profile Setup</Text>
          </TouchableOpacity>
        </ScrollView>
        <SitterHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        showLogo={true}
        title="Verification Status"
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
        {/* Status Card */}
        <Card>
          <View style={styles.statusHeader}>
            <View style={styles.statusInfo}>
              <Ionicons
                name={getStatusIcon(verification.status) as any}
                size={32}
                color={getStatusColor(verification.status)}
              />
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusTitle, { color: colors.text }]}>
                  {verification.status === 'approved'
                    ? 'Verified'
                    : verification.status === 'rejected'
                    ? 'Rejected'
                    : verification.status === 'under_review'
                    ? 'Under Review'
                    : 'Pending Review'}
                </Text>
                <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
                  Submitted: {format(verification.submittedAt, 'MMM dd, yyyy')}
                </Text>
              </View>
            </View>
            <Badge
              variant={
                verification.status === 'approved'
                  ? 'success'
                  : verification.status === 'rejected'
                  ? 'error'
                  : verification.status === 'under_review'
                  ? 'warning'
                  : 'info'
              }
            >
              {verification.status === 'approved'
                ? 'Verified'
                : verification.status === 'rejected'
                ? 'Rejected'
                : verification.status === 'under_review'
                ? 'Under Review'
                : 'Pending'}
            </Badge>
          </View>

          {/* Admin Comment for Rejected Status */}
          {verification.status === 'rejected' && verification.rejectionReason && (
            <View style={[styles.rejectionBox, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
              <Text style={[styles.rejectionTitle, { color: colors.error }]}>Rejection Reason:</Text>
              <Text style={[styles.rejectionText, { color: colors.text }]}>{verification.rejectionReason}</Text>
            </View>
          )}

          {/* Admin Comment for Approved Status */}
          {verification.status === 'approved' && verification.rejectionReason && (
            <View style={[styles.successBox, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
              <Ionicons name="information-circle" size={20} color={colors.success || '#10b981'} />
              <Text style={[styles.successText, { color: colors.text, marginLeft: 8 }]}>
                Admin Comment: {verification.rejectionReason}
              </Text>
            </View>
          )}

          {verification.status === 'approved' && (
            <View style={[styles.successBox, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success || '#10b981'} />
              <Text style={[styles.successText, { color: colors.text }]}>
                Your profile has been verified! Parents can now see your verified badge.
              </Text>
            </View>
          )}

          {verification.reviewedAt && (
            <View style={styles.reviewInfo}>
              <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Reviewed:</Text>
              <Text style={[styles.reviewValue, { color: colors.text }]}>
                {format(verification.reviewedAt, 'MMM dd, yyyy HH:mm')}
              </Text>
            </View>
          )}

          {/* Resubmit Button - Show if rejected or any document is rejected */}
          {(verification.status === 'rejected' || 
            verification.idDocumentVerified === false ||
            verification.backgroundCheckVerified === false ||
            verification.qualificationDocumentVerified === false ||
            (verification.certifications && verification.certifications.some(c => c.verified === false))) && (
            <TouchableOpacity
              style={[styles.resubmitButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(sitter)/profile-setup')}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.resubmitButtonText}>Resubmit Documents</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Documents Card */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Submitted Documents</Text>

          {verification.idDocumentUrl && (
            <TouchableOpacity
              style={[styles.documentItem, { borderColor: colors.border }]}
              onPress={() => {
                if (verification.idDocumentUrl) {
                  Linking.openURL(verification.idDocumentUrl).catch((err) => {
                    Alert.alert('Error', 'Could not open document');
                  });
                }
              }}
            >
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <View style={styles.documentInfo}>
                <View style={styles.documentHeader}>
                  <Text style={[styles.documentTitle, { color: colors.text }]}>ID Document</Text>
                  {verification.idDocumentVerified !== undefined ? (
                    <Badge
                      variant={verification.idDocumentVerified ? 'success' : 'error'}
                      style={styles.verificationBadge}
                    >
                      {verification.idDocumentVerified ? 'Verified' : 'Rejected'}
                    </Badge>
                  ) : (
                    <Badge variant="info" style={styles.verificationBadge}>
                      Pending
                    </Badge>
                  )}
                </View>
                <View style={styles.documentMeta}>
                  <Text style={[styles.documentSubtitle, { color: colors.textSecondary }]}>
                    Submitted: {format(verification.submittedAt, 'MMM dd, yyyy HH:mm')}
                  </Text>
                  {verification.idDocumentVerified !== undefined && verification.reviewedAt && (
                    <Text style={[styles.documentSubtitle, { color: colors.textSecondary, marginTop: 2 }]}>
                      Reviewed: {format(verification.reviewedAt, 'MMM dd, yyyy HH:mm')}
                    </Text>
                  )}
                </View>
                {verification.idDocumentComment && (
                  <Text style={[styles.adminComment, { color: verification.idDocumentVerified ? colors.success : colors.error }]}>
                    Admin: {verification.idDocumentComment}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {verification.backgroundCheckUrl && (
            <TouchableOpacity
              style={[styles.documentItem, { borderColor: colors.border }]}
              onPress={() => {
                if (verification.backgroundCheckUrl) {
                  Linking.openURL(verification.backgroundCheckUrl).catch((err) => {
                    Alert.alert('Error', 'Could not open document');
                  });
                }
              }}
            >
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <View style={styles.documentInfo}>
                <View style={styles.documentHeader}>
                  <Text style={[styles.documentTitle, { color: colors.text }]}>Background Check</Text>
                  {verification.backgroundCheckVerified !== undefined ? (
                    <Badge
                      variant={verification.backgroundCheckVerified ? 'success' : 'error'}
                      style={styles.verificationBadge}
                    >
                      {verification.backgroundCheckVerified ? 'Verified' : 'Rejected'}
                    </Badge>
                  ) : (
                    <Badge variant="info" style={styles.verificationBadge}>
                      Pending
                    </Badge>
                  )}
                </View>
                <View style={styles.documentMeta}>
                  <Text style={[styles.documentSubtitle, { color: colors.textSecondary }]}>
                    Submitted: {format(verification.submittedAt, 'MMM dd, yyyy HH:mm')}
                  </Text>
                  {verification.backgroundCheckVerified !== undefined && verification.reviewedAt && (
                    <Text style={[styles.documentSubtitle, { color: colors.textSecondary, marginTop: 2 }]}>
                      Reviewed: {format(verification.reviewedAt, 'MMM dd, yyyy HH:mm')}
                    </Text>
                  )}
                </View>
                {verification.backgroundCheckComment && (
                  <Text style={[styles.adminComment, { color: verification.backgroundCheckVerified ? colors.success : colors.error }]}>
                    Admin: {verification.backgroundCheckComment}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {verification.qualificationDocumentUrl && (
            <TouchableOpacity
              style={[styles.documentItem, { borderColor: colors.border }]}
              onPress={() => {
                if (verification.qualificationDocumentUrl) {
                  Linking.openURL(verification.qualificationDocumentUrl).catch((err) => {
                    Alert.alert('Error', 'Could not open document');
                  });
                }
              }}
            >
              <Ionicons name="school" size={24} color={colors.primary} />
              <View style={styles.documentInfo}>
                <View style={styles.documentHeader}>
                  <Text style={[styles.documentTitle, { color: colors.text }]}>Qualification Document</Text>
                  {verification.qualificationDocumentVerified !== undefined ? (
                    <Badge
                      variant={verification.qualificationDocumentVerified ? 'success' : 'error'}
                      style={styles.verificationBadge}
                    >
                      {verification.qualificationDocumentVerified ? 'Verified' : 'Rejected'}
                    </Badge>
                  ) : (
                    <Badge variant="info" style={styles.verificationBadge}>
                      Pending
                    </Badge>
                  )}
                </View>
                <View style={styles.documentMeta}>
                  <Text style={[styles.documentSubtitle, { color: colors.textSecondary }]}>
                    Submitted: {format(verification.submittedAt, 'MMM dd, yyyy HH:mm')}
                  </Text>
                  {verification.qualificationDocumentVerified !== undefined && verification.reviewedAt && (
                    <Text style={[styles.documentSubtitle, { color: colors.textSecondary, marginTop: 2 }]}>
                      Reviewed: {format(verification.reviewedAt, 'MMM dd, yyyy HH:mm')}
                    </Text>
                  )}
                </View>
                {verification.qualificationDocumentComment && (
                  <Text style={[styles.adminComment, { color: verification.qualificationDocumentVerified ? colors.success : colors.error }]}>
                    Admin: {verification.qualificationDocumentComment}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {verification.certifications && verification.certifications.length > 0 && (
            <View style={styles.certificationsSection}>
              <Text style={[styles.certificationsTitle, { color: colors.text }]}>Certifications</Text>
              {verification.certifications.map((cert, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.documentItem, { borderColor: colors.border }]}
                  onPress={() => {
                    if (cert.url) {
                      Linking.openURL(cert.url).catch((err) => {
                        Alert.alert('Error', 'Could not open document');
                      });
                    }
                  }}
                >
                  <Ionicons name="ribbon" size={24} color={colors.primary} />
                  <View style={styles.documentInfo}>
                    <View style={styles.documentHeader}>
                      <Text style={[styles.documentTitle, { color: colors.text }]}>{cert.name}</Text>
                      {cert.verified !== undefined ? (
                        <Badge
                          variant={cert.verified ? 'success' : 'error'}
                          style={styles.verificationBadge}
                        >
                          {cert.verified ? 'Verified' : 'Rejected'}
                        </Badge>
                      ) : (
                        <Badge variant="info" style={styles.verificationBadge}>
                          Pending
                        </Badge>
                      )}
                    </View>
                    <View style={styles.documentMeta}>
                      <Text style={[styles.documentSubtitle, { color: colors.textSecondary }]}>
                        Issued: {format(cert.issuedDate, 'MMM dd, yyyy')}
                        {cert.expiryDate && ` • Expires: ${format(cert.expiryDate, 'MMM dd, yyyy')}`}
                      </Text>
                      <Text style={[styles.documentSubtitle, { color: colors.textSecondary, marginTop: 2 }]}>
                        Submitted: {format(verification.submittedAt, 'MMM dd, yyyy HH:mm')}
                      </Text>
                      {cert.verified !== undefined && verification.reviewedAt && (
                        <Text style={[styles.documentSubtitle, { color: colors.textSecondary, marginTop: 2 }]}>
                          Reviewed: {format(verification.reviewedAt, 'MMM dd, yyyy HH:mm')}
                        </Text>
                      )}
                    </View>
                    {cert.adminComment && (
                      <Text style={[styles.adminComment, { color: cert.verified ? colors.success : colors.error }]}>
                        Admin: {cert.adminComment}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!verification.idDocumentUrl && !verification.backgroundCheckUrl && !verification.qualificationDocumentUrl && (!verification.certifications || verification.certifications.length === 0) && (
            <Text style={[styles.noDocuments, { color: colors.textSecondary }]}>No documents submitted</Text>
          )}
        </Card>

        {/* Qualifications & Experience */}
        {verification.qualifications && verification.qualifications.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Qualifications & Experience</Text>
            <Text style={[styles.qualificationsText, { color: colors.text }]}>
              {verification.qualifications.join('; ')}
            </Text>
          </Card>
        )}

        {/* Actions */}
        {verification.status === 'rejected' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(sitter)/profile-setup')}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Update Profile & Resubmit</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <SitterHamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
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
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
  },
  rejectionBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  successText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
  },
  reviewInfo: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  reviewLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  documentSubtitle: {
    fontSize: 12,
  },
  documentMeta: {
    marginTop: 4,
  },
  certificationsSection: {
    marginTop: 16,
  },
  certificationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  noDocuments: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  setupButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  resubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  adminComment: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
