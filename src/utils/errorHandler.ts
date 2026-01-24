import { ErrorCode, AppError } from '@/src/types/error.types';

/**
 * Centralized error handling utility
 */

// User-friendly error messages
const errorMessages: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Please check your internet connection and try again.',
  [ErrorCode.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
  [ErrorCode.CONNECTION_ERROR]: 'Unable to connect to the server. Please check your connection.',
  
  [ErrorCode.AUTH_ERROR]: 'Authentication failed. Please try again.',
  [ErrorCode.INVALID_EMAIL]: 'Invalid email address.',
  [ErrorCode.INVALID_PASSWORD]: 'Invalid password.',
  [ErrorCode.USER_NOT_FOUND]: 'User not found.',
  [ErrorCode.EMAIL_ALREADY_EXISTS]: 'An account with this email already exists.',
  [ErrorCode.WEAK_PASSWORD]: 'Password is too weak. Please use a stronger password.',
  
  [ErrorCode.FIRESTORE_ERROR]: 'Unable to load data. Please try again.',
  [ErrorCode.DOCUMENT_NOT_FOUND]: 'Data not found.',
  [ErrorCode.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
  
  [ErrorCode.STORAGE_ERROR]: 'File operation failed. Please try again.',
  [ErrorCode.FILE_TOO_LARGE]: 'File is too large. Please choose a smaller file.',
  [ErrorCode.INVALID_FILE_TYPE]: 'Invalid file type. Please choose a different file.',
  [ErrorCode.UPLOAD_FAILED]: 'File upload failed. Please try again.',
  
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.REQUIRED_FIELD]: 'This field is required.',
  [ErrorCode.INVALID_FORMAT]: 'Invalid format. Please check your input.',
  
  [ErrorCode.API_ERROR]: 'An error occurred while processing your request.',
  [ErrorCode.SERVER_ERROR]: 'Server error. Please try again later.',
  [ErrorCode.BAD_REQUEST]: 'Invalid request. Please check your input.',
  
  [ErrorCode.LOCATION_ERROR]: 'Unable to get your location. Please try again.',
  [ErrorCode.LOCATION_PERMISSION_DENIED]: 'Location permission is required. Please enable it in settings.',
  [ErrorCode.LOCATION_UNAVAILABLE]: 'Location services are unavailable.',
  
  [ErrorCode.AUDIO_ERROR]: 'Audio operation failed. Please try again.',
  [ErrorCode.AUDIO_PERMISSION_DENIED]: 'Microphone permission is required. Please enable it in settings.',
  [ErrorCode.AUDIO_RECORDING_FAILED]: 'Failed to record audio. Please try again.',
  
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

/**
 * Create an AppError from various error sources
 */
export function createError(
  code: ErrorCode,
  originalError?: Error | any,
  customMessage?: string
): AppError {
  const message = customMessage || errorMessages[code] || errorMessages[ErrorCode.UNKNOWN_ERROR];
  
  return {
    code,
    message,
    details: originalError?.details || originalError?.message,
    originalError: originalError instanceof Error ? originalError : undefined,
  };
}

/**
 * Handle Firebase Auth errors
 */
export function handleAuthError(error: any): AppError {
  const errorCode = error?.code || '';
  
  switch (errorCode) {
    case 'auth/invalid-email':
      return createError(ErrorCode.INVALID_EMAIL, error);
    case 'auth/user-not-found':
      return createError(ErrorCode.USER_NOT_FOUND, error);
    case 'auth/wrong-password':
      return createError(ErrorCode.INVALID_PASSWORD, error);
    case 'auth/email-already-in-use':
      return createError(ErrorCode.EMAIL_ALREADY_EXISTS, error);
    case 'auth/weak-password':
      return createError(ErrorCode.WEAK_PASSWORD, error);
    case 'auth/network-request-failed':
      return createError(ErrorCode.NETWORK_ERROR, error);
    default:
      return createError(ErrorCode.AUTH_ERROR, error);
  }
}

/**
 * Handle Firestore errors
 */
export function handleFirestoreError(error: any): AppError {
  const errorCode = error?.code || '';
  
  switch (errorCode) {
    case 'permission-denied':
      return createError(ErrorCode.PERMISSION_DENIED, error);
    case 'not-found':
      return createError(ErrorCode.DOCUMENT_NOT_FOUND, error);
    case 'unavailable':
      return createError(ErrorCode.NETWORK_ERROR, error);
    default:
      return createError(ErrorCode.FIRESTORE_ERROR, error);
  }
}

/**
 * Handle Storage errors
 */
export function handleStorageError(error: any): AppError {
  const errorCode = error?.code || '';
  
  switch (errorCode) {
    case 'storage/unauthorized':
      return createError(ErrorCode.PERMISSION_DENIED, error);
    case 'storage/canceled':
      return createError(ErrorCode.UPLOAD_FAILED, error);
    case 'storage/unknown':
      return createError(ErrorCode.STORAGE_ERROR, error);
    default:
      return createError(ErrorCode.STORAGE_ERROR, error);
  }
}

/**
 * Handle network errors
 */
export function handleNetworkError(error: any): AppError {
  if (error?.message?.includes('timeout')) {
    return createError(ErrorCode.TIMEOUT_ERROR, error);
  }
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return createError(ErrorCode.NETWORK_ERROR, error);
  }
  return createError(ErrorCode.CONNECTION_ERROR, error);
}

