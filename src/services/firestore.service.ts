import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/src/config/firebase';
import { ServiceResult, AppError } from '@/src/types/error.types';
import {
  handleFirestoreError,
  handleUnexpectedError,
  retryWithBackoff,
} from '@/src/utils/errorHandler';

/**
 * Generic function to convert Firestore timestamps to Date objects
 */
function convertTimestamps(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (data instanceof Timestamp) {
    return data.toDate();
  }

  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }

  const converted: any = {};
  for (const key in data) {
    if (data[key] instanceof Timestamp) {
      converted[key] = data[key].toDate();
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      converted[key] = convertTimestamps(data[key]);
    } else {
      converted[key] = data[key];
    }
  }
  return converted;
}

/**
 * Get a single document by ID
 */
export async function getDocument<T = DocumentData>(
  collectionName: string,
  documentId: string
): Promise<ServiceResult<T>> {
  try {
    if (!firestore) {
      return {
        success: false,
        error: {
          code: 'FIREBASE_NOT_CONFIGURED' as any,
          message: 'Firestore is not configured',
        },
      };
    }

    const docRef = doc(firestore, collectionName, documentId);
    const docSnap = await retryWithBackoff(() => getDoc(docRef));

    if (!docSnap.exists()) {
      return {
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND' as any,
          message: 'Document not found',
        },
      };
    }

    const data = convertTimestamps({ id: docSnap.id, ...docSnap.data() });
    return { success: true, data: data as T };
  } catch (error: any) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Get all documents from a collection
 */
export async function getCollection<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<ServiceResult<T[]>> {
  try {
    if (!firestore) {
      return {
        success: false,
        error: {
          code: 'FIREBASE_NOT_CONFIGURED' as any,
          message: 'Firestore is not configured',
        },
      };
    }

    const collectionRef = collection(firestore, collectionName);
    const q = query(collectionRef, ...constraints);
    const querySnapshot = await retryWithBackoff(() => getDocs(q));

    const documents: T[] = [];
    querySnapshot.forEach((docSnap) => {
      documents.push(
        convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as T
      );
    });

    return { success: true, data: documents };
  } catch (error: any) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Create or update a document
 */
export async function setDocument<T = DocumentData>(
  collectionName: string,
  documentId: string,
  data: Partial<T>
): Promise<ServiceResult<void>> {
  try {
    const docRef = doc(firestore, collectionName, documentId);
    await retryWithBackoff(() => setDoc(docRef, data, { merge: true }));
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Update a document
 */
export async function updateDocument(
  collectionName: string,
  documentId: string,
  updates: Partial<DocumentData>
): Promise<ServiceResult<void>> {
  try {
    const docRef = doc(firestore, collectionName, documentId);
    await retryWithBackoff(() => updateDoc(docRef, updates));
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(
  collectionName: string,
  documentId: string
): Promise<ServiceResult<void>> {
  try {
    const docRef = doc(firestore, collectionName, documentId);
    await retryWithBackoff(() => deleteDoc(docRef));
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Subscribe to real-time updates for a document
 */
export function subscribeToDocument<T = DocumentData>(
  collectionName: string,
  documentId: string,
  callback: (result: ServiceResult<T>) => void
): () => void {
  const docRef = doc(firestore, collectionName, documentId);

  const unsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = convertTimestamps({ id: docSnap.id, ...docSnap.data() });
        callback({ success: true, data: data as T });
      } else {
        callback({
          success: false,
          error: {
            code: 'DOCUMENT_NOT_FOUND' as any,
            message: 'Document not found',
          },
        });
      }
    },
    (error) => {
      callback({
        success: false,
        error: handleFirestoreError(error),
      });
    }
  );

  return unsubscribe;
}

/**
 * Subscribe to real-time updates for a collection
 */
export function subscribeToCollection<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[],
  callback: (result: ServiceResult<T[]>) => void
): () => void {
  const collectionRef = collection(firestore, collectionName);
  const q = query(collectionRef, ...constraints);

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const documents: T[] = [];
      querySnapshot.forEach((docSnap) => {
        documents.push(
          convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as T
        );
      });
      callback({ success: true, data: documents });
    },
    (error) => {
      callback({
        success: false,
        error: handleFirestoreError(error),
      });
    }
  );

  return unsubscribe;
}

// Export Firestore query helpers
export { where, orderBy, limit };
