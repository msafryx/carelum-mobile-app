/**
 * Child Service
 * Handles child profile and instructions operations
 */
import { firestore } from '@/src/config/firebase';
import { Child, ChildInstructions } from '@/src/types/child.types';
import { ServiceResult } from '@/src/types/error.types';
import { handleFirestoreError, retryWithBackoff } from '@/src/utils/errorHandler';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    setDoc,
    Timestamp,
    where
} from 'firebase/firestore';

const CHILDREN_COLLECTION = 'children';
const INSTRUCTIONS_COLLECTION = 'childInstructions';

/**
 * Get all children for a parent
 */
export async function getParentChildren(
  parentId: string
): Promise<ServiceResult<Child[]>> {
  try {
    const q = query(
      collection(firestore!, CHILDREN_COLLECTION),
      where('parentId', '==', parentId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await retryWithBackoff(async () => getDocs(q));
    const children: Child[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      children.push({
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
        dateOfBirth: data.dateOfBirth ? (data.dateOfBirth as Timestamp)?.toDate() : undefined,
      } as Child);
    });

    return { success: true, data: children };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Create or update a child profile
 */
export async function saveChild(child: Child): Promise<ServiceResult<Child>> {
  try {
    const childRef = child.id
      ? doc(firestore!, CHILDREN_COLLECTION, child.id)
      : doc(collection(firestore!, CHILDREN_COLLECTION));

    const childData = {
      ...child,
      id: childRef.id,
      updatedAt: new Date(),
      createdAt: child.id ? child.createdAt : new Date(),
    };

    await retryWithBackoff(async () => {
      await setDoc(childRef, {
        ...childData,
        createdAt: Timestamp.fromDate(childData.createdAt),
        updatedAt: Timestamp.fromDate(childData.updatedAt),
        dateOfBirth: childData.dateOfBirth
          ? Timestamp.fromDate(childData.dateOfBirth)
          : null,
      });
    });

    return { success: true, data: childData };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Delete a child profile
 */
export async function deleteChild(childId: string): Promise<ServiceResult<void>> {
  try {
    const childRef = doc(firestore!, CHILDREN_COLLECTION, childId);
    await retryWithBackoff(async () => {
      await deleteDoc(childRef);
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
 * Get child instructions
 */
export async function getChildInstructions(
  childId: string
): Promise<ServiceResult<ChildInstructions | null>> {
  try {
    const q = query(
      collection(firestore!, INSTRUCTIONS_COLLECTION),
      where('childId', '==', childId),
      limit(1)
    );

    const snapshot = await retryWithBackoff(async () => getDocs(q));

    if (snapshot.empty) {
      return { success: true, data: null };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      success: true,
      data: {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
      } as ChildInstructions,
    };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}

/**
 * Save child instructions
 */
export async function saveChildInstructions(
  instructions: ChildInstructions
): Promise<ServiceResult<ChildInstructions>> {
  try {
    const instructionsRef = instructions.id
      ? doc(firestore!, INSTRUCTIONS_COLLECTION, instructions.id)
      : doc(collection(firestore!, INSTRUCTIONS_COLLECTION));

    // Create full text for chatbot RAG
    const instructionText = [
      instructions.feedingSchedule,
      instructions.napSchedule,
      instructions.bedtime,
      instructions.dietaryRestrictions,
      instructions.allergies?.join(', '),
      instructions.medications?.map(m => `${m.name} - ${m.dosage} at ${m.time}`).join(', '),
      instructions.specialNeeds,
      instructions.favoriteActivities?.join(', '),
      instructions.comfortItems?.join(', '),
      instructions.routines,
      instructions.additionalNotes,
    ]
      .filter(Boolean)
      .join('\n');

    const instructionsData = {
      ...instructions,
      id: instructionsRef.id,
      instructionText, // For RAG embedding
      updatedAt: new Date(),
      createdAt: instructions.id ? instructions.createdAt : new Date(),
    };

    await retryWithBackoff(async () => {
      await setDoc(instructionsRef, {
        ...instructionsData,
        createdAt: Timestamp.fromDate(instructionsData.createdAt),
        updatedAt: Timestamp.fromDate(instructionsData.updatedAt),
      });
    });

    return { success: true, data: instructionsData };
  } catch (error) {
    return {
      success: false,
      error: handleFirestoreError(error),
    };
  }
}
