import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, firestore } from '@/src/config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ServiceResult, AppError } from '@/src/types/error.types';
import { User, UserRole, Language } from '@/src/types/user.types';
import { COLLECTIONS, LANGUAGES, USER_ROLES } from '@/src/config/constants';
import {
  handleAuthError,
  handleFirestoreError,
  handleUnexpectedError,
} from '@/src/utils/errorHandler';
import { ErrorCode } from '@/src/types/error.types';

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  preferredLanguage?: Language;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user
 */
export async function signUp(data: SignUpData): Promise<ServiceResult<FirebaseUser>> {
  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );
    const user = userCredential.user;

    // Create user profile in Firestore
    const userProfile: Omit<User, 'id'> = {
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      preferredLanguage: data.preferredLanguage || LANGUAGES.ENGLISH,
      createdAt: new Date(),
    };

    await setDoc(doc(firestore, COLLECTIONS.USERS, user.uid), userProfile);

    return { success: true, data: user };
  } catch (error: any) {
    return {
      success: false,
      error: handleAuthError(error),
    };
  }
}

/**
 * Sign in existing user
 */
export async function signIn(
  data: SignInData
): Promise<ServiceResult<FirebaseUser>> {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );
    return { success: true, data: userCredential.user };
  } catch (error: any) {
    return {
      success: false,
      error: handleAuthError(error),
    };
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<ServiceResult<void>> {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get current user profile from Firestore
 */
export async function getCurrentUserProfile(): Promise<ServiceResult<User>> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'No user is currently signed in',
        },
      };
    }

    const userDoc = await getDoc(doc(firestore, COLLECTIONS.USERS, currentUser.uid));
    
    if (!userDoc.exists()) {
      return {
        success: false,
        error: {
          code: ErrorCode.DOCUMENT_NOT_FOUND,
          message: 'User profile not found',
        },
      };
    }

    const userData = userDoc.data();
    const user: User = {
      id: currentUser.uid,
      ...userData,
      createdAt: userData.createdAt?.toDate() || new Date(),
    } as User;

    return { success: true, data: user };
  } catch (error: any) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  updates: Partial<Omit<User, 'id' | 'createdAt'>>
): Promise<ServiceResult<void>> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTH_ERROR,
          message: 'No user is currently signed in',
        },
      };
    }

    await setDoc(
      doc(firestore, COLLECTIONS.USERS, currentUser.uid),
      updates,
      { merge: true }
    );

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}
