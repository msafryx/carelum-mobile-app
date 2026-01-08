/**
 * Storage Service - Supabase Storage
 * Handles file uploads and deletions
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number; // 0-1
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  path: string,
  file: Blob | Uint8Array | ArrayBuffer,
  contentType?: string,
  options: UploadOptions = {}
): Promise<ServiceResult<string>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.STORAGE_ERROR,
          message: 'Supabase is not configured',
        },
      };
    }

    // Validate file size
    if (options.maxSize && file instanceof Blob && file.size > options.maxSize) {
      return {
        success: false,
        error: {
          code: ErrorCode.FILE_TOO_LARGE,
          message: `File size exceeds maximum allowed size of ${options.maxSize} bytes`,
        },
      };
    }

    // Determine bucket from path
    let bucket = 'profile-images';
    if (path.startsWith('childImages/')) {
      bucket = 'child-images';
    } else if (path.startsWith('chat-attachments/')) {
      bucket = 'chat-attachments';
    } else if (path.startsWith('verification-documents/')) {
      bucket = 'verification-documents';
    }

    // Extract file path (remove bucket prefix)
    const filePath = path.replace(/^(profile-images|child-images|chat-attachments|verification-documents)\//, '');

    console.log(`📤 Uploading to bucket: ${bucket}, path: ${filePath}`);

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: contentType || 'image/jpeg',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('❌ Upload failed:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.UPLOAD_FAILED,
          message: `Failed to upload file: ${error.message}`,
        },
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: {
          code: ErrorCode.STORAGE_ERROR,
          message: 'Failed to get file URL',
        },
      };
    }

    console.log('✅ File uploaded successfully:', urlData.publicUrl);
    return { success: true, data: urlData.publicUrl };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(path: string): Promise<ServiceResult<void>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.STORAGE_ERROR,
          message: 'Supabase is not configured',
        },
      };
    }

    // Determine bucket from path
    let bucket = 'profile-images';
    if (path.startsWith('childImages/') || path.includes('child-images')) {
      bucket = 'child-images';
    } else if (path.startsWith('chat-attachments/')) {
      bucket = 'chat-attachments';
    } else if (path.startsWith('verification-documents/')) {
      bucket = 'verification-documents';
    }

    // Extract file path
    const filePath = path.replace(/^(profile-images|child-images|chat-attachments|verification-documents)\//, '')
      .replace(/^childImages\//, '');

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.STORAGE_ERROR,
          message: `Failed to delete file: ${error.message}`,
        },
      };
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
 * Get public URL for a file
 */
export async function getFileUrl(path: string): Promise<ServiceResult<string>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.STORAGE_ERROR,
          message: 'Supabase is not configured',
        },
      };
    }

    // Determine bucket from path
    let bucket = 'profile-images';
    if (path.startsWith('childImages/') || path.includes('child-images')) {
      bucket = 'child-images';
    } else if (path.startsWith('chat-attachments/')) {
      bucket = 'chat-attachments';
    } else if (path.startsWith('verification-documents/')) {
      bucket = 'verification-documents';
    }

    // Extract file path
    const filePath = path.replace(/^(profile-images|child-images|chat-attachments|verification-documents)\//, '')
      .replace(/^childImages\//, '');

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      return {
        success: false,
        error: {
          code: ErrorCode.STORAGE_ERROR,
          message: 'Failed to get file URL',
        },
      };
    }

    return { success: true, data: data.publicUrl };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
