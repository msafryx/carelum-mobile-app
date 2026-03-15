/**
 * Storage Service - Supabase Storage
 * Handles file uploads and deletions
 */
import * as FileSystem from 'expo-file-system';
import { supabaseUrl as configSupabaseUrl, isSupabaseConfigured, supabase, supabaseAnonKey } from '@/src/config/supabase';
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

/** Bucket names used by the app */
export const STORAGE_BUCKETS = {
  PROFILE_IMAGES: 'profile-images',
  CHILD_IMAGES: 'child-images',
  CHAT_ATTACHMENTS: 'chat-attachments',
  VERIFICATION_DOCUMENTS: 'verification-documents',
  SESSION_AUDIO: 'session-audio',
} as const;

const BUCKET_PATH_PREFIXES: { prefix: RegExp; bucket: string }[] = [
  { prefix: /^(profileImages|profile-images)\//i, bucket: STORAGE_BUCKETS.PROFILE_IMAGES },
  { prefix: /^(childImages|child-images)\//i, bucket: STORAGE_BUCKETS.CHILD_IMAGES },
  { prefix: /^chat-attachments\//i, bucket: STORAGE_BUCKETS.CHAT_ATTACHMENTS },
  { prefix: /^(verificationDocuments|verification-documents)\//i, bucket: STORAGE_BUCKETS.VERIFICATION_DOCUMENTS },
  { prefix: /^audio\//i, bucket: STORAGE_BUCKETS.SESSION_AUDIO },
];

/**
 * Resolve storage bucket and file path from a logical path string.
 * Used by uploadFile, deleteFile, getFileUrl.
 */
function getBucketAndFilePath(path: string): { bucket: string; filePath: string } {
  for (const { prefix, bucket } of BUCKET_PATH_PREFIXES) {
    if (prefix.test(path)) {
      const filePath = path.replace(prefix, '');
      return { bucket, filePath };
    }
  }
  return { bucket: STORAGE_BUCKETS.PROFILE_IMAGES, filePath: path };
}

/**
 * Upload a file from a local URI (file:// or content://) to Supabase Storage.
 * Uses native FileSystem.uploadAsync so no Blob is used — fixes "Network request failed" on React Native.
 * Only supported for session-audio bucket.
 */
export async function uploadFileFromUri(
  path: string,
  fileUri: string,
  contentType?: string
): Promise<ServiceResult<string>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: ErrorCode.STORAGE_ERROR, message: 'Supabase is not configured' } };
    }
    const { bucket, filePath } = getBucketAndFilePath(path);
    if (bucket !== STORAGE_BUCKETS.SESSION_AUDIO) {
      return { success: false, error: { code: ErrorCode.STORAGE_ERROR, message: 'uploadFileFromUri only supports session-audio bucket' } };
    }

    let uriToUpload = fileUri;
    let tempPath: string | null = null;
    if (fileUri.startsWith('content://')) {
      const cache = FileSystem.cacheDirectory;
      if (!cache) return { success: false, error: { code: ErrorCode.STORAGE_ERROR, message: 'No cache directory' } };
      tempPath = `${cache}upload_${Date.now()}.m4a`;
      await FileSystem.copyAsync({ from: fileUri, to: tempPath });
      uriToUpload = tempPath;
    }

    const supabaseUrl = (supabase as any)?.supabaseUrl ?? configSupabaseUrl ?? '';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (tempPath) await FileSystem.deleteAsync(tempPath, { idempotent: true });
      return { success: false, error: { code: ErrorCode.STORAGE_ERROR, message: 'No session for upload' } };
    }
    const anonKey = supabaseAnonKey || (supabase as any)?.supabaseKey || '';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

    const result = await FileSystem.uploadAsync(uploadUrl, uriToUpload, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': 'true',
      },
    }).finally(() => {
      if (tempPath) FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    });

    if (result.status < 200 || result.status >= 300) {
      return {
        success: false,
        error: { code: ErrorCode.UPLOAD_FAILED, message: `Upload failed: ${result.status}` },
      };
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    if (!urlData?.publicUrl) {
      return { success: false, error: { code: ErrorCode.STORAGE_ERROR, message: 'Failed to get public URL' } };
    }
    return { success: true, data: urlData.publicUrl };
  } catch (e: any) {
    return { success: false, error: handleUnexpectedError(e) };
  }
}

