import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { useTheme } from '@/src/components/ui/ThemeProvider';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';
import Badge from '@/src/components/ui/Badge';
import EmptyState from '@/src/components/ui/EmptyState';
import AdminHamburgerMenu from '@/src/components/ui/AdminHamburgerMenu';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/hooks/useAuth';
import { getPendingVerifications, updateVerificationStatus, verifyDocument } from '@/src/services/verification.service';
import type { VerificationRequest } from '@/src/services/verification.service';
import { format } from 'date-fns';
import { supabase } from '@/src/config/supabase';

export default function VerificationsScreen() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<VerificationRequest | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [docVerifyModalVisible, setDocVerifyModalVisible] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<'idDocument' | 'backgroundCheck' | 'qualificationDocument' | 'certification' | null>(null);
  const [selectedCertIndex, setSelectedCertIndex] = useState<number | null>(null);
  const [docVerifyComment, setDocVerifyComment] = useState('');
  const [docVerifying, setDocVerifying] = useState(false);

  const loadVerifications = useCallback(async () => {
    try {
      const result = await getPendingVerifications();
      if (result.success && result.data) {
        setVerifications(result.data);
      } else {
        console.error('Failed to load verifications:', result.error);
        Alert.alert('Error', result.error?.message || 'Failed to load verification requests');
      }
    } catch (error: any) {
      console.error('Error loading verifications:', error);
      Alert.alert('Error', 'Failed to load verification requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVerifications();
  }, [loadVerifications]);

  // Realtime subscription for verification updates
  useEffect(() => {
    if (!supabase) return;

    console.log('🔄 Setting up realtime subscription for verification requests...');
    const channel = supabase
      .channel('verification_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'verification_requests',
        },
        (payload) => {
          console.log('🔄 Verification request changed:', payload.eventType);
          // Reload verifications when any change occurs
          loadVerifications();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, [loadVerifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadVerifications();
  }, [loadVerifications]);

  const handleReview = (verification: VerificationRequest) => {
    setSelectedVerification(verification);
    setRejectionReason('');
    setReviewModalVisible(true);
  };

  const handleApprove = async () => {
    if (!selectedVerification || !user) return;

    setProcessing(true);
    try {
      const result = await updateVerificationStatus(
        selectedVerification.id!,
        'approved',
        user.id
      );

      if (result.success) {
        Alert.alert('Success', 'Verification request approved successfully!', [
          { text: 'OK', onPress: () => {
            setReviewModalVisible(false);
            loadVerifications();
          }},
        ]);
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to approve verification');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to approve verification');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVerification || !user) return;

    if (!rejectionReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const result = await updateVerificationStatus(
        selectedVerification.id!,
        'rejected',
        user.id,
        rejectionReason.trim()
      );

      if (result.success) {
        Alert.alert('Success', 'Verification request rejected.', [
          { text: 'OK', onPress: () => {
            setReviewModalVisible(false);
            setRejectionReason('');
            loadVerifications();
          }},
        ]);
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to reject verification');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to reject verification');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {verifications.length === 0 ? (
          <EmptyState
            icon="document-outline"
            title="No Pending Verifications"
            message="All verification requests have been processed"
          />
        ) : (
          verifications.map((verification) => (
            <Card key={verification.id} style={styles.verificationCard}>
              <View style={styles.cardHeader}>
                <View style={styles.sitterInfo}>
                  <Text style={[styles.sitterName, { color: colors.text }]}>
                    {verification.fullName || 'Unknown Sitter'}
                  </Text>
                  <Text style={[styles.submittedDate, { color: colors.textSecondary }]}>
                    Submitted: {format(verification.submittedAt, 'MMM dd, yyyy HH:mm')}
                  </Text>
                </View>
                <Badge variant="warning">Pending</Badge>
              </View>

              {verification.bio && (
                <View style={styles.bioSection}>
                  <Text style={[styles.bioLabel, { color: colors.textSecondary }]}>Bio:</Text>
                  <Text style={[styles.bioText, { color: colors.text }]}>{verification.bio}</Text>
                </View>
              )}

              {verification.hourlyRate && (
                <Text style={[styles.hourlyRate, { color: colors.text }]}>
                  Hourly Rate: ${verification.hourlyRate.toFixed(2)}
                </Text>
              )}

              {verification.qualifications && verification.qualifications.length > 0 && (
                <View style={styles.qualificationsSection}>
                  <Text style={[styles.qualificationsLabel, { color: colors.textSecondary }]}>Qualifications & Experience:</Text>
                  <Text style={[styles.qualificationText, { color: colors.text }]}>
                    {verification.qualifications.join('; ')}
                  </Text>
                </View>
              )}

              <View style={styles.documentsSection}>
                <Text style={[styles.documentsTitle, { color: colors.text }]}>Documents:</Text>
                {verification.idDocumentUrl && (
                  <View style={[styles.documentItemWithActions, { borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.documentButton}
                      onPress={() => {
                        if (verification.idDocumentUrl) {
                          Linking.openURL(verification.idDocumentUrl).catch((err) => {
                            Alert.alert('Error', 'Could not open document');
                          });
                        }
                      }}
                    >
                      <Ionicons name="document-text" size={20} color={colors.primary} />
                      <View style={styles.documentInfo}>
                        <View style={styles.documentHeader}>
                          <Text style={[styles.documentButtonText, { color: colors.text }]}>ID Document</Text>
                          {verification.idDocumentVerified !== undefined ? (
                            <Badge variant={verification.idDocumentVerified ? 'success' : 'error'}>
                              {verification.idDocumentVerified ? 'Verified' : 'Rejected'}
                            </Badge>
                          ) : (
                            <Badge variant="info">Pending</Badge>
                          )}
                        </View>
                        {verification.idDocumentComment && (
                          <Text style={[styles.docComment, { color: colors.textSecondary }]}>
                            {verification.idDocumentComment}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={styles.docActions}>
                      <TouchableOpacity
                        style={[styles.docVerifyButton, { backgroundColor: colors.success || '#10b981' }]}
                        onPress={() => {
                          setSelectedVerification(verification);
                          setSelectedDocType('idDocument');
                          setSelectedCertIndex(null);
                          setDocVerifyComment('');
                          setDocVerifyModalVisible(true);
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.docRejectButton, { backgroundColor: colors.error || '#ef4444' }]}
                        onPress={() => {
                          setSelectedVerification(verification);
                          setSelectedDocType('idDocument');
                          setSelectedCertIndex(null);
                          setDocVerifyComment('');
                          setDocVerifyModalVisible(true);
                        }}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {verification.backgroundCheckUrl && (
                  <View style={[styles.documentItemWithActions, { borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.documentButton}
                      onPress={() => {
                        if (verification.backgroundCheckUrl) {
                          Linking.openURL(verification.backgroundCheckUrl).catch((err) => {
                            Alert.alert('Error', 'Could not open document');
                          });
                        }
                      }}
                    >
                      <Ionicons name="document-text" size={20} color={colors.primary} />
                      <View style={styles.documentInfo}>
                            <View style={styles.documentHeader}>
                              <Text style={[styles.documentButtonText, { color: colors.text }]}>Background Check</Text>
                              {verification.backgroundCheckVerified !== undefined ? (
                                <Badge variant={verification.backgroundCheckVerified ? 'success' : 'error'}>
                                  {verification.backgroundCheckVerified ? 'Verified' : 'Rejected'}
                                </Badge>
                              ) : (
                                <Badge variant="info">Pending</Badge>
                              )}
                            </View>
                        {verification.backgroundCheckComment && (
                          <Text style={[styles.docComment, { color: colors.textSecondary }]}>
                            {verification.backgroundCheckComment}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={styles.docActions}>
                      <TouchableOpacity
                        style={[styles.docVerifyButton, { backgroundColor: colors.success || '#10b981' }]}
                        onPress={() => {
                          setSelectedVerification(verification);
                          setSelectedDocType('backgroundCheck');
                          setSelectedCertIndex(null);
                          setDocVerifyComment('');
                          setDocVerifyModalVisible(true);
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.docRejectButton, { backgroundColor: colors.error || '#ef4444' }]}
                        onPress={() => {
                          setSelectedVerification(verification);
                          setSelectedDocType('backgroundCheck');
                          setSelectedCertIndex(null);
                          setDocVerifyComment('');
                          setDocVerifyModalVisible(true);
                        }}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {verification.qualificationDocumentUrl && (
                  <View style={[styles.documentItemWithActions, { borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.documentButton}
                      onPress={() => {
                        if (verification.qualificationDocumentUrl) {
                          Linking.openURL(verification.qualificationDocumentUrl).catch((err) => {
                            Alert.alert('Error', 'Could not open document');
                          });
                        }
                      }}
                    >
                      <Ionicons name="school" size={20} color={colors.primary} />
                      <View style={styles.documentInfo}>
                            <View style={styles.documentHeader}>
                              <Text style={[styles.documentButtonText, { color: colors.text }]}>Qualification Document</Text>
                              {verification.qualificationDocumentVerified !== undefined ? (
                                <Badge variant={verification.qualificationDocumentVerified ? 'success' : 'error'}>
                                  {verification.qualificationDocumentVerified ? 'Verified' : 'Rejected'}
                                </Badge>
                              ) : (
                                <Badge variant="info">Pending</Badge>
                              )}
                            </View>
                        {verification.qualificationDocumentComment && (
                          <Text style={[styles.docComment, { color: colors.textSecondary }]}>
                            {verification.qualificationDocumentComment}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={styles.docActions}>
                      <TouchableOpacity
                        style={[styles.docVerifyButton, { backgroundColor: colors.success || '#10b981' }]}
                        onPress={() => {
                          setSelectedVerification(verification);
                          setSelectedDocType('qualificationDocument');
                          setSelectedCertIndex(null);
                          setDocVerifyComment('');
                          setDocVerifyModalVisible(true);
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.docRejectButton, { backgroundColor: colors.error || '#ef4444' }]}
                        onPress={() => {
                          setSelectedVerification(verification);
                          setSelectedDocType('qualificationDocument');
                          setSelectedCertIndex(null);
                          setDocVerifyComment('');
                          setDocVerifyModalVisible(true);
                        }}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {verification.certifications && verification.certifications.length > 0 && (
                  <View style={styles.certificationsList}>
                    {verification.certifications.map((cert, index) => (
                      <View key={index} style={[styles.documentItemWithActions, { borderColor: colors.border }]}>
                        <TouchableOpacity
                          style={styles.documentButton}
                          onPress={() => {
                            if (cert.url) {
                              Linking.openURL(cert.url).catch((err) => {
                                Alert.alert('Error', 'Could not open document');
                              });
                            }
                          }}
                        >
                          <Ionicons name="ribbon" size={20} color={colors.primary} />
                          <View style={styles.certInfo}>
                            <View style={styles.documentHeader}>
                              <Text style={[styles.documentButtonText, { color: colors.text }]}>{cert.name}</Text>
                              {cert.verified !== undefined ? (
                                <Badge variant={cert.verified ? 'success' : 'error'}>
                                  {cert.verified ? 'Verified' : 'Rejected'}
                                </Badge>
                              ) : (
                                <Badge variant="info">Pending</Badge>
                              )}
                            </View>
                            <Text style={[styles.certDate, { color: colors.textSecondary }]}>
                              Issued: {format(cert.issuedDate, 'MMM dd, yyyy')}
                            </Text>
                            {cert.adminComment && (
                              <Text style={[styles.docComment, { color: colors.textSecondary }]}>
                                {cert.adminComment}
                              </Text>
                            )}
                          </View>
                          <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.docActions}>
                          <TouchableOpacity
                            style={[styles.docVerifyButton, { backgroundColor: colors.success || '#10b981' }]}
                            onPress={() => {
                              setSelectedVerification(verification);
                              setSelectedDocType('certification');
                              setSelectedCertIndex(index);
                              setDocVerifyComment('');
                              setDocVerifyModalVisible(true);
                            }}
                          >
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.docRejectButton, { backgroundColor: colors.error || '#ef4444' }]}
                            onPress={() => {
                              setSelectedVerification(verification);
                              setSelectedDocType('certification');
                              setSelectedCertIndex(index);
                              setDocVerifyComment('');
                              setDocVerifyModalVisible(true);
                            }}
                          >
                            <Ionicons name="close" size={16} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.approveButton, { backgroundColor: colors.success || '#10b981' }]}
                  onPress={() => handleReview(verification)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Review</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={reviewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Review Verification</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedVerification && (
              <>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Sitter: {selectedVerification.fullName || 'Unknown'}
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalApproveButton, { backgroundColor: colors.success || '#10b981' }]}
                    onPress={handleApprove}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.modalButtonText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.rejectionSection}>
                    <Text style={[styles.rejectionLabel, { color: colors.text }]}>
                      Rejection Reason (if rejecting):
                    </Text>
                    <TextInput
                      style={[styles.rejectionInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      placeholder="Enter reason for rejection..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={4}
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                    />
                    <TouchableOpacity
                      style={[styles.modalRejectButton, { backgroundColor: colors.error || '#ef4444' }]}
                      onPress={handleReject}
                      disabled={processing || !rejectionReason.trim()}
                    >
                      {processing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="close-circle" size={20} color="#fff" />
                          <Text style={styles.modalButtonText}>Reject</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Document Verification Modal */}
      <Modal
        visible={docVerifyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDocVerifyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedDocType === 'certification' ? 'Verify Certification' : 'Verify Document'}
              </Text>
              <TouchableOpacity onPress={() => setDocVerifyModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedVerification && selectedDocType && (
              <>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {selectedDocType === 'idDocument' && 'ID Document'}
                  {selectedDocType === 'backgroundCheck' && 'Background Check'}
                  {selectedDocType === 'qualificationDocument' && 'Qualification Document'}
                  {selectedDocType === 'certification' && selectedCertIndex !== null && 
                    `Certification: ${selectedVerification.certifications?.[selectedCertIndex]?.name || 'Unknown'}`}
                </Text>

                <Text style={[styles.rejectionLabel, { color: colors.text, marginTop: 16 }]}>
                  Comment (optional):
                </Text>
                <TextInput
                  style={[styles.rejectionInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Add a comment about this document..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={docVerifyComment}
                  onChangeText={setDocVerifyComment}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalApproveButton, { backgroundColor: colors.success || '#10b981' }]}
                    onPress={async () => {
                      if (!selectedVerification.id || !user) return;
                      setDocVerifying(true);
                      try {
                        const result = await verifyDocument(
                          selectedVerification.id,
                          selectedDocType,
                          true,
                          docVerifyComment.trim() || undefined,
                          selectedDocType === 'certification' ? selectedCertIndex || undefined : undefined
                        );
                        if (result.success) {
                          Alert.alert('Success', 'Document verified successfully!', [
                            { text: 'OK', onPress: () => {
                              setDocVerifyModalVisible(false);
                              setDocVerifyComment('');
                              loadVerifications();
                            }},
                          ]);
                        } else {
                          Alert.alert('Error', result.error?.message || 'Failed to verify document');
                        }
                      } catch (error: any) {
                        Alert.alert('Error', 'Failed to verify document');
                      } finally {
                        setDocVerifying(false);
                      }
                    }}
                    disabled={docVerifying}
                  >
                    {docVerifying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.modalButtonText}>Verify</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalRejectButton, { backgroundColor: colors.error || '#ef4444' }]}
                    onPress={async () => {
                      if (!selectedVerification.id || !user) return;
                      setDocVerifying(true);
                      try {
                        const result = await verifyDocument(
                          selectedVerification.id,
                          selectedDocType,
                          false,
                          docVerifyComment.trim() || 'Document rejected',
                          selectedDocType === 'certification' ? selectedCertIndex || undefined : undefined
                        );
                        if (result.success) {
                          Alert.alert('Success', 'Document rejected.', [
                            { text: 'OK', onPress: () => {
                              setDocVerifyModalVisible(false);
                              setDocVerifyComment('');
                              loadVerifications();
                            }},
                          ]);
                        } else {
                          Alert.alert('Error', result.error?.message || 'Failed to reject document');
                        }
                      } catch (error: any) {
                        Alert.alert('Error', 'Failed to reject document');
                      } finally {
                        setDocVerifying(false);
                      }
                    }}
                    disabled={docVerifying}
                  >
                    {docVerifying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={20} color="#fff" />
                        <Text style={styles.modalButtonText}>Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  verificationCard: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sitterInfo: {
    flex: 1,
  },
  sitterName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  submittedDate: {
    fontSize: 12,
  },
  bioSection: {
    marginBottom: 12,
  },
  bioLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  bioText: {
    fontSize: 14,
  },
  hourlyRate: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  qualificationsSection: {
    marginBottom: 12,
  },
  qualificationsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  qualificationText: {
    fontSize: 14,
    marginBottom: 2,
  },
  documentsSection: {
    marginBottom: 12,
  },
  documentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  documentButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
  },
  certificationsList: {
    marginTop: 8,
  },
  certInfo: {
    flex: 1,
    marginLeft: 12,
  },
  certDate: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalActions: {
    gap: 16,
  },
  modalApproveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  rejectionSection: {
    marginTop: 16,
  },
  rejectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  rejectionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalRejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  documentItemWithActions: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  docComment: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  docActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 8,
    gap: 8,
  },
  docVerifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  docRejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
});
