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
  console.log('🚀 saveChild called with:', { name: child.name, id: child.id, parentId: child.parentId });
  try {
    // CRITICAL: Detect temp IDs - these are local-only and should be treated as new inserts
    const isTempId = child.id && child.id.startsWith('temp_');
    const isNewChild = !child.id || child.id.trim() === '' || isTempId;
    
    console.log('🔍 Save strategy:', { 
      isNewChild, 
      isTempId, 
      hasId: !!child.id,
      childNumber: child.childNumber 
    });

    // ALWAYS generate childNumber if missing (even for temp IDs)
    let childNumber = child.childNumber;
    if (!childNumber) {
      console.log('🔢 Generating child number (local-first)...');
      childNumber = await getNextChildNumberFromLocal();
      console.log('✅ Generated local child number:', childNumber);
      
      // Sync with Supabase in background (non-blocking)
      getNextChildNumber().catch(() => {
        // Ignore - using local number
      });
    } else {
      console.log('✅ Using existing child number:', childNumber);
    }

    // Get parent's userNumber from AsyncStorage FIRST (fast, non-blocking)
    let parentNumber: string | undefined = child.parentNumber;
    if (!parentNumber && child.parentId) {
      try {
        const { getAll, STORAGE_KEYS } = await import('./local-storage.service');
        const usersResult = await getAll(STORAGE_KEYS.USERS);
        if (usersResult.success && usersResult.data) {
          const parent = (usersResult.data as any[]).find((u: any) => u.id === child.parentId);
          if (parent && (parent as any).userNumber) {
            parentNumber = (parent as any).userNumber;
            console.log('✅ Got parent number from AsyncStorage:', parentNumber);
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to get parent number from AsyncStorage:', error);
      }
      
      // If still not found, try Supabase in background (non-blocking)
      if (!parentNumber && isSupabaseConfigured() && supabase) {
        (async () => {
          try {
            const { data } = await supabase
              .from('users')
              .select('user_number')
              .eq('id', child.parentId)
              .maybeSingle();
            if (data?.user_number) {
              console.log('✅ Got parent number from Supabase:', data.user_number);
              // Update AsyncStorage with parent number
              const { save, getAll, STORAGE_KEYS } = await import('./local-storage.service');
              const usersResult = await getAll(STORAGE_KEYS.USERS);
              if (usersResult.success && usersResult.data) {
                const parent = (usersResult.data as any[]).find((u: any) => u.id === child.parentId);
                if (parent) {
                  await save(STORAGE_KEYS.USERS, { ...parent, userNumber: data.user_number });
                }
              }
            }
          } catch (error) {
            // Ignore - not critical
          }
        })();
      }
    }

    const childData = {
      ...child,
      childNumber: childNumber, // Always ensure childNumber is set
      parentNumber: parentNumber || child.parentNumber,
      sitterNumber: child.sitterNumber,
      updatedAt: new Date(),
      createdAt: isNewChild ? new Date() : (child.createdAt || new Date()),
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

    // ASYNCSTORAGE-FIRST: Always save to AsyncStorage immediately
    if (isNewChild) {
      // New child - generate temp ID if needed
      const tempId = isTempId ? child.id : `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      savedChild = {
        id: tempId,
        parentId: childData.parentId,
        name: childData.name,
        age: childData.age,
        dateOfBirth: childData.dateOfBirth,
        gender: childData.gender,
        photoUrl: childData.photoUrl,
        childNumber: childData.childNumber,
        parentNumber: childData.parentNumber,
        sitterNumber: childData.sitterNumber,
        createdAt: childData.createdAt,
        updatedAt: childData.updatedAt,
      };
      
      console.log('✅ Child created locally with temp ID:', tempId);
    } else {
      // Existing child (real ID) - update locally first
      savedChild = {
        ...childData,
        id: child.id!,
      };
      console.log('✅ Child updated locally:', savedChild.id);
    }

    // Save to AsyncStorage IMMEDIATELY (instant UI)
    try {
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
      console.log('✅ Child saved to AsyncStorage (instant UI)');
    } catch (storageError: any) {
      console.warn('⚠️ Failed to save to AsyncStorage:', storageError);
    }

    // FAST & RELIABLE: Save to AsyncStorage first, then sync to Supabase with timeout
    if (isNewChild) {
      // New child - use upsert to handle duplicates gracefully
      const tempId = savedChild.id;
      
      // Sync to Supabase in background (fire and forget - instant return)
      if (isSupabaseConfigured() && supabase) {
        (async () => {
          try {
            console.log('💾 Background sync to Supabase...');
            
            // Use upsert to handle duplicates
            const result = await supabase
              .from('children')
              .upsert(supabaseData, { 
                onConflict: 'child_number',
                ignoreDuplicates: false 
              })
              .select()
              .single();
            
            if (result && result.data && !result.error) {
              // Success - update AsyncStorage with real ID
              const realChild = {
                id: result.data.id,
                parentId: result.data.parent_id,
                name: result.data.name,
                age: result.data.age,
                dateOfBirth: result.data.date_of_birth ? new Date(result.data.date_of_birth) : undefined,
                gender: result.data.gender,
                photoUrl: result.data.photo_url,
                childNumber: result.data.child_number,
                parentNumber: result.data.parent_number,
                sitterNumber: result.data.sitter_number,
                createdAt: new Date(result.data.created_at),
                updatedAt: new Date(result.data.updated_at),
              };
              
              // Update AsyncStorage with real ID (replace temp ID)
              try {
                const { save, getAll, STORAGE_KEYS } = await import('./local-storage.service');
                const allChildren = await getAll(STORAGE_KEYS.CHILDREN);
                if (allChildren.success && allChildren.data) {
                  const updatedChildren = allChildren.data.map((c: any) => 
                    c.id === tempId ? {
                      ...realChild,
                      createdAt: realChild.createdAt.getTime(),
                      updatedAt: realChild.updatedAt.getTime(),
                      dateOfBirth: realChild.dateOfBirth ? realChild.dateOfBirth.getTime() : null,
                    } : c
                  );
                  for (const child of updatedChildren) {
                    await save(STORAGE_KEYS.CHILDREN, child);
                  }
                }
                console.log('✅ Child synced to Supabase, AsyncStorage updated with real ID:', realChild.id);
              } catch (updateError) {
                console.warn('⚠️ Failed to update AsyncStorage with real ID:', updateError);
              }
            } else if (result && result.error) {
              console.warn('⚠️ Background Supabase sync failed:', result.error.message);
            }
          } catch (error: any) {
            console.warn('⚠️ Background Supabase sync error:', error.message);
          }
        })(); // IIFE - runs in background, doesn't block
      }
      
      // Return success IMMEDIATELY - no waiting
      return { success: true, data: savedChild };
    } else {
      // Existing child (real ID) - sync in background (fire and forget - instant return)
      const realId = savedChild.id;
      
      // Sync to Supabase in background (fire and forget - instant return)
      if (isSupabaseConfigured() && supabase) {
        (async () => {
          try {
            console.log('💾 Background update to Supabase:', realId);
            
            const result = await supabase
              .from('children')
              .update(supabaseData)
              .eq('id', realId)
              .select()
              .single();
            
            if (result && result.data && !result.error) {
              console.log('✅ Child updated in Supabase:', result.data.id);
              // Update AsyncStorage with latest data from Supabase
              try {
                const { save, STORAGE_KEYS } = await import('./local-storage.service');
                const updatedChild = {
                  id: result.data.id,
                  parentId: result.data.parent_id,
                  childNumber: result.data.child_number,
                  parentNumber: result.data.parent_number,
                  sitterNumber: result.data.sitter_number,
                  name: result.data.name,
                  age: result.data.age,
                  dateOfBirth: result.data.date_of_birth ? new Date(result.data.date_of_birth).getTime() : null,
                  gender: result.data.gender,
                  photoUrl: result.data.photo_url,
                  createdAt: new Date(result.data.created_at).getTime(),
                  updatedAt: new Date(result.data.updated_at).getTime(),
                };
                await save(STORAGE_KEYS.CHILDREN, updatedChild);
                console.log('✅ AsyncStorage updated with Supabase data');
              } catch (updateError) {
                console.warn('⚠️ Failed to update AsyncStorage:', updateError);
              }
            } else if (result && result.error) {
              console.warn('⚠️ Background Supabase update failed:', result.error.message);
            }
          } catch (error: any) {
            console.warn('⚠️ Background Supabase update error:', error.message);
          }
        })(); // IIFE - runs in background, doesn't block
      }
      
      // Return success IMMEDIATELY - no waiting
      return { success: true, data: savedChild };
    }
  } catch (error: any) {
    console.error('❌ Exception in saveChild:', error);
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Delete a child profile
 * Also deletes child instructions (cascade delete in DB handles this, but we clean up AsyncStorage)
 */
export async function deleteChild(childId: string): Promise<ServiceResult<void>> {
  try {
    if (!childId || childId.trim() === '') {
      return {
        success: false,
        error: {
          code: ErrorCode.DB_DELETE_ERROR,
          message: 'Invalid child ID',
        },
      };
    }

    // Check if it's a temp ID (starts with 'temp_')
    const isTempId = childId.startsWith('temp_');
    
    console.log('🗑️ Deleting child:', childId, 'isTempId:', isTempId);

    // Delete from AsyncStorage FIRST (optimistic UI)
    try {
      const { remove, getAll, STORAGE_KEYS } = await import('./local-storage.service');
      
      // Delete child
      await remove(STORAGE_KEYS.CHILDREN, childId);
      console.log('✅ Child deleted from AsyncStorage');
      
      // Also delete child instructions from AsyncStorage
      const instructionsResult = await getAll(STORAGE_KEYS.CHILD_INSTRUCTIONS);
      if (instructionsResult.success && instructionsResult.data) {
        const childInstructions = (instructionsResult.data as any[]).filter((inst: any) => inst.childId === childId);
        for (const inst of childInstructions) {
          await remove(STORAGE_KEYS.CHILD_INSTRUCTIONS, (inst as any).id);
        }
        if (childInstructions.length > 0) {
          console.log(`✅ Deleted ${childInstructions.length} child instruction(s) from AsyncStorage`);
        }
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to delete from AsyncStorage:', localError.message);
    }

    // Delete from Supabase in background (fire and forget - instant return)
    if (!isTempId && isSupabaseConfigured() && supabase) {
      (async () => {
        try {
          console.log('💾 Background delete from Supabase...');
          const result = await supabase
            .from('children')
            .delete()
            .eq('id', childId);

          if (result && result.error) {
            console.warn('⚠️ Background Supabase delete failed:', result.error.message);
          } else {
            console.log('✅ Child deleted from Supabase (child_instructions deleted via cascade)');
          }
        } catch (error: any) {
          console.warn('⚠️ Background Supabase delete error:', error.message);
        }
      })(); // IIFE - runs in background, doesn't block
    } else if (isTempId) {
      console.log('⚠️ Skipping Supabase delete for temp ID:', childId);
    }

    // Return success IMMEDIATELY - no waiting
    return { success: true };
  } catch (error: any) {
    console.error('❌ Delete child error:', error);
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

    // FAST & RELIABLE: Save to AsyncStorage first, then sync to Supabase with timeout
    const tempId = instructions.id || `temp_inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let savedInstructions: ChildInstructions = {
      id: tempId,
      childId: instructionsData.childId,
      parentId: instructionsData.parentId,
      feedingSchedule: instructionsData.feedingSchedule,
      napSchedule: instructionsData.napSchedule,
      bedtime: instructionsData.bedtime,
      dietaryRestrictions: instructionsData.dietaryRestrictions,
      allergies: instructionsData.allergies,
      medications: instructionsData.medications,
      favoriteActivities: instructionsData.favoriteActivities,
      comfortItems: instructionsData.comfortItems,
      routines: instructionsData.routines,
      specialNeeds: instructionsData.specialNeeds,
      emergencyContacts: instructionsData.emergencyContacts,
      doctorInfo: instructionsData.doctorInfo,
      additionalNotes: instructionsData.additionalNotes,
      createdAt: instructionsData.createdAt,
      updatedAt: instructionsData.updatedAt,
    };

    // Save to AsyncStorage immediately
    try {
      const { save, STORAGE_KEYS } = await import('./local-storage.service');
      await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
        ...savedInstructions,
        createdAt: savedInstructions.createdAt.getTime(),
        updatedAt: savedInstructions.updatedAt.getTime(),
      });
      console.log('✅ Instructions saved to AsyncStorage');
    } catch (storageError: any) {
      console.warn('⚠️ Failed to save to AsyncStorage:', storageError);
    }

    // Sync to Supabase in background (fire and forget - instant return)
    if (instructions.id) {
      // Update existing - sync in background
      (async () => {
        try {
          console.log('💾 Background update instructions in Supabase:', instructions.id);
          const result = await supabase
            .from('child_instructions')
            .update(supabaseData)
            .eq('id', instructions.id)
            .select()
            .single();

          if (result && result.data && !result.error) {
            const updatedInstructions = {
              id: result.data.id,
              childId: result.data.child_id,
              parentId: result.data.parent_id,
              feedingSchedule: result.data.feeding_schedule,
              napSchedule: result.data.nap_schedule,
              bedtime: result.data.bedtime,
              dietaryRestrictions: result.data.dietary_restrictions,
              allergies: result.data.allergies ? (typeof result.data.allergies === 'string' ? JSON.parse(result.data.allergies) : result.data.allergies) : [],
              medications: result.data.medications ? (typeof result.data.medications === 'string' ? JSON.parse(result.data.medications) : result.data.medications) : [],
              favoriteActivities: result.data.favorite_activities ? (typeof result.data.favorite_activities === 'string' ? JSON.parse(result.data.favorite_activities) : result.data.favorite_activities) : [],
              comfortItems: result.data.comfort_items ? (typeof result.data.comfort_items === 'string' ? JSON.parse(result.data.comfort_items) : result.data.comfort_items) : [],
              routines: result.data.routines,
              specialNeeds: result.data.special_needs,
              emergencyContacts: result.data.emergency_contacts ? (typeof result.data.emergency_contacts === 'string' ? JSON.parse(result.data.emergency_contacts) : result.data.emergency_contacts) : [],
              doctorInfo: result.data.doctor_info ? (typeof result.data.doctor_info === 'string' ? JSON.parse(result.data.doctor_info) : result.data.doctor_info) : null,
              additionalNotes: result.data.additional_notes,
              createdAt: new Date(result.data.created_at),
              updatedAt: new Date(result.data.updated_at),
            };
            console.log('✅ Instructions updated in Supabase:', updatedInstructions.id);
            
            // Update AsyncStorage with latest data
            try {
              const { save, STORAGE_KEYS } = await import('./local-storage.service');
              await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
                ...updatedInstructions,
                createdAt: updatedInstructions.createdAt.getTime(),
                updatedAt: updatedInstructions.updatedAt.getTime(),
              });
            } catch (updateError) {
              console.warn('⚠️ Failed to update AsyncStorage:', updateError);
            }
          } else if (result && result.error) {
            console.warn('⚠️ Background Supabase update failed:', result.error.message);
          }
        } catch (error: any) {
          console.warn('⚠️ Background Supabase update error:', error.message);
        }
      })(); // IIFE - runs in background, doesn't block
    } else {
      // Create new - sync in background
      (async () => {
        try {
          console.log('💾 Background create instructions in Supabase...');
          const result = await supabase
            .from('child_instructions')
            .upsert(supabaseData, { 
              onConflict: 'child_id',
              ignoreDuplicates: false 
            })
            .select()
            .single();

          if (result && result.data && !result.error) {
            const createdInstructions = {
              id: result.data.id,
              childId: result.data.child_id,
              parentId: result.data.parent_id,
              feedingSchedule: result.data.feeding_schedule,
              napSchedule: result.data.nap_schedule,
              bedtime: result.data.bedtime,
              dietaryRestrictions: result.data.dietary_restrictions,
              allergies: result.data.allergies ? (typeof result.data.allergies === 'string' ? JSON.parse(result.data.allergies) : result.data.allergies) : [],
              medications: result.data.medications ? (typeof result.data.medications === 'string' ? JSON.parse(result.data.medications) : result.data.medications) : [],
              favoriteActivities: result.data.favorite_activities ? (typeof result.data.favorite_activities === 'string' ? JSON.parse(result.data.favorite_activities) : result.data.favorite_activities) : [],
              comfortItems: result.data.comfort_items ? (typeof result.data.comfort_items === 'string' ? JSON.parse(result.data.comfort_items) : result.data.comfort_items) : [],
              routines: result.data.routines,
              specialNeeds: result.data.special_needs,
              emergencyContacts: result.data.emergency_contacts ? (typeof result.data.emergency_contacts === 'string' ? JSON.parse(result.data.emergency_contacts) : result.data.emergency_contacts) : [],
              doctorInfo: result.data.doctor_info ? (typeof result.data.doctor_info === 'string' ? JSON.parse(result.data.doctor_info) : result.data.doctor_info) : null,
              additionalNotes: result.data.additional_notes,
              createdAt: new Date(result.data.created_at),
              updatedAt: new Date(result.data.updated_at),
            };
            console.log('✅ Instructions created/updated in Supabase:', createdInstructions.id);
            
            // Update AsyncStorage with real ID (replace temp ID)
            try {
              const { save, remove, STORAGE_KEYS } = await import('./local-storage.service');
              await remove(STORAGE_KEYS.CHILD_INSTRUCTIONS, tempId);
              await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
                ...createdInstructions,
                createdAt: createdInstructions.createdAt.getTime(),
                updatedAt: createdInstructions.updatedAt.getTime(),
              });
              console.log('✅ AsyncStorage updated with real ID from Supabase');
            } catch (updateError) {
              console.warn('⚠️ Failed to update AsyncStorage:', updateError);
            }
          } else if (result && result.error) {
            console.warn('⚠️ Background Supabase create failed:', result.error.message);
          }
        } catch (error: any) {
          console.warn('⚠️ Background Supabase create error:', error.message);
        }
      })(); // IIFE - runs in background, doesn't block
    }

    return { success: true, data: savedInstructions };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
