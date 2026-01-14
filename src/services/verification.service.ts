/**
 * Verification Service - Supabase
 * Handles babysitter verification requests
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { executeWrite } from './supabase-write.service';
import { getFileUrl } from './storage.service';

export interface VerificationRequest {
  id?: string;
  sitterId: string;
  fullName?: string;
  dateOfBirth?: Date;
  idNumber?: string;
  idDocumentUrl?: string;
  idDocumentVerified?: boolean;
  idDocumentComment?: string;
  backgroundCheckUrl?: string;
  backgroundCheckVerified?: boolean;
  backgroundCheckComment?: string;
  qualificationDocumentUrl?: string;
  qualificationDocumentVerified?: boolean;
  qualificationDocumentComment?: string;
  certifications?: Array<{
    name: string;
    url: string;
    issuedDate: Date;
    expiryDate?: Date;
    verified?: boolean;
    adminComment?: string | null;
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
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    // Build documents JSON with verification structure
    const documentsObj: any = {};
    if (requestData.idDocumentUrl) {
      documentsObj.idDocument = {
        url: requestData.idDocumentUrl,
        verified: false,
        adminComment: null,
      };
    }
    if (requestData.backgroundCheckUrl) {
      documentsObj.backgroundCheck = {
        url: requestData.backgroundCheckUrl,
        verified: false,
        adminComment: null,
      };
    }
    if (requestData.qualificationDocumentUrl) {
      documentsObj.qualificationDocument = {
        url: requestData.qualificationDocumentUrl,
        verified: false,
        adminComment: null,
      };
    }
    if (requestData.certifications && requestData.certifications.length > 0) {
      documentsObj.certifications = requestData.certifications.map(cert => ({
        name: cert.name,
        url: cert.url,
        issuedDate: cert.issuedDate.toISOString(),
        expiryDate: cert.expiryDate?.toISOString(),
        verified: false,
        adminComment: null,
      }));
    }
    documentsObj.bio = requestData.bio;
    documentsObj.hourlyRate = requestData.hourlyRate;

    const insertRes = await executeWrite(() => supabase
      .from('verification_requests')
      .insert({
        sitter_id: requestData.sitterId,
        status: 'pending',
        documents: Object.keys(documentsObj).length > 0 ? JSON.stringify(documentsObj) : null,
        qualifications_text: requestData.qualifications && requestData.qualifications.length > 0 
          ? requestData.qualifications.join('; ') 
          : null,
        admin_notes: null,
        reviewed_by: null,
        reviewed_at: null,
      })
      .select()
      .single(), 'verification_insert');

    const data = insertRes.data;
    const error = insertRes.error;

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to create verification request: ${error.message || JSON.stringify(error)}`,
        },
      };
    }

    const request: VerificationRequest = {
      id: data.id,
      sitterId: data.sitter_id,
      status: data.status,
      submittedAt: new Date(data.created_at),
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      reviewedBy: data.reviewed_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      fullName: requestData.fullName,
      dateOfBirth: requestData.dateOfBirth,
      idNumber: requestData.idNumber,
      idDocumentUrl: requestData.idDocumentUrl,
      backgroundCheckUrl: requestData.backgroundCheckUrl,
      certifications: requestData.certifications,
      rejectionReason: data.admin_notes && data.status === 'rejected' ? data.admin_notes : undefined,
      bio: requestData.bio,
      qualifications: requestData.qualifications,
      hourlyRate: requestData.hourlyRate,
    };

    return { success: true, data: request };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
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
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('sitter_id', sitterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: null };
      }
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch verification: ${error.message}`,
        },
      };
    }

    if (!data) {
      return { success: true, data: null };
    }

    const documents = data.documents ? (typeof data.documents === 'string' ? JSON.parse(data.documents) : data.documents) : null;

    // Extract document URLs and verification status from new structure
    let idDocumentUrl: string | undefined;
    let idDocumentVerified: boolean | undefined;
    let idDocumentComment: string | undefined;
    let backgroundCheckUrl: string | undefined;
    let backgroundCheckVerified: boolean | undefined;
    let backgroundCheckComment: string | undefined;
    let qualificationDocumentUrl: string | undefined;
    let qualificationDocumentVerified: boolean | undefined;
    let qualificationDocumentComment: string | undefined;
    let certifications: any[] | undefined;

    // Handle both old format (direct URLs) and new format (objects with verification)
    if (documents?.idDocument) {
      if (typeof documents.idDocument === 'string') {
        // Old format
        idDocumentUrl = documents.idDocument;
      } else {
        // New format
        idDocumentUrl = documents.idDocument.url;
        idDocumentVerified = documents.idDocument.verified;
        idDocumentComment = documents.idDocument.adminComment;
      }
    }
    if (documents?.backgroundCheck) {
      if (typeof documents.backgroundCheck === 'string') {
        backgroundCheckUrl = documents.backgroundCheck;
      } else {
        backgroundCheckUrl = documents.backgroundCheck.url;
        backgroundCheckVerified = documents.backgroundCheck.verified;
        backgroundCheckComment = documents.backgroundCheck.adminComment;
      }
    }
    if (documents?.qualificationDocument) {
      if (typeof documents.qualificationDocument === 'string') {
        qualificationDocumentUrl = documents.qualificationDocument;
      } else {
        qualificationDocumentUrl = documents.qualificationDocument.url;
        qualificationDocumentVerified = documents.qualificationDocument.verified;
        qualificationDocumentComment = documents.qualificationDocument.adminComment;
      }
    }
    if (documents?.certifications) {
      certifications = documents.certifications.map((cert: any) => {
        const certObj = {
          name: cert.name,
          url: typeof cert.url === 'string' ? cert.url : cert.url?.url || cert.url,
          issuedDate: new Date(cert.issuedDate),
          expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined,
          verified: cert.verified !== undefined ? cert.verified : false,
          adminComment: cert.adminComment || null,
        };
        return certObj;
      });
    }

    // Convert paths to full URLs if they're not already URLs
    if (idDocumentUrl && !idDocumentUrl.startsWith('http')) {
      const urlResult = await getFileUrl(idDocumentUrl);
      if (urlResult.success) {
        idDocumentUrl = urlResult.data;
      }
    }
    if (backgroundCheckUrl && !backgroundCheckUrl.startsWith('http')) {
      const urlResult = await getFileUrl(backgroundCheckUrl);
      if (urlResult.success) {
        backgroundCheckUrl = urlResult.data;
      }
    }
    if (qualificationDocumentUrl && !qualificationDocumentUrl.startsWith('http')) {
      const urlResult = await getFileUrl(qualificationDocumentUrl);
      if (urlResult.success) {
        qualificationDocumentUrl = urlResult.data;
      }
    }
    if (certifications) {
      for (let i = 0; i < certifications.length; i++) {
        if (certifications[i].url && !certifications[i].url.startsWith('http')) {
          const urlResult = await getFileUrl(certifications[i].url);
          if (urlResult.success) {
            certifications[i].url = urlResult.data;
          }
        }
      }
    }

    const request: VerificationRequest = {
      id: data.id,
      sitterId: data.sitter_id,
      status: data.status,
      submittedAt: new Date(data.created_at),
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      reviewedBy: data.reviewed_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      idDocumentUrl,
      idDocumentVerified,
      idDocumentComment,
      backgroundCheckUrl,
      backgroundCheckVerified,
      backgroundCheckComment,
      qualificationDocumentUrl,
      qualificationDocumentVerified,
      qualificationDocumentComment,
      certifications,
      rejectionReason: data.admin_notes || undefined, // Show admin notes for both approved and rejected
      bio: documents?.bio,
      qualifications: data.qualifications_text ? data.qualifications_text.split('; ') : (documents?.qualifications || undefined),
      hourlyRate: documents?.hourlyRate,
    };

    return { success: true, data: request };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get pending verification requests (for admin)
 */
