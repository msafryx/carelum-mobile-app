/**
 * Child Service - Supabase
 * Handles child profile and instructions operations
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { Child, ChildInstructions } from '@/src/types/child.types';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { getNextChildNumber, getNextChildNumberFromLocal } from './child-number.service';

/**
 * Get all children for a parent - reads from AsyncStorage first (primary), then Supabase
 */
export async function getParentChildren(
  parentId: string
): Promise<ServiceResult<Child[]>> {
  try {
    // Try AsyncStorage first (primary storage, instant)
    try {
      const { getAll, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getAll(STORAGE_KEYS.CHILDREN);
      if (result.success && result.data) {
        const userChildren = result.data.filter((c: any) => c.parentId === parentId);
        if (userChildren.length > 0) {
          const children: Child[] = userChildren.map((c: any) => ({
            ...c,
            childNumber: c.childNumber,
            parentNumber: c.parentNumber,
            sitterNumber: c.sitterNumber,
            createdAt: new Date(c.createdAt || Date.now()),
            updatedAt: new Date(c.updatedAt || Date.now()),
            dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : undefined,
          }));
          console.log(`✅ Loaded ${children.length} children from AsyncStorage`);
          return { success: true, data: children };
        }
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to load from AsyncStorage, trying Supabase:', localError.message);
    }

    // Fallback to Supabase
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
      .from('children')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch children: ${error.message}`,
        },
      };
    }

    const children: Child[] = (data || []).map((row: any) => ({
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      age: row.age,
      dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : undefined,
      gender: row.gender,
      photoUrl: row.photo_url,
      childNumber: row.child_number,
      parentNumber: row.parent_number,
      sitterNumber: row.sitter_number,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    // Sync to AsyncStorage for next time
    if (children.length > 0) {
      try {
        const { save, STORAGE_KEYS } = await import('./local-storage.service');
        for (const child of children) {
          await save(STORAGE_KEYS.CHILDREN, {
            ...child,
            createdAt: child.createdAt.getTime(),
            updatedAt: child.updatedAt.getTime(),
            dateOfBirth: child.dateOfBirth ? child.dateOfBirth.getTime() : null,
          });
        }
        console.log('✅ Children synced from Supabase to AsyncStorage');
      } catch (syncError: any) {
        console.warn('⚠️ Failed to sync children to AsyncStorage:', syncError.message);
      }
    }

    console.log(`✅ Loaded ${children.length} children from Supabase`);
    return { success: true, data: children };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Create or update a child profile
 */
export async function saveChild(child: Child): Promise<ServiceResult<Child>> {
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

    // Generate childNumber if not provided (for new children)
    let childNumber = child.childNumber;
    if (!childNumber && !child.id) {
      const childNumberResult = await getNextChildNumber();
      if (childNumberResult.success && childNumberResult.data) {
        childNumber = childNumberResult.data;
      } else {
        // Fallback to local
        childNumber = await getNextChildNumberFromLocal();
      }
    }

    // Get parent's userNumber
    let parentNumber: string | undefined;
    if (child.parentId) {
      try {
        const { data: parentData } = await supabase
          .from('users')
          .select('user_number')
          .eq('id', child.parentId)
          .single();
        
        if (parentData) {
          parentNumber = parentData.user_number;
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch parent userNumber:', error);
      }
    }

    const childData = {
      ...child,
      childNumber: childNumber || child.childNumber,
      parentNumber: parentNumber || child.parentNumber,
      sitterNumber: child.sitterNumber, // Will be set when sitter is assigned
      updatedAt: new Date(),
      createdAt: child.id ? child.createdAt : new Date(),
    };

    // Prepare Supabase data
    const supabaseData: any = {
      parent_id: childData.parentId,
      name: childData.name,
      age: childData.age,
      date_of_birth: childData.dateOfBirth ? childData.dateOfBirth.toISOString().split('T')[0] : null,
      gender: childData.gender || null,
      photo_url: childData.photoUrl || null,
      child_number: childData.childNumber || null,
      parent_number: childData.parentNumber || null,
      sitter_number: childData.sitterNumber || null,
    };

    let savedChild: Child;

    if (child.id) {
      // Update existing
      const { data, error } = await supabase
        .from('children')
        .update(supabaseData)
        .eq('id', child.id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: ErrorCode.DB_UPDATE_ERROR,
            message: `Failed to update child: ${error.message}`,
          },
        };
      }

      savedChild = {
        id: data.id,
        parentId: data.parent_id,
        name: data.name,
        age: data.age,
        dateOfBirth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
        gender: data.gender,
        photoUrl: data.photo_url,
        childNumber: data.child_number,
        parentNumber: data.parent_number,
        sitterNumber: data.sitter_number,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } else {
      // Create new
      const { data, error } = await supabase
        .from('children')
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: ErrorCode.DB_INSERT_ERROR,
            message: `Failed to create child: ${error.message}`,
          },
        };
      }

      savedChild = {
        id: data.id,
        parentId: data.parent_id,
        name: data.name,
        age: data.age,
        dateOfBirth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
        gender: data.gender,
        photoUrl: data.photo_url,
        childNumber: data.child_number,
        parentNumber: data.parent_number,
        sitterNumber: data.sitter_number,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    }

    // Save to AsyncStorage for offline access
    const { save, STORAGE_KEYS } = await import('./local-storage.service');
    const childLocalData = {
      id: savedChild.id,
      parentId: savedChild.parentId,
      childNumber: savedChild.childNumber,
      parentNumber: savedChild.parentNumber,
      sitterNumber: savedChild.sitterNumber,
      name: savedChild.name,
      age: savedChild.age,
      dateOfBirth: savedChild.dateOfBirth ? savedChild.dateOfBirth.getTime() : null,
      gender: savedChild.gender,
      photoUrl: savedChild.photoUrl,
      createdAt: savedChild.createdAt.getTime(),
      updatedAt: savedChild.updatedAt.getTime(),
    };
    
    await save(STORAGE_KEYS.CHILDREN, childLocalData);
    console.log('✅ Child saved to AsyncStorage and Supabase', { childNumber: savedChild.childNumber });

    return { success: true, data: savedChild };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Delete a child profile
 */
export async function deleteChild(childId: string): Promise<ServiceResult<void>> {
  try {
    // Delete from AsyncStorage FIRST (primary storage)
    try {
      const { remove, STORAGE_KEYS } = await import('./local-storage.service');
      await remove(STORAGE_KEYS.CHILDREN, childId);
      console.log('✅ Child deleted from AsyncStorage');
    } catch (localError: any) {
      console.warn('⚠️ Failed to delete from AsyncStorage:', localError.message);
    }

    // Also delete from Supabase
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('children')
        .delete()
        .eq('id', childId);

      if (error) {
        return {
          success: false,
          error: {
            code: ErrorCode.DB_DELETE_ERROR,
            message: `Failed to delete child: ${error.message}`,
          },
        };
      }
      console.log('✅ Child deleted from Supabase');
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
 * Get child instructions
 */
export async function getChildInstructions(
  childId: string
): Promise<ServiceResult<ChildInstructions | null>> {
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
      .from('child_instructions')
      .select('*')
      .eq('child_id', childId)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return { success: true, data: null };
      }
      return {
        success: false,
        error: {
          code: ErrorCode.DB_SELECT_ERROR,
          message: `Failed to fetch instructions: ${error.message}`,
        },
      };
    }

    if (!data) {
      return { success: true, data: null };
    }

    // Parse JSON fields
    const instructions: ChildInstructions = {
      id: data.id,
      childId: data.child_id,
      parentId: data.parent_id,
      feedingSchedule: data.feeding_schedule,
      napSchedule: data.nap_schedule,
      bedtime: data.bedtime,
      dietaryRestrictions: data.dietary_restrictions,
      allergies: data.allergies ? (typeof data.allergies === 'string' ? JSON.parse(data.allergies) : data.allergies) : [],
      medications: data.medications ? (typeof data.medications === 'string' ? JSON.parse(data.medications) : data.medications) : [],
      favoriteActivities: data.favorite_activities ? (typeof data.favorite_activities === 'string' ? JSON.parse(data.favorite_activities) : data.favorite_activities) : [],
      comfortItems: data.comfort_items ? (typeof data.comfort_items === 'string' ? JSON.parse(data.comfort_items) : data.comfort_items) : [],
      routines: data.routines,
      specialNeeds: data.special_needs,
      emergencyContacts: data.emergency_contacts ? (typeof data.emergency_contacts === 'string' ? JSON.parse(data.emergency_contacts) : data.emergency_contacts) : [],
      doctorInfo: data.doctor_info ? (typeof data.doctor_info === 'string' ? JSON.parse(data.doctor_info) : data.doctor_info) : null,
      additionalNotes: data.additional_notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };

    return { success: true, data: instructions };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
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
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_NOT_AVAILABLE,
          message: 'Supabase is not configured',
        },
      };
    }

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
      updatedAt: new Date(),
      createdAt: instructions.id ? instructions.createdAt : new Date(),
    };

    // Prepare Supabase data
    const supabaseData: any = {
      child_id: instructionsData.childId,
      parent_id: instructionsData.parentId,
      feeding_schedule: instructionsData.feedingSchedule || null,
      nap_schedule: instructionsData.napSchedule || null,
      bedtime: instructionsData.bedtime || null,
      dietary_restrictions: instructionsData.dietaryRestrictions || null,
      allergies: instructionsData.allergies ? JSON.stringify(instructionsData.allergies) : null,
      medications: instructionsData.medications ? JSON.stringify(instructionsData.medications) : null,
      favorite_activities: instructionsData.favoriteActivities ? JSON.stringify(instructionsData.favoriteActivities) : null,
      comfort_items: instructionsData.comfortItems ? JSON.stringify(instructionsData.comfortItems) : null,
      routines: instructionsData.routines || null,
      special_needs: instructionsData.specialNeeds || null,
      emergency_contacts: instructionsData.emergencyContacts ? JSON.stringify(instructionsData.emergencyContacts) : null,
      doctor_info: instructionsData.doctorInfo ? JSON.stringify(instructionsData.doctorInfo) : null,
      additional_notes: instructionsData.additionalNotes || null,
    };

    let savedInstructions: ChildInstructions;

    if (instructions.id) {
      // Update existing
      const { data, error } = await supabase
        .from('child_instructions')
        .update(supabaseData)
        .eq('id', instructions.id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: ErrorCode.DB_UPDATE_ERROR,
            message: `Failed to update instructions: ${error.message}`,
          },
        };
      }

      savedInstructions = {
        id: data.id,
        childId: data.child_id,
        parentId: data.parent_id,
        feedingSchedule: data.feeding_schedule,
        napSchedule: data.nap_schedule,
        bedtime: data.bedtime,
        dietaryRestrictions: data.dietary_restrictions,
        allergies: data.allergies ? (typeof data.allergies === 'string' ? JSON.parse(data.allergies) : data.allergies) : [],
        medications: data.medications ? (typeof data.medications === 'string' ? JSON.parse(data.medications) : data.medications) : [],
        favoriteActivities: data.favorite_activities ? (typeof data.favorite_activities === 'string' ? JSON.parse(data.favorite_activities) : data.favorite_activities) : [],
        comfortItems: data.comfort_items ? (typeof data.comfort_items === 'string' ? JSON.parse(data.comfort_items) : data.comfort_items) : [],
        routines: data.routines,
        specialNeeds: data.special_needs,
        emergencyContacts: data.emergency_contacts ? (typeof data.emergency_contacts === 'string' ? JSON.parse(data.emergency_contacts) : data.emergency_contacts) : [],
        doctorInfo: data.doctor_info ? (typeof data.doctor_info === 'string' ? JSON.parse(data.doctor_info) : data.doctor_info) : null,
        additionalNotes: data.additional_notes,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } else {
      // Create new
      const { data, error } = await supabase
        .from('child_instructions')
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: ErrorCode.DB_INSERT_ERROR,
            message: `Failed to create instructions: ${error.message}`,
          },
        };
      }

      savedInstructions = {
        id: data.id,
        childId: data.child_id,
        parentId: data.parent_id,
        feedingSchedule: data.feeding_schedule,
        napSchedule: data.nap_schedule,
        bedtime: data.bedtime,
        dietaryRestrictions: data.dietary_restrictions,
        allergies: data.allergies ? (typeof data.allergies === 'string' ? JSON.parse(data.allergies) : data.allergies) : [],
        medications: data.medications ? (typeof data.medications === 'string' ? JSON.parse(data.medications) : data.medications) : [],
        favoriteActivities: data.favorite_activities ? (typeof data.favorite_activities === 'string' ? JSON.parse(data.favorite_activities) : data.favorite_activities) : [],
        comfortItems: data.comfort_items ? (typeof data.comfort_items === 'string' ? JSON.parse(data.comfort_items) : data.comfort_items) : [],
        routines: data.routines,
        specialNeeds: data.special_needs,
        emergencyContacts: data.emergency_contacts ? (typeof data.emergency_contacts === 'string' ? JSON.parse(data.emergency_contacts) : data.emergency_contacts) : [],
        doctorInfo: data.doctor_info ? (typeof data.doctor_info === 'string' ? JSON.parse(data.doctor_info) : data.doctor_info) : null,
        additionalNotes: data.additional_notes,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    }

    // Save to AsyncStorage for offline access
    const { save, STORAGE_KEYS } = await import('./local-storage.service');
    const instructionsLocalData = {
      id: savedInstructions.id,
      childId: savedInstructions.childId,
      parentId: savedInstructions.parentId,
      feedingSchedule: savedInstructions.feedingSchedule,
      napSchedule: savedInstructions.napSchedule,
      bedtime: savedInstructions.bedtime,
      dietaryRestrictions: savedInstructions.dietaryRestrictions,
      allergies: savedInstructions.allergies ? JSON.stringify(savedInstructions.allergies) : null,
      medications: savedInstructions.medications ? JSON.stringify(savedInstructions.medications) : null,
      favoriteActivities: savedInstructions.favoriteActivities ? JSON.stringify(savedInstructions.favoriteActivities) : null,
      comfortItems: savedInstructions.comfortItems ? JSON.stringify(savedInstructions.comfortItems) : null,
      routines: savedInstructions.routines,
      specialNeeds: savedInstructions.specialNeeds,
      emergencyContacts: savedInstructions.emergencyContacts ? JSON.stringify(savedInstructions.emergencyContacts) : null,
      doctorInfo: savedInstructions.doctorInfo ? JSON.stringify(savedInstructions.doctorInfo) : null,
      additionalNotes: savedInstructions.additionalNotes,
      instructionText: instructionText,
      createdAt: savedInstructions.createdAt.getTime(),
      updatedAt: savedInstructions.updatedAt.getTime(),
    };
    
    await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, instructionsLocalData);
    console.log('✅ Child instructions saved to AsyncStorage and Supabase');

    return { success: true, data: savedInstructions };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
