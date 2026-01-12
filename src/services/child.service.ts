/**
 * Child Service - REST API
 * Handles child profile and instructions operations with AsyncStorage caching
 */
import { API_ENDPOINTS } from '@/src/config/constants';
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { Child, ChildInstructions } from '@/src/types/child.types';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { apiRequest } from './api-base.service';
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

    // Try API first, fallback to direct Supabase if API fails
    let result = await apiRequest<any[]>(API_ENDPOINTS.CHILDREN);

    if (!result.success) {
      console.warn('⚠️ API failed, trying direct Supabase fetch:', result.error?.message);
      
      // Fallback to direct Supabase fetch
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: childrenData, error: supabaseError } = await supabase
            .from('children')
            .select('*')
            .eq('parent_id', parentId)
            .order('created_at', { ascending: false });

          if (supabaseError) {
            console.error('❌ Supabase fetch failed:', supabaseError);
            return {
              success: false,
              error: {
                code: ErrorCode.DB_SELECT_ERROR,
                message: `Failed to fetch children: ${supabaseError.message}`,
              },
            };
          }

          const children: Child[] = (childrenData || []).map((child: any) => ({
            id: child.id,
            parentId: child.parent_id,
            name: child.name,
            age: child.age,
            dateOfBirth: child.date_of_birth ? new Date(child.date_of_birth) : undefined,
            gender: child.gender || undefined,
            photoUrl: child.photo_url || undefined,
            childNumber: child.child_number || undefined,
            parentNumber: child.parent_number || undefined,
            sitterNumber: child.sitter_number || undefined,
            createdAt: new Date(child.created_at),
            updatedAt: new Date(child.updated_at),
          }));

          // Sync to AsyncStorage for next time - replace temp IDs with real IDs
          if (children.length > 0) {
            try {
              const { save, getAll, remove, STORAGE_KEYS } = await import('./local-storage.service');
              
              // Get all existing children to find temp IDs to remove
              const existingResult = await getAll(STORAGE_KEYS.CHILDREN);
              if (existingResult.success && existingResult.data) {
                // Find temp IDs that should be replaced
                const tempIdsToRemove = (existingResult.data as any[])
                  .filter((c: any) => c.parentId === parentId && c.id && c.id.startsWith('temp_'))
                  .map((c: any) => c.id);
                
                // Remove temp IDs
                for (const tempId of tempIdsToRemove) {
                  await remove(STORAGE_KEYS.CHILDREN, tempId);
                }
                if (tempIdsToRemove.length > 0) {
                  console.log(`🗑️ Removed ${tempIdsToRemove.length} temp child ID(s) from AsyncStorage`);
                }
              }
              
              // Save real children
              for (const child of children) {
                await save(STORAGE_KEYS.CHILDREN, {
                  ...child,
                  createdAt: child.createdAt.getTime(),
                  updatedAt: child.updatedAt.getTime(),
                  dateOfBirth: child.dateOfBirth ? child.dateOfBirth.getTime() : null,
                });
              }
              console.log('✅ Children synced from Supabase to AsyncStorage (temp IDs removed)');
            } catch (syncError: any) {
              console.warn('⚠️ Failed to sync children to AsyncStorage:', syncError.message);
            }
          }

          console.log(`✅ Loaded ${children.length} children from Supabase (direct)`);
          return { success: true, data: children };
        } catch (error: any) {
          return {
            success: false,
            error: {
              code: ErrorCode.DB_SELECT_ERROR,
              message: `Failed to fetch children: ${error.message}`,
            },
          };
        }
      }
      
      // If Supabase also fails, return API error
      return result;
    }

    const children: Child[] = (result.data || []).map((apiChild: any) => ({
      id: apiChild.id,
      parentId: apiChild.parentId,
      name: apiChild.name,
      age: apiChild.age,
      dateOfBirth: apiChild.dateOfBirth ? new Date(apiChild.dateOfBirth) : undefined,
      gender: apiChild.gender,
      photoUrl: apiChild.photoUrl,
      childNumber: apiChild.childNumber,
      parentNumber: apiChild.parentNumber,
      sitterNumber: apiChild.sitterNumber,
      createdAt: new Date(apiChild.createdAt),
      updatedAt: new Date(apiChild.updatedAt),
    }));

    // Sync to AsyncStorage for next time - replace temp IDs with real IDs
    if (children.length > 0) {
      try {
        const { save, getAll, remove, STORAGE_KEYS } = await import('./local-storage.service');
        
        // Get all existing children to find temp IDs to remove
        const existingResult = await getAll(STORAGE_KEYS.CHILDREN);
        if (existingResult.success && existingResult.data) {
          // Find temp IDs that should be replaced
          const tempIdsToRemove = (existingResult.data as any[])
            .filter((c: any) => c.parentId === parentId && c.id && c.id.startsWith('temp_'))
            .map((c: any) => c.id);
          
          // Remove temp IDs
          for (const tempId of tempIdsToRemove) {
            await remove(STORAGE_KEYS.CHILDREN, tempId);
          }
          if (tempIdsToRemove.length > 0) {
            console.log(`🗑️ Removed ${tempIdsToRemove.length} temp child ID(s) from AsyncStorage`);
          }
        }
        
        // Save real children
        for (const child of children) {
          await save(STORAGE_KEYS.CHILDREN, {
            ...child,
            createdAt: child.createdAt.getTime(),
            updatedAt: child.updatedAt.getTime(),
            dateOfBirth: child.dateOfBirth ? child.dateOfBirth.getTime() : null,
          });
        }
        console.log('✅ Children synced from API to AsyncStorage (temp IDs removed)');
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
 * Get child by ID
 */
export async function getChildById(childId: string): Promise<ServiceResult<Child>> {
  try {
    // Try AsyncStorage first
    try {
      const { getById, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getById<Child>(STORAGE_KEYS.CHILDREN, childId);
      if (result.success && result.data) {
        const child = result.data;
        return {
          success: true,
          data: {
            ...child,
            createdAt: new Date(child.createdAt as any),
            updatedAt: new Date(child.updatedAt as any),
            dateOfBirth: child.dateOfBirth ? new Date(child.dateOfBirth as any) : undefined,
          },
        };
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to load from AsyncStorage:', localError.message);
    }

    // Fallback to API
    const result = await apiRequest<any>(API_ENDPOINTS.CHILD_BY_ID(childId));

    if (!result.success) {
      return result;
    }

    const apiChild = result.data;
    const child: Child = {
      id: apiChild.id,
      parentId: apiChild.parentId,
      name: apiChild.name,
      age: apiChild.age,
      dateOfBirth: apiChild.dateOfBirth ? new Date(apiChild.dateOfBirth) : undefined,
      gender: apiChild.gender,
      photoUrl: apiChild.photoUrl,
      childNumber: apiChild.childNumber,
      parentNumber: apiChild.parentNumber,
      sitterNumber: apiChild.sitterNumber,
      createdAt: new Date(apiChild.createdAt),
      updatedAt: new Date(apiChild.updatedAt),
    };

    return { success: true, data: child };
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
      
      // Sync to API in background (fire and forget - instant return)
      (async () => {
        try {
          console.log('💾 Background sync to API...');
          
          const apiData = {
            name: supabaseData.name,
            age: supabaseData.age,
            dateOfBirth: supabaseData.date_of_birth,
            gender: supabaseData.gender,
            photoUrl: supabaseData.photo_url,
            childNumber: supabaseData.child_number,
            parentNumber: supabaseData.parent_number,
          };
          
          let result = await apiRequest<any>(API_ENDPOINTS.CHILDREN, {
            method: 'POST',
            body: JSON.stringify(apiData),
          });
          
          // If API fails, try direct Supabase insert
          if (!result.success) {
            console.warn('⚠️ API sync failed, trying direct Supabase insert:', result.error?.message);
            
            if (isSupabaseConfigured() && supabase) {
              try {
                const { data: insertedChild, error: insertError } = await supabase
                  .from('children')
                  .insert(supabaseData)
                  .select()
                  .single();

                if (insertError) {
                  console.error('❌ Direct Supabase insert failed:', insertError);
                  return; // Give up
                }

                // Success - convert to Child type
                const realChild: Child = {
                  id: insertedChild.id,
                  parentId: insertedChild.parent_id,
                  name: insertedChild.name,
                  age: insertedChild.age,
                  dateOfBirth: insertedChild.date_of_birth ? new Date(insertedChild.date_of_birth) : undefined,
                  gender: insertedChild.gender || undefined,
                  photoUrl: insertedChild.photo_url || undefined,
                  childNumber: insertedChild.child_number || undefined,
                  parentNumber: insertedChild.parent_number || undefined,
                  sitterNumber: insertedChild.sitter_number || undefined,
                  createdAt: new Date(insertedChild.created_at),
                  updatedAt: new Date(insertedChild.updated_at),
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
                  console.log('✅ Child synced to Supabase (direct), AsyncStorage updated with real ID:', realChild.id);
                } catch (updateError) {
                  console.warn('⚠️ Failed to update AsyncStorage with real ID:', updateError);
                }
                return; // Success
              } catch (supabaseError: any) {
                console.error('❌ Direct Supabase insert exception:', supabaseError);
                return; // Give up
              }
            }
            return; // No Supabase, give up
          }
          
          // API succeeded
          if (result.success && result.data) {
            // Success - update AsyncStorage with real ID
            const apiChild = result.data;
            const realChild = {
              id: apiChild.id,
              parentId: apiChild.parentId,
              name: apiChild.name,
              age: apiChild.age,
              dateOfBirth: apiChild.dateOfBirth ? new Date(apiChild.dateOfBirth) : undefined,
              gender: apiChild.gender,
              photoUrl: apiChild.photoUrl,
              childNumber: apiChild.childNumber,
              parentNumber: apiChild.parentNumber,
              sitterNumber: apiChild.sitterNumber,
              createdAt: new Date(apiChild.createdAt),
              updatedAt: new Date(apiChild.updatedAt),
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
          } else {
            console.warn('⚠️ Background API sync failed:', result.error?.message);
          }
        } catch (error: any) {
          console.warn('⚠️ Background API sync error:', error.message);
        }
      })(); // IIFE - runs in background, doesn't block
      
      // Return success IMMEDIATELY - no waiting
      return { success: true, data: savedChild };
    } else {
      // Existing child (real ID) - sync in background
      const realId = savedChild.id;
      
      // Sync to API first, fallback to direct Supabase if API fails
      (async () => {
        try {
          console.log('💾 Background update to API:', realId);
          
          const apiData: any = {};
          if (supabaseData.name !== undefined) apiData.name = supabaseData.name;
          if (supabaseData.age !== undefined) apiData.age = supabaseData.age;
          if (supabaseData.date_of_birth !== undefined) apiData.dateOfBirth = supabaseData.date_of_birth;
          if (supabaseData.gender !== undefined) apiData.gender = supabaseData.gender;
          if (supabaseData.photo_url !== undefined) apiData.photoUrl = supabaseData.photo_url;
          if (supabaseData.child_number !== undefined) apiData.childNumber = supabaseData.child_number;
          if (supabaseData.parent_number !== undefined) apiData.parentNumber = supabaseData.parent_number;
          if (supabaseData.sitter_number !== undefined) apiData.sitterNumber = supabaseData.sitter_number;
          
          let result = await apiRequest<any>(API_ENDPOINTS.CHILD_BY_ID(realId), {
            method: 'PUT',
            body: JSON.stringify(apiData),
          });
          
          // If API fails, try direct Supabase update
          if (!result.success) {
            console.warn('⚠️ API update failed, trying direct Supabase update:', result.error?.message);
            
            if (isSupabaseConfigured() && supabase) {
              try {
                const { data: updatedChild, error: updateError } = await supabase
                  .from('children')
                  .update(supabaseData)
                  .eq('id', realId)
                  .select()
                  .single();

                if (updateError) {
                  console.error('❌ Direct Supabase update failed:', updateError);
                  return; // Give up
                }

                // Success - convert to Child type
                const realChild: Child = {
                  id: updatedChild.id,
                  parentId: updatedChild.parent_id,
                  name: updatedChild.name,
                  age: updatedChild.age,
                  dateOfBirth: updatedChild.date_of_birth ? new Date(updatedChild.date_of_birth) : undefined,
                  gender: updatedChild.gender || undefined,
                  photoUrl: updatedChild.photo_url || undefined,
                  childNumber: updatedChild.child_number || undefined,
                  parentNumber: updatedChild.parent_number || undefined,
                  sitterNumber: updatedChild.sitter_number || undefined,
                  createdAt: new Date(updatedChild.created_at),
                  updatedAt: new Date(updatedChild.updated_at),
                };

                // Update AsyncStorage with latest data
                try {
                  const { save, STORAGE_KEYS } = await import('./local-storage.service');
                  await save(STORAGE_KEYS.CHILDREN, {
                    ...realChild,
                    createdAt: realChild.createdAt.getTime(),
                    updatedAt: realChild.updatedAt.getTime(),
                    dateOfBirth: realChild.dateOfBirth ? realChild.dateOfBirth.getTime() : null,
                  });
                  console.log('✅ AsyncStorage updated with Supabase data (direct)');
                } catch (updateError) {
                  console.warn('⚠️ Failed to update AsyncStorage:', updateError);
                }
                return; // Success
              } catch (supabaseError: any) {
                console.error('❌ Direct Supabase update exception:', supabaseError);
                return; // Give up
              }
            }
            return; // No Supabase, give up
          }
          
          // API succeeded
          if (result.success && result.data) {
            console.log('✅ Child updated in API:', result.data.id);
            // Update AsyncStorage with latest data from API
            try {
              const { save, STORAGE_KEYS } = await import('./local-storage.service');
              const apiChild = result.data;
              const updatedChild = {
                id: apiChild.id,
                parentId: apiChild.parentId,
                childNumber: apiChild.childNumber,
                parentNumber: apiChild.parentNumber,
                sitterNumber: apiChild.sitterNumber,
                name: apiChild.name,
                  age: apiChild.age,
                  dateOfBirth: apiChild.dateOfBirth ? new Date(apiChild.dateOfBirth).getTime() : null,
                  gender: apiChild.gender,
                  photoUrl: apiChild.photoUrl,
                  createdAt: new Date(apiChild.createdAt).getTime(),
                  updatedAt: new Date(apiChild.updatedAt).getTime(),
                };
                await save(STORAGE_KEYS.CHILDREN, updatedChild);
                console.log('✅ AsyncStorage updated with API data');
              } catch (updateError) {
                console.warn('⚠️ Failed to update AsyncStorage:', updateError);
              }
          }
        } catch (error: any) {
          console.warn('⚠️ Background update error:', error.message);
        }
      })(); // IIFE - runs in background, doesn't block
      
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

    // Delete from API, fallback to direct Supabase if API fails
    if (!isTempId) {
      try {
        console.log('💾 Deleting child from API...');
        const result = await apiRequest<any>(API_ENDPOINTS.CHILD_BY_ID(childId), {
          method: 'DELETE',
        });

        if (!result.success) {
          console.warn('⚠️ API delete failed, trying direct Supabase delete...');
          
          // Fallback to direct Supabase delete
          if (isSupabaseConfigured() && supabase) {
            try {
              // Delete child from Supabase (cascade delete will handle child_instructions)
              const { error: deleteError } = await supabase
                .from('children')
                .delete()
                .eq('id', childId);
              
              if (deleteError) {
                console.error('❌ Direct Supabase delete failed:', deleteError);
                return {
                  success: false,
                  error: {
                    code: ErrorCode.DB_DELETE_ERROR,
                    message: `Failed to delete child: ${deleteError.message}`,
                  },
                };
              }
              
              console.log('✅ Child deleted from Supabase (direct fallback)');
            } catch (supabaseError: any) {
              console.error('❌ Direct Supabase delete exception:', supabaseError);
              return {
                success: false,
                error: {
                  code: ErrorCode.DB_DELETE_ERROR,
                  message: `Failed to delete child: ${supabaseError.message}`,
                },
              };
            }
          } else {
            return {
              success: false,
              error: {
                code: ErrorCode.DB_DELETE_ERROR,
                message: 'API delete failed and Supabase is not configured',
              },
            };
          }
        } else {
          console.log('✅ Child deleted from API (child_instructions deleted via cascade)');
        }
      } catch (error: any) {
        console.error('❌ Delete error:', error);
        
        // Try Supabase fallback even on exception
        if (isSupabaseConfigured() && supabase) {
          try {
            const { error: deleteError } = await supabase
              .from('children')
              .delete()
              .eq('id', childId);
            
            if (deleteError) {
              return {
                success: false,
                error: {
                  code: ErrorCode.DB_DELETE_ERROR,
                  message: `Failed to delete child: ${deleteError.message}`,
                },
              };
            }
            
            console.log('✅ Child deleted from Supabase (exception fallback)');
          } catch (supabaseError: any) {
            return {
              success: false,
              error: {
                code: ErrorCode.DB_DELETE_ERROR,
                message: `Failed to delete child: ${supabaseError.message}`,
              },
            };
          }
        } else {
          return {
            success: false,
            error: {
              code: ErrorCode.DB_DELETE_ERROR,
              message: `Failed to delete child: ${error.message}`,
            },
          };
        }
      }
    } else {
      console.log('⚠️ Skipping database delete for temp ID:', childId);
    }

    // Return success
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
    const result = await apiRequest<any>(API_ENDPOINTS.CHILD_INSTRUCTIONS(childId));

    if (!result.success) {
      // If not found, return null instead of error
      const errorCode = result.error?.code as string;
      if (errorCode === 'CHILD_NOT_FOUND' || errorCode === 'DOCUMENT_NOT_FOUND') {
        return { success: true, data: null };
      }
      return result;
    }

    const apiData = result.data;
    
    // Handle empty instructions (id is empty string)
    if (!apiData.id || apiData.id === '') {
      return { success: true, data: null };
    }

    // Parse JSON fields if needed
    const instructions: ChildInstructions = {
      id: apiData.id,
      childId: apiData.childId,
      parentId: apiData.parentId,
      feedingSchedule: apiData.feedingSchedule,
      napSchedule: apiData.napSchedule,
      bedtime: apiData.bedtime,
      dietaryRestrictions: apiData.dietaryRestrictions,
      allergies: apiData.allergies ? (typeof apiData.allergies === 'string' ? JSON.parse(apiData.allergies) : apiData.allergies) : [],
      medications: apiData.medications ? (typeof apiData.medications === 'string' ? JSON.parse(apiData.medications) : apiData.medications) : [],
      favoriteActivities: apiData.favoriteActivities ? (typeof apiData.favoriteActivities === 'string' ? JSON.parse(apiData.favoriteActivities) : apiData.favoriteActivities) : [],
      comfortItems: apiData.comfortItems ? (typeof apiData.comfortItems === 'string' ? JSON.parse(apiData.comfortItems) : apiData.comfortItems) : [],
      routines: apiData.routines,
      specialNeeds: apiData.specialNeeds,
      emergencyContacts: apiData.emergencyContacts ? (typeof apiData.emergencyContacts === 'string' ? JSON.parse(apiData.emergencyContacts) : apiData.emergencyContacts) : [],
      doctorInfo: apiData.doctorInfo ? (typeof apiData.doctorInfo === 'string' ? JSON.parse(apiData.doctorInfo) : apiData.doctorInfo) : null,
      additionalNotes: apiData.additionalNotes,
      createdAt: new Date(apiData.createdAt),
      updatedAt: new Date(apiData.updatedAt),
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
          console.log('💾 Background update instructions in API:', instructions.id);
          
          const apiData: any = {};
          if (supabaseData.feeding_schedule !== undefined) apiData.feedingSchedule = supabaseData.feeding_schedule;
          if (supabaseData.nap_schedule !== undefined) apiData.napSchedule = supabaseData.nap_schedule;
          if (supabaseData.medication !== undefined) apiData.medication = supabaseData.medication;
          if (supabaseData.allergies !== undefined) apiData.allergies = supabaseData.allergies;
          if (supabaseData.emergency_contacts !== undefined) apiData.emergencyContacts = supabaseData.emergency_contacts;
          if (supabaseData.special_instructions !== undefined) apiData.specialInstructions = supabaseData.special_instructions;
          
          const result = await apiRequest<any>(API_ENDPOINTS.CHILD_INSTRUCTIONS(instructions.childId), {
            method: 'PUT',
            body: JSON.stringify(apiData),
          });

          if (result.success && result.data) {
            const apiData = result.data;
            const updatedInstructions = {
              id: apiData.id,
              childId: apiData.childId,
              parentId: apiData.parentId,
              feedingSchedule: apiData.feedingSchedule,
              napSchedule: apiData.napSchedule,
              bedtime: apiData.bedtime,
              dietaryRestrictions: apiData.dietaryRestrictions,
              allergies: apiData.allergies ? (typeof apiData.allergies === 'string' ? JSON.parse(apiData.allergies) : apiData.allergies) : [],
              medications: apiData.medications ? (typeof apiData.medications === 'string' ? JSON.parse(apiData.medications) : apiData.medications) : [],
              favoriteActivities: apiData.favoriteActivities ? (typeof apiData.favoriteActivities === 'string' ? JSON.parse(apiData.favoriteActivities) : apiData.favoriteActivities) : [],
              comfortItems: apiData.comfortItems ? (typeof apiData.comfortItems === 'string' ? JSON.parse(apiData.comfortItems) : apiData.comfortItems) : [],
              routines: apiData.routines,
              specialNeeds: apiData.specialNeeds,
              emergencyContacts: apiData.emergencyContacts ? (typeof apiData.emergencyContacts === 'string' ? JSON.parse(apiData.emergencyContacts) : apiData.emergencyContacts) : [],
              doctorInfo: apiData.doctorInfo ? (typeof apiData.doctorInfo === 'string' ? JSON.parse(apiData.doctorInfo) : apiData.doctorInfo) : null,
              additionalNotes: apiData.additionalNotes,
              createdAt: new Date(apiData.createdAt),
              updatedAt: new Date(apiData.updatedAt),
            };
            console.log('✅ Instructions updated in API:', updatedInstructions.id);
            
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
          } else {
            console.warn('⚠️ Background API update failed:', result.error?.message);
          }
        } catch (error: any) {
          console.warn('⚠️ Background API update error:', error.message);
        }
      })(); // IIFE - runs in background, doesn't block
    } else {
      // Create new - sync in background
      (async () => {
        try {
          console.log('💾 Background create instructions in API...');
          
          const apiData: any = {};
          if (supabaseData.feeding_schedule !== undefined) apiData.feedingSchedule = supabaseData.feeding_schedule;
          if (supabaseData.nap_schedule !== undefined) apiData.napSchedule = supabaseData.nap_schedule;
          if (supabaseData.medication !== undefined) apiData.medication = supabaseData.medication;
          if (supabaseData.allergies !== undefined) apiData.allergies = supabaseData.allergies;
          if (supabaseData.emergency_contacts !== undefined) apiData.emergencyContacts = supabaseData.emergency_contacts;
          if (supabaseData.special_instructions !== undefined) apiData.specialInstructions = supabaseData.special_instructions;
          
          const result = await apiRequest<any>(API_ENDPOINTS.CHILD_INSTRUCTIONS(instructions.childId), {
            method: 'PUT',
            body: JSON.stringify(apiData),
          });

          if (result.success && result.data) {
            const apiData = result.data;
            const createdInstructions = {
              id: apiData.id,
              childId: apiData.childId,
              parentId: apiData.parentId,
              feedingSchedule: apiData.feedingSchedule,
              napSchedule: apiData.napSchedule,
              bedtime: apiData.bedtime,
              dietaryRestrictions: apiData.dietaryRestrictions,
              allergies: apiData.allergies ? (typeof apiData.allergies === 'string' ? JSON.parse(apiData.allergies) : apiData.allergies) : [],
              medications: apiData.medications ? (typeof apiData.medications === 'string' ? JSON.parse(apiData.medications) : apiData.medications) : [],
              favoriteActivities: apiData.favoriteActivities ? (typeof apiData.favoriteActivities === 'string' ? JSON.parse(apiData.favoriteActivities) : apiData.favoriteActivities) : [],
              comfortItems: apiData.comfortItems ? (typeof apiData.comfortItems === 'string' ? JSON.parse(apiData.comfortItems) : apiData.comfortItems) : [],
              routines: apiData.routines,
              specialNeeds: apiData.specialNeeds,
              emergencyContacts: apiData.emergencyContacts ? (typeof apiData.emergencyContacts === 'string' ? JSON.parse(apiData.emergencyContacts) : apiData.emergencyContacts) : [],
              doctorInfo: apiData.doctorInfo ? (typeof apiData.doctorInfo === 'string' ? JSON.parse(apiData.doctorInfo) : apiData.doctorInfo) : null,
              additionalNotes: apiData.additionalNotes,
              createdAt: new Date(apiData.createdAt),
              updatedAt: new Date(apiData.updatedAt),
            };
            console.log('✅ Instructions created/updated in API:', createdInstructions.id);
            
            // Update AsyncStorage with real ID (replace temp ID)
            try {
              const { save, remove, STORAGE_KEYS } = await import('./local-storage.service');
              await remove(STORAGE_KEYS.CHILD_INSTRUCTIONS, tempId);
              await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
                ...createdInstructions,
                createdAt: createdInstructions.createdAt.getTime(),
                updatedAt: createdInstructions.updatedAt.getTime(),
              });
              console.log('✅ AsyncStorage updated with real ID from API');
            } catch (updateError) {
              console.warn('⚠️ Failed to update AsyncStorage:', updateError);
            }
          } else {
            console.warn('⚠️ Background API create failed:', result.error?.message);
          }
        } catch (error: any) {
          console.warn('⚠️ Background API create error:', error.message);
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