/**
 * Test Storage connectivity before upload (non-blocking - just warns)
 */
async function testStorageConnectivity(bucket: string): Promise<void> {
  try {
    if (!supabase) {
      console.warn('⚠️ Supabase client not initialized');
      return;
    }

    // Test 0: Direct fetch test to Supabase Storage endpoint
    const supabaseUrl = (supabase as any)?.supabaseUrl || 
                       (supabase as any)?._supabaseUrl || 
                       (supabase as any)?.rest?.url ||
                       '';
    
    if (supabaseUrl) {
      try {
        const testUrl = `${supabaseUrl}/storage/v1/bucket`;
        console.log(`🔍 Testing direct Storage API access: ${testUrl.substring(0, 60)}...`);
        
        // Get session token for auth header
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = {
          'apikey': (supabase as any)?.supabaseKey || '',
        };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        
        const fetchStart = Date.now();
        const response = await fetch(testUrl, {
          method: 'GET',
          headers,
        });
        const fetchDuration = Date.now() - fetchStart;
        
        console.log(`📡 Direct fetch test: ${response.status} ${response.statusText} (${fetchDuration}ms)`);
        
        if (!response.ok && response.status !== 401 && response.status !== 403) {
          console.warn(`⚠️ Storage API returned ${response.status} - might indicate connectivity issues`);
        } else if (response.ok || response.status === 401 || response.status === 403) {
          console.log('✅ Direct fetch test: Storage API is reachable');
        }
      } catch (fetchError: any) {
        console.error('❌ Direct fetch test FAILED:', fetchError.message);
        console.error('   This indicates a network/fetch issue, not a bucket/policy issue');
        console.error('   Possible causes:');
        console.error('   1. React Native fetch polyfill not working');
        console.error('   2. Network connectivity issue');
        console.error('   3. CORS blocking (unlikely on mobile)');
        console.error('   4. Supabase Storage service down');
      }
    }

    // Test 1: Check if we can list buckets (this tests basic Storage API access)
    // NOTE: listBuckets() might fail due to permissions, but that doesn't mean upload will fail
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.warn('⚠️ Storage API test: Cannot list buckets:', bucketsError.message);
      console.warn('   This is likely a permissions issue with listBuckets(), not upload');
      console.warn('   Upload might still work - we will attempt it');
      // Don't return - continue to test bucket access directly
    } else {
      // Test 2: Check if our bucket exists in the list
      const bucketExists = buckets?.some(b => b.id === bucket);
      if (bucketExists) {
        console.log(`✅ Bucket "${bucket}" exists in list`);
      } else {
        console.warn(`⚠️ Bucket "${bucket}" not found in listBuckets() result`);
        console.warn(`   Available buckets: ${buckets?.map(b => b.id).join(', ') || 'none'}`);
        console.warn('   But bucket might still exist - listBuckets() might have permission issues');
      }
    }
    
    // Test bucket access directly (more reliable than listBuckets)
    console.log(`🔍 Testing direct access to bucket "${bucket}"...`);
    const { data: testList, error: testError } = await supabase.storage.from(bucket).list('', { limit: 1 });
    
    if (testError) {
      if (testError.message?.includes('not found') || testError.message?.includes('does not exist')) {
        console.error(`❌ Bucket "${bucket}" does not exist:`, testError.message);
        console.error('   👉 Run STORAGE_SETUP.sql in Supabase SQL Editor');
      } else {
        console.warn(`⚠️ Cannot access bucket "${bucket}":`, testError.message);
        console.warn('   This might be a policy issue, but we will still attempt upload');
      }
    } else {
      console.log(`✅ Bucket "${bucket}" is accessible`);
    }

    // Test 3: Try to list files in the bucket (tests RLS policies)
    const { data: files, error: listError } = await supabase.storage.from(bucket).list('', { limit: 1 });
    
    if (listError) {
      console.warn('⚠️ Cannot list files in bucket (might be policy issue):', listError.message);
      console.warn('   This might indicate RLS policy problems, but we will still attempt upload');
    } else {
      console.log('✅ Storage connectivity test passed - bucket exists and is accessible');
    }
  } catch (error: any) {
    console.warn('⚠️ Storage connectivity test exception:', error.message);
    console.warn('   We will still attempt upload');
  }
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

    // Log Supabase URL for debugging
    const supabaseUrl = configSupabaseUrl || 'unknown';
    console.log(`🔗 Supabase URL: ${supabaseUrl !== 'unknown' ? supabaseUrl.substring(0, 50) + '...' : 'unknown'}`);

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

    const { bucket, filePath } = getBucketAndFilePath(path);

    console.log(`📤 Uploading to bucket: ${bucket}, path: ${filePath}`);
    console.log(`📦 File type: ${file instanceof Blob ? 'Blob' : file instanceof Uint8Array ? 'Uint8Array' : file instanceof ArrayBuffer ? 'ArrayBuffer' : typeof file}`);
    console.log(`📦 File size: ${file instanceof Blob ? file.size : file instanceof ArrayBuffer ? file.byteLength : 'unknown'} bytes`);

    // Test Storage connectivity first (non-blocking - just warns)
    console.log('🔍 Testing Storage connectivity...');
    await testStorageConnectivity(bucket);
    // Note: We don't block on connectivity test - let Supabase give us the real error

    // Ensure we have an active session before uploading
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('❌ No active session for storage upload:', sessionError);
      return {
        success: false,
        error: {
          code: ErrorCode.STORAGE_ERROR,
          message: 'Please log in to upload files. Please log out and log back in.',
        },
      };
    }

    console.log('✅ Session verified, proceeding with upload...');
    console.log(`🔑 User ID: ${session.user.id}`);

    // Ensure file is a Blob (Supabase Storage requires Blob)
    let fileToUpload: Blob;
    if (file instanceof Blob) {
      fileToUpload = file;
    } else if (file instanceof ArrayBuffer) {
      fileToUpload = new Blob([file], { type: contentType || 'image/jpeg' });
    } else if (file instanceof Uint8Array) {
      // Convert Uint8Array to ArrayBuffer for Blob
      const buffer = file.buffer instanceof ArrayBuffer 
        ? file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
        : new Uint8Array(file).buffer;
      fileToUpload = new Blob([buffer], { type: contentType || 'image/jpeg' });
    } else {
      console.error('❌ Invalid file type:', typeof file);
      return {
        success: false,
        error: {
          code: ErrorCode.STORAGE_ERROR,
          message: 'Invalid file type. Expected Blob, ArrayBuffer, or Uint8Array.',
        },
      };
    }

    // Build the Storage API URL for debugging
    const storageUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
    console.log(`🌐 Storage API endpoint: ${storageUrl.substring(0, 80)}...`);

    // Upload file with retry logic and detailed error capture
    let uploadError = null;
    let uploadData = null;
    let lastException: any = null;

    // On React Native, Supabase client upload often fails with "Network request failed" for Blob.
    // For session-audio, try direct fetch first to get a real HTTP response (200/403/415).
    const tryDirectFetchFirst = bucket === STORAGE_BUCKETS.SESSION_AUDIO;

    if (tryDirectFetchFirst) {
      try {
        const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
        console.log(`📡 [session-audio] Direct fetch upload to: ${uploadUrl.substring(0, 80)}...`);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session for direct upload');
        const anonKey = supabaseAnonKey || (supabase as any)?.supabaseKey || '';
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': contentType || 'application/octet-stream',
            'x-upsert': 'true',
          },
          body: fileToUpload,
        });
        if (response.ok) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            console.log('✅ [session-audio] Direct fetch upload successful');
            uploadData = { path: filePath };
            uploadError = null;
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ [session-audio] Direct fetch: ${response.status}`, errorText.substring(0, 150));
          uploadError = { message: `Upload failed: ${response.status}`, statusCode: response.status, error: errorText } as any;
        }
      } catch (directErr: any) {
        console.warn('⚠️ [session-audio] Direct fetch failed, will try Supabase client:', directErr?.message);
        uploadError = { message: directErr?.message || 'Direct fetch failed', statusCode: undefined, error: directErr } as any;
      }
    }

    // Try upload up to 2 times with Supabase client (when direct fetch didn't succeed)
    if (!uploadData) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🔄 Upload attempt ${attempt}/2 (Supabase client)...`);
        console.log(`📡 Making request to: ${bucket}/${filePath}`);
        
        // Capture the exact moment of the request
        const requestStartTime = Date.now();
        
        const result = await supabase.storage
      .from(bucket)
          .upload(filePath, fileToUpload, {
        contentType: contentType || 'image/jpeg',
        upsert: true, // Overwrite if exists
            cacheControl: '3600',
      });
        
        const requestDuration = Date.now() - requestStartTime;
        console.log(`⏱️ Request completed in ${requestDuration}ms`);
        
        uploadData = result.data;
        uploadError = result.error;
        
        if (!uploadError) {
          console.log('✅ Upload successful on attempt', attempt);
          break; // Success, exit retry loop
        }
        
        // Detailed error logging
        const errorDetails: any = {
          message: uploadError.message,
          name: (uploadError as any).name,
        };
        if ((uploadError as any).statusCode) errorDetails.statusCode = (uploadError as any).statusCode;
        if ((uploadError as any).statusText) errorDetails.statusText = (uploadError as any).statusText;
        if ((uploadError as any).error) errorDetails.error = (uploadError as any).error;
        if ((uploadError as any).stack) errorDetails.stack = (uploadError as any).stack?.substring(0, 200);
        
        console.error(`❌ Upload attempt ${attempt} failed:`, JSON.stringify(errorDetails, null, 2));
        
        // Check if it's a policy error (403) vs network error
        const statusCode = (uploadError as any).statusCode;
        if (statusCode === 403) {
          console.error('🚫 Permission denied (403) - This is a policy issue, not network');
          break; // Don't retry policy errors
        }
        
        // If it's a network error, wait and retry
        if (attempt < 2 && (uploadError.message?.includes('Network') || uploadError.message?.includes('fetch') || !statusCode)) {
          console.log(`⚠️ Network error detected, retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          continue;
        }
        
        break; // Exit on non-network errors or after max attempts
      } catch (err: any) {
        lastException = err;
        console.error(`❌ Upload attempt ${attempt} exception:`, {
          message: err.message,
          name: err.name,
          code: err.code,
          stack: err.stack?.substring(0, 300),
        });
        
        // Check if it's a network-level exception
        const isNetworkError = 
          err.message?.includes('Network') || 
          err.message?.includes('fetch') || 
          err.message?.includes('Failed to fetch') ||
          err.name === 'TypeError' ||
          err.code === 'NETWORK_ERROR';
        
        if (attempt < 2 && isNetworkError) {
          console.log(`⚠️ Network exception detected, retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        break;
      }
    }
    
    // If Supabase client upload failed with network error, try direct fetch as fallback
    const uploadErrorStatus = uploadError ? ((uploadError as any).statusCode as number | undefined) : undefined;
    if (uploadError && (!uploadErrorStatus || uploadError.message?.includes('Network'))) {
      console.log('🔄 Supabase client upload failed, trying direct fetch as fallback...');
      
      try {
        const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
        console.log(`📡 Direct fetch upload to: ${uploadUrl.substring(0, 80)}...`);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No session for direct upload');
        }
        
        // Get anon key from config
        const anonKey = supabaseAnonKey || (supabase as any)?.supabaseKey || '';
        
        const headers: HeadersInit = {
          'apikey': anonKey,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': contentType || 'image/jpeg',
          'x-upsert': 'true', // For upsert
        };
        
        const fetchStart = Date.now();
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers,
          body: fileToUpload,
        });
        const fetchDuration = Date.now() - fetchStart;
        
        console.log(`📡 Direct fetch upload: ${response.status} ${response.statusText} (${fetchDuration}ms)`);
        
        if (response.ok) {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);
          
          if (urlData?.publicUrl) {
            console.log('✅ Direct fetch upload successful!');
            uploadData = { path: filePath };
            uploadError = null;
          } else {
            throw new Error('Failed to get public URL after upload');
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ Direct fetch upload failed: ${response.status} ${response.statusText}`);
          console.error(`   Response: ${errorText.substring(0, 200)}`);
          throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }
      } catch (directFetchError: any) {
        console.error('❌ Direct fetch upload also failed:', directFetchError.message);
        // Keep the original error
        if (!uploadError) {
          uploadError = {
            message: directFetchError.message || 'Direct fetch upload failed',
            statusCode: undefined,
            error: directFetchError,
          };
        }
      }
    }
    } // end if (!uploadData)

    // If we have an exception but no error object, use the exception
    if (!uploadError && lastException) {
      uploadError = {
        message: lastException.message || 'Unknown error',
        statusCode: undefined,
        error: lastException,
      };
    }

    const { data, error } = { data: uploadData, error: uploadError };

    if (error) {
      const errorStatus = (error as any).statusCode;
      const errorError = (error as any).error;
      
      console.error('❌ Upload failed:', {
        message: error.message,
        statusCode: errorStatus,
        error: errorError,
        bucket,
        filePath,
      });
      
      // Provide more helpful error messages based on error type
      let errorMessage = error.message;
      
      // Check for specific Supabase Storage errors
      if (error.message?.includes('Bucket not found') || errorStatus === 404 || errorError === 'Bucket not found') {
        errorMessage = `Storage bucket "${bucket}" not found. Please create it in Supabase Dashboard → Storage. See SUPABASE_STORAGE_SETUP.md and run STORAGE_SESSION_AUDIO.sql for session-audio.`;
      } else if (error.message?.includes('new row violates row-level security policy') || errorStatus === 403 || errorError === 'new row violates row-level security policy') {
        errorMessage = 'Permission denied. Please set up Storage policies in Supabase. See SUPABASE_STORAGE_SETUP.md for instructions.';
      } else if (error.message?.includes('JWT') || error.message?.includes('token') || errorStatus === 401) {
        errorMessage = 'Authentication error. Please log out and log back in.';
      } else if (error.message?.includes('Network') || error.message?.includes('fetch') || error.message?.includes('Failed to fetch') || !errorStatus) {
        // Network error or undefined status - this is the critical case
        console.error('🚨 CRITICAL: Network request failed with no statusCode');
        console.error('🔍 This usually means:');
        console.error('   1. Request never reached Supabase (network/CORS issue)');
        console.error('   2. Storage API endpoint is unreachable');
        console.error('   3. React Native fetch polyfill issue');
        console.error('   4. Supabase Storage service is down');
        
        // Try to diagnose further
        try {
          const { error: testError } = await supabase.auth.getSession();
          if (testError) {
            errorMessage = 'Cannot connect to Supabase at all. Check:\n1. Internet connection\n2. Supabase project is active\n3. Supabase URL is correct';
          } else {
            // Auth works but Storage doesn't - this is Storage-specific
            errorMessage = 'Storage API is unreachable. This might be:\n1. Storage policies blocking the request\n2. Storage service configuration issue\n3. Network/CORS blocking Storage endpoint\n\nRun STORAGE_SETUP.sql to fix policies.';
          }
        } catch (testErr: any) {
          errorMessage = `Network error: ${testErr.message || 'Cannot reach Supabase'}. Check internet connection.`;
        }
      } else {
        // Generic error - might be bucket config
        errorMessage = `Upload failed: ${error.message || 'Unknown error'}. Please check Supabase Storage setup.`;
      }
      
      return {
        success: false,
        error: {
          code: ErrorCode.UPLOAD_FAILED,
          message: errorMessage,
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

    const { bucket, filePath } = getBucketAndFilePath(path);

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

    const { bucket, filePath } = getBucketAndFilePath(path);

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
