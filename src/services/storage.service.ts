import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/src/config/firebase';
import { ServiceResult, AppError } from '@/src/types/error.types';
import {
  handleStorageError,
  handleUnexpectedError,
} from '@/src/utils/errorHandler';
import { ErrorCode } from '@/src/types/error.types';

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
 * Upload a file to Firebase Storage
 */
export async function uploadFile(
  path: string,
  file: Blob | Uint8Array | ArrayBuffer,
  contentType?: string,
  options: UploadOptions = {}
): Promise<ServiceResult<string>> {
  try {
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

    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = {
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            progress: snapshot.bytesTransferred / snapshot.totalBytes,
          };
          options.onProgress?.(progress);
        },
        (error) => {
          resolve({
            success: false,
            error: handleStorageError(error),
          });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ success: true, data: downloadURL });
          } catch (error: any) {
            resolve({
              success: false,
              error: handleUnexpectedError(error),
            });
          }
        }
      );
    });
  } catch (error: any) {
    return {
      success: false,
      error: handleStorageError(error),
    };
  }
}

/**
 * Delete a file from Firebase Storage
 */
export async function deleteFile(path: string): Promise<ServiceResult<void>> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleStorageError(error),
    };
  }
}

/**
 * Get download URL for a file
 */
export async function getFileUrl(path: string): Promise<ServiceResult<string>> {
  try {
    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);
    return { success: true, data: url };
  } catch (error: any) {
    return {
      success: false,
      error: handleStorageError(error),
    };
  }
}
