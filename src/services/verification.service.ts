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
  fullName: string;
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
 * Check if sitter has existing verified ID and background check
 */
async function hasVerifiedMandatoryDocs(sitterId: string): Promise<{ hasVerified: boolean; existingRequest: any }> {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('documents, status')
    .eq('sitter_id', sitterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return { hasVerified: false, existingRequest: null };
  }

  const documents = data.documents 
    ? (typeof data.documents === 'string' ? JSON.parse(data.documents) : data.documents)
    : {};

  const idVerified = documents.idDocument?.verified === true;
  const bgVerified = documents.backgroundCheck?.verified === true;

  return {
    hasVerified: idVerified && bgVerified,
    existingRequest: data,
  };
}

/**
 * Create or update verification request
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

    // Check for existing verification request
    const { data: existingRequests, error: checkError } = await supabase
      .from('verification_requests')
      .select('id, status, documents')
      .eq('sitter_id', requestData.sitterId)
      .order('created_at', { ascending: false })
      .limit(1);

    const existingRequest = existingRequests && existingRequests.length > 0 ? existingRequests[0] : null;
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('⚠️ Error checking for existing verification request:', checkError);
    }

    // Build documents JSON with verification structure
    const documentsObj: any = {};
    
    // Get existing documents if updating
    let existingDocuments: any = {};
    if (existingRequest?.documents) {
      existingDocuments = typeof existingRequest.documents === 'string' 
        ? JSON.parse(existingRequest.documents) 
        : existingRequest.documents;
    }

    // Check if ID and background check are already verified
    const { hasVerified } = await hasVerifiedMandatoryDocs(requestData.sitterId);

    // Handle ID Document
    if (requestData.idDocumentUrl) {
      // If updating and ID was already verified, preserve verification status
      if (hasVerified && existingDocuments.idDocument?.verified === true) {
        documentsObj.idDocument = {
          url: requestData.idDocumentUrl, // Update URL if changed
          verified: true,
          adminComment: existingDocuments.idDocument.adminComment || null,
        };
      } else {
        // New submission or not verified yet - don't set verified, leave undefined for "Pending"
        documentsObj.idDocument = {
          url: requestData.idDocumentUrl,
          adminComment: null,
        };
      }
    } else if (existingDocuments.idDocument) {
      // Preserve existing ID document if not being updated
      documentsObj.idDocument = existingDocuments.idDocument;
    }

    // Handle Background Check
    if (requestData.backgroundCheckUrl) {
      // If updating and background check was already verified, preserve verification status
      if (hasVerified && existingDocuments.backgroundCheck?.verified === true) {
        documentsObj.backgroundCheck = {
          url: requestData.backgroundCheckUrl, // Update URL if changed
          verified: true,
          adminComment: existingDocuments.backgroundCheck.adminComment || null,
        };
      } else {
        // New submission or not verified yet - don't set verified, leave undefined for "Pending"
        documentsObj.backgroundCheck = {
          url: requestData.backgroundCheckUrl,
          adminComment: null,
        };
      }
    } else if (existingDocuments.backgroundCheck) {
      // Preserve existing background check if not being updated
      documentsObj.backgroundCheck = existingDocuments.backgroundCheck;
    }

    // Handle Qualification Document
    if (requestData.qualificationDocumentUrl) {
      // If updating, preserve verification status if exists
      if (existingDocuments.qualificationDocument?.verified !== undefined) {
        documentsObj.qualificationDocument = {
          url: requestData.qualificationDocumentUrl,
          verified: existingDocuments.qualificationDocument.verified,
          adminComment: existingDocuments.qualificationDocument.adminComment || null,
        };
      } else {
        // New qualification document - don't set verified, leave undefined for "Pending"
        documentsObj.qualificationDocument = {
          url: requestData.qualificationDocumentUrl,
          adminComment: null,
        };
      }
    } else if (existingDocuments.qualificationDocument) {
      documentsObj.qualificationDocument = existingDocuments.qualificationDocument;
    }

    // Handle Certifications - merge new with existing, preserve verification status
    const existingCerts = existingDocuments.certifications || [];
    const newCerts = requestData.certifications || [];
    
    // Create a map of existing certifications by name for quick lookup
    const existingCertsMap = new Map(
      existingCerts.map((cert: any) => [cert.name?.toLowerCase().trim(), cert])
    );

    // Start with existing certifications
    const mergedCerts = [...existingCerts];

    // Process new certifications - update existing or add new ones
    newCerts.forEach((newCert) => {
      const certKey = newCert.name?.toLowerCase().trim();
      const existingCert = existingCertsMap.get(certKey);
      
      if (existingCert) {
        // Update existing certification - preserve verification status if verified/rejected
        const existingIndex = mergedCerts.findIndex((c: any) => c.name?.toLowerCase().trim() === certKey);
        if (existingIndex >= 0) {
          // If verified or rejected, preserve status; otherwise update to pending (new submission)
          if (existingCert.verified === true || existingCert.verified === false) {
            // Keep existing verification status and comment
            mergedCerts[existingIndex] = {
              ...existingCert,
              url: newCert.url, // Update URL if changed
              issuedDate: newCert.issuedDate.toISOString(),
              expiryDate: newCert.expiryDate?.toISOString(),
            };
          } else {
            // Was pending, update with new submission
            mergedCerts[existingIndex] = {
              name: newCert.name,
              url: newCert.url,
              issuedDate: newCert.issuedDate.toISOString(),
              expiryDate: newCert.expiryDate?.toISOString(),
              adminComment: null,
            };
          }
        }
      } else {
        // New certification - add to list
        mergedCerts.push({
          name: newCert.name,
          url: newCert.url,
          issuedDate: newCert.issuedDate.toISOString(),
          expiryDate: newCert.expiryDate?.toISOString(),
          adminComment: null,
        });
      }
    });

    if (mergedCerts.length > 0) {
      documentsObj.certifications = mergedCerts;
    }

    // Store bio and hourlyRate (update if provided, otherwise preserve existing)
    documentsObj.bio = requestData.bio || existingDocuments.bio;
    documentsObj.hourlyRate = requestData.hourlyRate || existingDocuments.hourlyRate;
    
    // Merge qualifications - append new ones to existing, avoid duplicates
    const existingQuals = existingDocuments.qualifications || [];
    const newQuals = requestData.qualifications || [];
    
    // Combine and deduplicate qualifications
    const allQuals = [...existingQuals];
    newQuals.forEach((newQual: string) => {
      if (!allQuals.includes(newQual.trim())) {
        allQuals.push(newQual.trim());
      }
    });
    
    if (allQuals.length > 0) {
      documentsObj.qualifications = allQuals;
    }

    let data: any;
    let error: any;

    if (existingRequest) {
      console.log('🔄 Updating existing verification request:', existingRequest.id);
      
      // Check if new documents were added
      const hasNewDocuments = 
        (requestData.idDocumentUrl && !existingDocuments.idDocument) ||
        (requestData.backgroundCheckUrl && !existingDocuments.backgroundCheck) ||
        (requestData.qualificationDocumentUrl && !existingDocuments.qualificationDocument) ||
        (requestData.certifications && requestData.certifications.some((nc: any) => {
          const existingCert = (existingDocuments.certifications || []).find((ec: any) => 
            ec.name?.toLowerCase().trim() === nc.name?.toLowerCase().trim()
          );
          return !existingCert;
        }));
      
      // Determine new status
      let newStatus = existingRequest.status;
      
      // If new documents were added or status was rejected, reset to pending for admin review
      if (hasNewDocuments || newStatus === 'rejected') {
        newStatus = 'pending';
        console.log('📝 New documents added or was rejected - setting status to pending for admin review');
      }
      // If all documents are verified and no new documents, move to under_review
      else if (newStatus === 'pending') {
        const allVerified = 
          (!documentsObj.idDocument || documentsObj.idDocument.verified === true) &&
          (!documentsObj.backgroundCheck || documentsObj.backgroundCheck.verified === true) &&
          (!documentsObj.qualificationDocument || documentsObj.qualificationDocument.verified === true) &&
          (!documentsObj.certifications || documentsObj.certifications.every((c: any) => c.verified === true));
        
        if (allVerified && (documentsObj.idDocument || documentsObj.backgroundCheck)) {
          newStatus = 'under_review';
        }
      }

      // Update existing request
      const updateRes = await executeWrite(() => supabase
        .from('verification_requests')
        .update({
          status: newStatus,
          documents: JSON.stringify(documentsObj),
          qualifications_text: documentsObj.qualifications && documentsObj.qualifications.length > 0 
            ? documentsObj.qualifications.join('; ') 
            : (existingRequest.qualifications_text || null),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRequest.id)
        .select()
        .single(), 'verification_update');

      data = updateRes.data;
      error = updateRes.error;
      
      if (error) {
        console.error('❌ Error updating verification request:', error);
      } else {
        console.log('✅ Successfully updated verification request');
      }
    } else {
      console.log('➕ Creating new verification request for sitter:', requestData.sitterId);
      
      // Create new request
      const insertRes = await executeWrite(() => supabase
        .from('verification_requests')
        .insert({
          sitter_id: requestData.sitterId,
          status: 'pending',
          documents: JSON.stringify(documentsObj),
          qualifications_text: requestData.qualifications && requestData.qualifications.length > 0 
            ? requestData.qualifications.join('; ') 
            : null,
          admin_notes: null,
          reviewed_by: null,
          reviewed_at: null,
        })
        .select()
        .single(), 'verification_insert');

      data = insertRes.data;
      error = insertRes.error;
      
      if (error) {
        console.error('❌ Error creating verification request:', error);
      } else {
        console.log('✅ Successfully created verification request');
      }
    }

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to create/update verification request: ${error.message || JSON.stringify(error)}`,
        },
      };
    }

    // Parse and return the created/updated request
    const documents = data.documents 
      ? (typeof data.documents === 'string' ? JSON.parse(data.documents) : data.documents)
      : {};

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
      idDocumentUrl: documents.idDocument?.url,
      idDocumentVerified: documents.idDocument?.verified,
      idDocumentComment: documents.idDocument?.adminComment,
      backgroundCheckUrl: documents.backgroundCheck?.url,
      backgroundCheckVerified: documents.backgroundCheck?.verified,
      backgroundCheckComment: documents.backgroundCheck?.adminComment,
      qualificationDocumentUrl: documents.qualificationDocument?.url,
      qualificationDocumentVerified: documents.qualificationDocument?.verified,
      qualificationDocumentComment: documents.qualificationDocument?.adminComment,
      certifications: documents.certifications?.map((cert: any) => ({
        name: cert.name,
        url: cert.url,
        issuedDate: new Date(cert.issuedDate),
        expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined,
        verified: cert.verified,
        adminComment: cert.adminComment,
      })),
      rejectionReason: data.admin_notes || undefined, // Show admin comment for both approved and rejected
      bio: documents.bio,
      qualifications: data.qualifications_text ? data.qualifications_text.split('; ') : (documents.qualifications || undefined),
      hourlyRate: documents.hourlyRate,
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

    const documents = data.documents 
      ? (typeof data.documents === 'string' ? JSON.parse(data.documents) : data.documents)
      : {};

    // Convert document paths to full URLs
    let idDocumentUrl = documents.idDocument?.url;
    let backgroundCheckUrl = documents.backgroundCheck?.url;
    let qualificationDocumentUrl = documents.qualificationDocument?.url;

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

    // Process certifications
    let certifications;
    if (documents.certifications && Array.isArray(documents.certifications)) {
      certifications = await Promise.all(
        documents.certifications.map(async (cert: any) => {
          let certUrl = cert.url;
          if (certUrl && !certUrl.startsWith('http')) {
            const urlResult = await getFileUrl(certUrl);
            if (urlResult.success) certUrl = urlResult.data;
          }
          return {
            name: cert.name,
            url: certUrl,
            issuedDate: new Date(cert.issuedDate),
            expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined,
            verified: cert.verified !== undefined ? cert.verified : undefined, // Don't default to false
            adminComment: cert.adminComment || null,
          };
        })
      );
    }

    // Get sitter's full name
    const { data: sitterData } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', sitterId)
      .single();

    const request: VerificationRequest = {
      id: data.id,
      sitterId: data.sitter_id,
      status: data.status,
      submittedAt: new Date(data.created_at),
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      reviewedBy: data.reviewed_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      fullName: sitterData?.display_name || sitterData?.email || 'Unknown',
      idDocumentUrl,
      idDocumentVerified: documents.idDocument?.verified,
      idDocumentComment: documents.idDocument?.adminComment,
      backgroundCheckUrl,
      backgroundCheckVerified: documents.backgroundCheck?.verified,
      backgroundCheckComment: documents.backgroundCheck?.adminComment,
      qualificationDocumentUrl,
      qualificationDocumentVerified: documents.qualificationDocument?.verified,
      qualificationDocumentComment: documents.qualificationDocument?.adminComment,
      certifications,
      rejectionReason: data.admin_notes || undefined, // Show admin comment for both approved and rejected
      bio: documents.bio,
      qualifications: data.qualifications_text ? data.qualifications_text.split('; ') : (documents.qualifications || undefined),
      hourlyRate: documents.hourlyRate,
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
      .in('status', ['pending', 'under_review'])
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

    const requests: VerificationRequest[] = await Promise.all(
      (data || []).map(async (row: any) => {
        const documents = row.documents 
          ? (typeof row.documents === 'string' ? JSON.parse(row.documents) : row.documents)
          : {};

        // Convert document paths to full URLs
        let idDocumentUrl = documents.idDocument?.url;
        let backgroundCheckUrl = documents.backgroundCheck?.url;
        let qualificationDocumentUrl = documents.qualificationDocument?.url;

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

        // Process certifications
        let certifications;
        if (documents.certifications && Array.isArray(documents.certifications)) {
          certifications = await Promise.all(
            documents.certifications.map(async (cert: any) => {
              let certUrl = cert.url;
              if (certUrl && !certUrl.startsWith('http')) {
                const urlResult = await getFileUrl(certUrl);
                if (urlResult.success) certUrl = urlResult.data;
              }
              return {
                name: cert.name,
                url: certUrl,
                issuedDate: new Date(cert.issuedDate),
                expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined,
                verified: cert.verified !== undefined ? cert.verified : undefined,
                adminComment: cert.adminComment || null,
              };
            })
          );
        }

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
          idDocumentVerified: documents.idDocument?.verified,
          idDocumentComment: documents.idDocument?.adminComment,
          backgroundCheckUrl,
          backgroundCheckVerified: documents.backgroundCheck?.verified,
          backgroundCheckComment: documents.backgroundCheck?.adminComment,
          qualificationDocumentUrl,
          qualificationDocumentVerified: documents.qualificationDocument?.verified,
          qualificationDocumentComment: documents.qualificationDocument?.adminComment,
          certifications,
          rejectionReason: row.admin_notes || undefined, // Show admin comment for both approved and rejected
          bio: documents.bio,
          qualifications: row.qualifications_text ? row.qualifications_text.split('; ') : (documents.qualifications || undefined),
          hourlyRate: documents.hourlyRate,
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
        verification_status: status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending'),
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
    if (documentType === 'certification' && certificationIndex !== undefined && certificationIndex !== null) {
      if (!documents.certifications || !Array.isArray(documents.certifications)) {
        return {
          success: false,
          error: {
            code: ErrorCode.DOCUMENT_NOT_FOUND,
            message: 'Certifications array not found',
          },
        };
      }
      
      if (certificationIndex < 0 || certificationIndex >= documents.certifications.length) {
        return {
          success: false,
          error: {
            code: ErrorCode.DOCUMENT_NOT_FOUND,
            message: `Certification at index ${certificationIndex} not found`,
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
      
      documents[documentType].verified = verified;
      documents[documentType].adminComment = adminComment || null;
    }

    // Update the documents JSON
    const updateRes = await executeWrite(() => supabase
      .from('verification_requests')
      .update({
        documents: JSON.stringify(documents),
        updated_at: new Date().toISOString(),
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
      (!documents.idDocument || documents.idDocument.verified === true) &&
      (!documents.backgroundCheck || documents.backgroundCheck.verified === true) &&
      (!documents.qualificationDocument || documents.qualificationDocument.verified === true) &&
      (!documents.certifications || documents.certifications.every((cert: any) => cert.verified === true));

    const anyDocumentRejected = 
      (documents.idDocument && documents.idDocument.verified === false) ||
      (documents.backgroundCheck && documents.backgroundCheck.verified === false) ||
      (documents.qualificationDocument && documents.qualificationDocument.verified === false) ||
      (documents.certifications && documents.certifications.some((cert: any) => cert.verified === false));

    // Get current request status
    const { data: currentRequest } = await supabase
      .from('verification_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (currentRequest) {
      let newStatus = currentRequest.status;
      
      // If all documents verified and status is pending, move to under_review
      if (allDocumentsVerified && currentRequest.status === 'pending') {
        newStatus = 'under_review';
      }
      // If any document rejected and status is approved, keep approved (admin can override)
      // Status changes only happen when admin approves/rejects overall

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