/**
 * Handle API errors
 * Backend returns errors in format: { success: false, error: { code: string, message: string } }
 */
export function handleAPIError(error: any, statusCode?: number): AppError {
  // Extract error details from backend response format
  let errorCode: ErrorCode = ErrorCode.API_ERROR;
  let errorMessage: string | undefined;
  let errorDetails: any = error;

  // Check if error is in backend format: { success: false, error: { code, message } }
  if (error && typeof error === 'object') {
    if (error.error && typeof error.error === 'object') {
      // Backend error format
      const backendError = error.error;
      errorMessage = backendError.message;
      errorDetails = backendError;

      // Map backend error codes to frontend error codes
      const backendCode = backendError.code?.toUpperCase() || '';
      switch (backendCode) {
        case 'UNAUTHORIZED':
        case 'AUTH_ERROR':
          errorCode = ErrorCode.AUTH_ERROR;
          break;
        case 'FORBIDDEN':
        case 'PERMISSION_DENIED':
          errorCode = ErrorCode.PERMISSION_DENIED;
          break;
        case 'NOT_FOUND':
        case 'PROFILE_NOT_FOUND':
        case 'USER_NOT_FOUND':
        case 'SESSION_NOT_FOUND':
        case 'CHILD_NOT_FOUND':
          errorCode = ErrorCode.DOCUMENT_NOT_FOUND;
          break;
        case 'BAD_REQUEST':
        case 'INVALID_REQUEST':
        case 'INVALID_SCOPE':
        case 'INVALID_STATUS':
        case 'VALIDATION_ERROR':
          errorCode = ErrorCode.BAD_REQUEST;
          break;
        case 'CREATE_FAILED':
        case 'UPDATE_FAILED':
        case 'DB_NOT_AVAILABLE':
        case 'INTERNAL_SERVER_ERROR':
          errorCode = ErrorCode.SERVER_ERROR;
          break;
        default:
          // Use status code as fallback
          if (statusCode === 400) {
            errorCode = ErrorCode.BAD_REQUEST;
          } else if (statusCode === 401 || statusCode === 403) {
            errorCode = ErrorCode.AUTH_ERROR;
          } else if (statusCode === 404) {
            errorCode = ErrorCode.DOCUMENT_NOT_FOUND;
          } else if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
            errorCode = ErrorCode.SERVER_ERROR;
          }
      }
    } else if (error.message) {
      // Direct error object with message
      errorMessage = error.message;
    }
  }

  // Use extracted message or fallback to status-based message
  if (errorMessage) {
    return {
      code: errorCode,
      message: errorMessage,
      details: errorDetails,
      originalError: error,
    };
  }

  // Fallback to status code-based errors
  if (statusCode === 400) {
    return createError(ErrorCode.BAD_REQUEST, error);
  }
  if (statusCode === 401 || statusCode === 403) {
    return createError(ErrorCode.AUTH_ERROR, error);
  }
  if (statusCode === 404) {
    return createError(ErrorCode.DOCUMENT_NOT_FOUND, error);
  }
  if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    return createError(ErrorCode.SERVER_ERROR, error);
  }
  return createError(ErrorCode.API_ERROR, error);
}

/**
 * Handle unexpected errors
 */
export function handleUnexpectedError(error: any): AppError {
  if (error instanceof Error) {
    return createError(ErrorCode.UNKNOWN_ERROR, error, error.message);
  }
  return createError(ErrorCode.UNKNOWN_ERROR, error);
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
