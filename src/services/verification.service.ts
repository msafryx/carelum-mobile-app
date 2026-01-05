/**
 * Verification Service
 * Handles babysitter verification requests
 */
import { ServiceResult } from '@/src/types/error.types';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/src/config/firebase';
import { handleFirestoreError, retryWithBackoff } from '@/src/utils/errorHandler';

const COLLECTION_NAME = 'verificationRequests';

export interface VerificationRequest {
  id?: string;
  sitterId: string;
  fullName: string;
  dateOfBirth?: Date;
  idNumber?: string;
  idDocumentUrl?: string;
  backgroundCheckUrl?: string;
  certifications?: Array<{
    name: string;
    url: string;
    issuedDate: Date;
    expiryDate?: Date;
  }>;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  bio?: string;
  qualifications?: string[];
  hourlyRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create verification request
 */
export async function createVerificationRequest(
  requestData: Omit<VerificationRequest, 'id' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'status'>
): Promise<ServiceResult<VerificationRequest>> {
  try {
    const requestRef = doc(collection(firestore!, COLLECTION_NAME));
    const newRequest: VerificationRequest = {
      id: requestRef.id,
      ...requestData,
      status: 'pending',
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await retryWithBackoff(async () => {
      await setDoc(requestRef, {
        ...newRequest,
        dateOfBirth: newRequest.dateOfBirth ? Timestamp.fromDate(newRequest.dateOfBirth) : null,
        submittedAt: Timestamp.fromDate(newRequest.submittedAt),
        createdAt: Timestamp.fromDate(newRequest.createdAt),
        updatedAt: Timestamp.fromDate(newRequest.updatedAt),
        certifications: newRequest.certifications?.map((cert) => ({
          ...cert,
          issuedDate: Timestamp.fromDate(cert.issuedDate),
          expiryDate: cert.expiryDate ? Timestamp.fromDate(cert.expiryDate) : null,
        })),
      });
    });

    return { success: true, data: newRequest };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get verification request for a sitter
 */
export async function getSitterVerification(
  sitterId: string
): Promise<ServiceResult<VerificationRequest | null>> {
  try {
    const q = query(
      collection(firestore!, COLLECTION_NAME),
      where('sitterId', '==', sitterId),
      orderBy('submittedAt', 'desc'),
      limit(1)
    );

    const snapshot = await retryWithBackoff(async () => getDocs(q));

    if (snapshot.empty) {
      return { success: true, data: null };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      success: true,
      data: {
        id: doc.id,
        ...data,
        dateOfBirth: data.dateOfBirth ? (data.dateOfBirth as Timestamp)?.toDate() : undefined,
        submittedAt: (data.submittedAt as Timestamp)?.toDate() || new Date(),
        reviewedAt: data.reviewedAt ? (data.reviewedAt as Timestamp)?.toDate() : undefined,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
        certifications: data.certifications?.map((cert: any) => ({
          ...cert,
          issuedDate: (cert.issuedDate as Timestamp)?.toDate(),
          expiryDate: cert.expiryDate ? (cert.expiryDate as Timestamp)?.toDate() : undefined,
        })),
      } as VerificationRequest,
    };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get pending verification requests (for admin)
 */
export async function getPendingVerifications(): Promise<ServiceResult<VerificationRequest[]>> {
  try {
    const q = query(
      collection(firestore!, COLLECTION_NAME),
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'asc')
    );

    const snapshot = await retryWithBackoff(async () => getDocs(q));
    const requests: VerificationRequest[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      requests.push({
        id: doc.id,
        ...data,
        dateOfBirth: data.dateOfBirth ? (data.dateOfBirth as Timestamp)?.toDate() : undefined,
        submittedAt: (data.submittedAt as Timestamp)?.toDate() || new Date(),
        reviewedAt: data.reviewedAt ? (data.reviewedAt as Timestamp)?.toDate() : undefined,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
        certifications: data.certifications?.map((cert: any) => ({
          ...cert,
          issuedDate: (cert.issuedDate as Timestamp)?.toDate(),
          expiryDate: cert.expiryDate ? (cert.expiryDate as Timestamp)?.toDate() : undefined,
        })),
      } as VerificationRequest);
    });

    return { success: true, data: requests };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Update verification status (admin only)
 */
export async function updateVerificationStatus(
  requestId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  rejectionReason?: string
): Promise<ServiceResult<void>> {
  try {
    if (!firestore) {
      return {
        success: false,
        error: {
          code: 'FIREBASE_NOT_CONFIGURED',
          message: 'Firestore is not configured',
        },
      };
    }

    const requestRef = doc(firestore, COLLECTION_NAME, requestId);
    
    // Get the request to update sitter's user profile
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Verification request not found',
        },
      };
    }

    const requestData = requestSnap.data();
    const sitterId = requestData.sitterId;

    // Update verification request
    await retryWithBackoff(async () => {
      await updateDoc(requestRef, {
        status,
        reviewedBy,
        reviewedAt: Timestamp.now(),
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        updatedAt: Timestamp.now(),
      });
    });

    // Update sitter's user profile
    const sitterRef = doc(firestore, 'users', sitterId);
    await retryWithBackoff(async () => {
      await updateDoc(sitterRef, {
        isVerified: status === 'approved',
        verificationStatus: status === 'approved' ? 'approved' : 'rejected',
        updatedAt: Timestamp.now(),
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}