export async function getPendingVerifications(): Promise<ServiceResult<VerificationRequest[]>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    const { data, error } = await supabase
      .from('verification_requests')
      .select(`
        *,
        sitter:users!verification_requests_sitter_id_fkey(
          id,
          display_name,
          email,
          role
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch verifications: ${error.message}`,
        },
      };
    }

    // Convert document paths to full URLs for all requests (same logic as getSitterVerification)
    const requests: VerificationRequest[] = await Promise.all(
      (data || []).map(async (row: any) => {
        const documents = row.documents ? (typeof row.documents === 'string' ? JSON.parse(row.documents) : row.documents) : null;
        
        // Extract document URLs and verification status (same logic as getSitterVerification)
        let idDocumentUrl: string | undefined;
        let idDocumentVerified: boolean | undefined;
        let idDocumentComment: string | undefined;
        let backgroundCheckUrl: string | undefined;
        let backgroundCheckVerified: boolean | undefined;
        let backgroundCheckComment: string | undefined;
        let qualificationDocumentUrl: string | undefined;
        let qualificationDocumentVerified: boolean | undefined;
        let qualificationDocumentComment: string | undefined;
        let certifications: any[] | undefined;

        if (documents?.idDocument) {
          if (typeof documents.idDocument === 'string') {
            idDocumentUrl = documents.idDocument;
          } else {
            idDocumentUrl = documents.idDocument.url;
            idDocumentVerified = documents.idDocument.verified;
            idDocumentComment = documents.idDocument.adminComment;
          }
        }
        if (documents?.backgroundCheck) {
          if (typeof documents.backgroundCheck === 'string') {
            backgroundCheckUrl = documents.backgroundCheck;
          } else {
            backgroundCheckUrl = documents.backgroundCheck.url;
            backgroundCheckVerified = documents.backgroundCheck.verified;
            backgroundCheckComment = documents.backgroundCheck.adminComment;
          }
        }
        if (documents?.qualificationDocument) {
          if (typeof documents.qualificationDocument === 'string') {
            qualificationDocumentUrl = documents.qualificationDocument;
          } else {
            qualificationDocumentUrl = documents.qualificationDocument.url;
            qualificationDocumentVerified = documents.qualificationDocument.verified;
            qualificationDocumentComment = documents.qualificationDocument.adminComment;
          }
        }
        if (documents?.certifications) {
          certifications = documents.certifications.map((cert: any) => ({
            name: cert.name,
            url: typeof cert.url === 'string' ? cert.url : cert.url?.url || cert.url,
            issuedDate: new Date(cert.issuedDate),
            expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined,
            verified: cert.verified !== undefined ? cert.verified : false,
            adminComment: cert.adminComment || null,
          }));
        }

        // Convert paths to full URLs if they're not already URLs
        if (idDocumentUrl && !idDocumentUrl.startsWith('http')) {
          const urlResult = await getFileUrl(idDocumentUrl);
          if (urlResult.success) idDocumentUrl = urlResult.data;
        }
        if (backgroundCheckUrl && !backgroundCheckUrl.startsWith('http')) {
          const urlResult = await getFileUrl(backgroundCheckUrl);
          if (urlResult.success) backgroundCheckUrl = urlResult.data;
        }
        if (qualificationDocumentUrl && !qualificationDocumentUrl.startsWith('http')) {
          const urlResult = await getFileUrl(qualificationDocumentUrl);
          if (urlResult.success) qualificationDocumentUrl = urlResult.data;
        }
        if (certifications) {
          for (let i = 0; i < certifications.length; i++) {
            if (certifications[i].url && !certifications[i].url.startsWith('http')) {
              const urlResult = await getFileUrl(certifications[i].url);
              if (urlResult.success) certifications[i].url = urlResult.data;
            }
          }
        }

        // Get sitter info
        const sitter = (row as any).sitter;
        const fullName = sitter?.display_name || sitter?.email || 'Unknown Sitter';

        return {
          id: row.id,
          sitterId: row.sitter_id,
          fullName,
          status: row.status,
          submittedAt: new Date(row.created_at),
          reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
          reviewedBy: row.reviewed_by,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          idDocumentUrl,
          idDocumentVerified,
          idDocumentComment,
          backgroundCheckUrl,
          backgroundCheckVerified,
          backgroundCheckComment,
          qualificationDocumentUrl,
          qualificationDocumentVerified,
          qualificationDocumentComment,
          certifications,
          rejectionReason: row.admin_notes || undefined, // Show admin notes for both approved and rejected
          bio: documents?.bio,
          qualifications: row.qualifications_text ? row.qualifications_text.split('; ') : (documents?.qualifications || undefined),
          hourlyRate: documents?.hourlyRate,
        } as VerificationRequest;
      })
    );

    return { success: true, data: requests };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Update verification status (admin only)
 */
