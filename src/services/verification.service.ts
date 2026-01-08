/**
 * Verification Service - Supabase
 * Handles babysitter verification requests
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';

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
      .insert({
        sitter_id: requestData.sitterId,
        status: 'pending',
        documents: requestData.idDocumentUrl || requestData.backgroundCheckUrl 
          ? JSON.stringify({
              idDocument: requestData.idDocumentUrl,
              backgroundCheck: requestData.backgroundCheckUrl,
              certifications: requestData.certifications?.map(cert => ({
                name: cert.name,
                url: cert.url,
                issuedDate: cert.issuedDate.toISOString(),
                expiryDate: cert.expiryDate?.toISOString(),
              })),
            })
          : null,
        admin_notes: null,
        reviewed_by: null,
        reviewed_at: null,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to create verification request: ${error.message}`,
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

    const request: VerificationRequest = {
      id: data.id,
      sitterId: data.sitter_id,
      status: data.status,
      submittedAt: new Date(data.created_at),
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      reviewedBy: data.reviewed_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      idDocumentUrl: documents?.idDocument,
      backgroundCheckUrl: documents?.backgroundCheck,
      certifications: documents?.certifications?.map((cert: any) => ({
        name: cert.name,
        url: cert.url,
        issuedDate: new Date(cert.issuedDate),
        expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined,
      })),
      rejectionReason: data.admin_notes && data.status === 'rejected' ? data.admin_notes : undefined,
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
      .select('*')
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

    const requests: VerificationRequest[] = (data || []).map((row: any) => {
      const documents = row.documents ? (typeof row.documents === 'string' ? JSON.parse(row.documents) : row.documents) : null;
      return {
        id: row.id,
        sitterId: row.sitter_id,
        status: row.status,
        submittedAt: new Date(row.created_at),
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
        reviewedBy: row.reviewed_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        idDocumentUrl: documents?.idDocument,
        backgroundCheckUrl: documents?.backgroundCheck,
        certifications: documents?.certifications?.map((cert: any) => ({
          name: cert.name,
          url: cert.url,
          issuedDate: new Date(cert.issuedDate),
          expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined,
        })),
        rejectionReason: row.admin_notes && row.status === 'rejected' ? row.admin_notes : undefined,
      } as VerificationRequest;
    });

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
  status: 'approved' | 'rejected',
  reviewedBy: string,
  rejectionReason?: string
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
    const { error: updateError } = await supabase
      .from('verification_requests')
      .update({
        status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        admin_notes: status === 'rejected' ? rejectionReason : null,
      })
      .eq('id', requestId);

    if (updateError) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_UPDATE_ERROR,
          message: `Failed to update verification: ${updateError.message}`,
        },
      };
    }

    // Update sitter's user profile
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        is_verified: status === 'approved',
        verification_status: status === 'approved' ? 'approved' : 'rejected',
      })
      .eq('id', sitterId);

    if (userUpdateError) {
      console.warn('⚠️ Failed to update user profile:', userUpdateError.message);
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
