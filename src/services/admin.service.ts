/**
 * Admin Service
 * Handles admin-specific operations
 */
import { ServiceResult } from '@/src/types/error.types';
import { firestore } from '@/src/config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { handleFirestoreError, retryWithBackoff } from '@/src/utils/errorHandler';
import { COLLECTIONS, USER_ROLES } from '@/src/config/constants';
import { User } from '@/src/types/user.types';

/**
 * Get all users (admin only)
 */
export async function getAllUsers(
  role?: 'parent' | 'babysitter' | 'admin',
  limitCount: number = 100
): Promise<ServiceResult<User[]>> {
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

    let q = query(
      collection(firestore, COLLECTIONS.USERS),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    if (role) {
      q = query(q, where('role', '==', role));
    }

    const snapshot = await retryWithBackoff(async () => getDocs(q));
    const users: User[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
      } as User);
    });

    return { success: true, data: users };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get user by ID (admin only)
 */
export async function getUserById(userId: string): Promise<ServiceResult<User>> {
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

    const userRef = doc(firestore, COLLECTIONS.USERS, userId);
    const userSnap = await retryWithBackoff(async () => getDocs(query(collection(firestore, COLLECTIONS.USERS), where('__name__', '==', userId))));

    if (userSnap.empty) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      };
    }

    const data = userSnap.docs[0].data();
    return {
      success: true,
      data: {
        id: userSnap.docs[0].id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
      } as User,
    };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Update user (admin only)
 */
export async function updateUser(
  userId: string,
  updates: Partial<User>
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

    const userRef = doc(firestore, COLLECTIONS.USERS, userId);
    await retryWithBackoff(async () => {
      await updateDoc(userRef, {
        ...updates,
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

/**
 * Deactivate user (admin only)
 */
export async function deactivateUser(userId: string): Promise<ServiceResult<void>> {
  return updateUser(userId, { isActive: false } as any);
}

/**
 * Activate user (admin only)
 */
export async function activateUser(userId: string): Promise<ServiceResult<void>> {
  return updateUser(userId, { isActive: true } as any);
}

/**
 * Change user role (admin only)
 */
export async function changeUserRole(
  userId: string,
  newRole: 'parent' | 'babysitter' | 'admin'
): Promise<ServiceResult<void>> {
  return updateUser(userId, { role: newRole } as any);
}

/**
 * Get admin statistics
 */
export async function getAdminStats(): Promise<ServiceResult<{
  totalUsers: number;
  totalParents: number;
  totalSitters: number;
  totalAdmins: number;
  pendingVerifications: number;
  activeSessions: number;
}>> {
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

    // Get user counts
    // Note: Each user is counted only once based on their current role
    // If a user's role was changed (e.g., parent -> admin), they will only appear in the admin count
    const [allUsers, parents, sitters, admins] = await Promise.all([
      getDocs(query(collection(firestore, COLLECTIONS.USERS))),
      getDocs(query(collection(firestore, COLLECTIONS.USERS), where('role', '==', USER_ROLES.PARENT))),
      getDocs(query(collection(firestore, COLLECTIONS.USERS), where('role', '==', USER_ROLES.BABYSITTER))),
      getDocs(query(collection(firestore, COLLECTIONS.USERS), where('role', '==', USER_ROLES.ADMIN))),
    ]);

    // Get pending verifications
    const pendingVerifications = await getDocs(
      query(
        collection(firestore, 'verificationRequests'),
        where('status', '==', 'pending')
      )
    );

    // Get active sessions
    const activeSessions = await getDocs(
      query(
        collection(firestore, COLLECTIONS.SESSIONS),
        where('status', '==', 'active')
      )
    );

    return {
      success: true,
      data: {
        totalUsers: allUsers.size,
        totalParents: parents.size,
        totalSitters: sitters.size,
        totalAdmins: admins.size,
        pendingVerifications: pendingVerifications.size,
        activeSessions: activeSessions.size,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}