export async function updateVerificationStatus(
  requestId: string,
  status: 'approved' | 'rejected' | 'under_review',
  reviewedBy: string,
  adminComment?: string
): Promise<ServiceResult<void>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    // Get the request to update sitter's user profile
    const { data: requestData, error: fetchError } = await supabase
      .from('verification_requests')
      .select('sitter_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !requestData) {
      return {
        success: false,
        error: {
          code: ErrorCode.DOCUMENT_NOT_FOUND,
          message: 'Verification request not found',
        },
      };
    }

    const sitterId = requestData.sitter_id;

    // Update verification request
    const verUpdateRes = await executeWrite(() => supabase
      .from('verification_requests')
      .update({
        status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminComment || (status === 'rejected' ? 'Verification rejected' : null),
      })
      .eq('id', requestId), 'verification_update');

    const updateError = verUpdateRes.error;

    if (updateError) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to update verification: ${updateError.message || JSON.stringify(updateError)}`,
        },
      };
    }

    // Update sitter's user profile
    const userUpdateRes = await executeWrite(() => supabase
      .from('users')
      .update({
        is_verified: status === 'approved',
        verification_status: status === 'approved' ? 'approved' : 'rejected',
      })
      .eq('id', sitterId), 'user_verification_update');

    const userUpdateError = userUpdateRes.error;
    if (userUpdateError) {
      console.warn('⚠️ Failed to update user profile:', userUpdateError.message || JSON.stringify(userUpdateError));
      // Don't fail the whole operation if user update fails
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Verify or reject an individual document (admin only)
 */
export async function verifyDocument(
  requestId: string,
  documentType: 'idDocument' | 'backgroundCheck' | 'qualificationDocument' | 'certification',
  verified: boolean,
  adminComment?: string,
  certificationIndex?: number
): Promise<ServiceResult<void>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

    // Get current documents
    const { data: requestData, error: fetchError } = await supabase
      .from('verification_requests')
      .select('documents')
      .eq('id', requestId)
      .single();

    if (fetchError || !requestData) {
      return {
        success: false,
        error: {
          code: ErrorCode.DOCUMENT_NOT_FOUND,
          message: 'Verification request not found',
        },
      };
    }

    const documents = requestData.documents 
      ? (typeof requestData.documents === 'string' ? JSON.parse(requestData.documents) : requestData.documents)
      : {};

    // Update the specific document's verification status
    if (documentType === 'certification' && certificationIndex !== undefined) {
      if (!documents.certifications || !documents.certifications[certificationIndex]) {
        return {
          success: false,
          error: {
            code: ErrorCode.DOCUMENT_NOT_FOUND,
            message: 'Certification not found',
          },
        };
      }
      documents.certifications[certificationIndex].verified = verified;
      documents.certifications[certificationIndex].adminComment = adminComment || null;
    } else {
      // Handle idDocument, backgroundCheck, or qualificationDocument
      if (!documents[documentType]) {
        return {
          success: false,
          error: {
            code: ErrorCode.DOCUMENT_NOT_FOUND,
            message: 'Document not found',
          },
        };
      }
      
      // Handle both old format (string) and new format (object)
      if (typeof documents[documentType] === 'string') {
        documents[documentType] = {
          url: documents[documentType],
          verified,
          adminComment: adminComment || null,
        };
      } else {
        documents[documentType].verified = verified;
        documents[documentType].adminComment = adminComment || null;
      }
    }

    // Update the documents JSON
    const updateRes = await executeWrite(() => supabase
      .from('verification_requests')
      .update({
        documents: JSON.stringify(documents),
        updated_at: new Date().toISOString(), // Ensure updated_at is refreshed
      })
      .eq('id', requestId), 'document_verification_update');

    if (updateRes.error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to update document verification: ${updateRes.error.message || JSON.stringify(updateRes.error)}`,
        },
      };
    }

    // Check if all documents are verified and update overall status if needed
    const allDocumentsVerified = 
      (!documents.idDocument || (documents.idDocument.verified === true)) &&
      (!documents.backgroundCheck || (documents.backgroundCheck.verified === true)) &&
      (!documents.qualificationDocument || (documents.qualificationDocument.verified === true)) &&
      (!documents.certifications || documents.certifications.every((cert: any) => cert.verified === true));

    const anyDocumentRejected = 
      (documents.idDocument && documents.idDocument.verified === false) ||
      (documents.backgroundCheck && documents.backgroundCheck.verified === false) ||
      (documents.qualificationDocument && documents.qualificationDocument.verified === false) ||
      (documents.certifications && documents.certifications.some((cert: any) => cert.verified === false));

    // Get current request status
    const { data: currentRequest } = await supabase
      .from('verification_requests')
      .select('status, sitter_id')
      .eq('id', requestId)
      .single();

    if (currentRequest) {
      // Update overall status based on document verification
      let newStatus = currentRequest.status;
      if (allDocumentsVerified && currentRequest.status === 'pending') {
        newStatus = 'under_review'; // Move to under_review when all docs verified
      } else if (anyDocumentRejected && currentRequest.status !== 'rejected') {
        // Keep current status but mark for review
        // Admin can still approve/reject overall
      }

      // Update status if changed
      if (newStatus !== currentRequest.status) {
        await executeWrite(() => supabase
          .from('verification_requests')
          .update({ status: newStatus })
          .eq('id', requestId), 'verification_status_update');
      }
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
