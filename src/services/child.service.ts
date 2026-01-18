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
  parentId: string,
  forceRefresh: boolean = false
): Promise<ServiceResult<Child[]>> {
  try {
    // If forceRefresh, skip AsyncStorage and go straight to API/Supabase
    if (!forceRefresh) {
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
            // Still fetch from API in background to sync, but return cached data immediately
            // This will be handled by the real-time sync
            return { success: true, data: children };
          }
        }
      } catch (localError: any) {
        console.warn('⚠️ Failed to load from AsyncStorage, trying Supabase:', localError.message);
      }
    } else {
      console.log('🔄 Force refresh: skipping AsyncStorage, fetching from API/Supabase');
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

          // Sync to AsyncStorage - IMPORTANT: Remove ALL children for this parent first, then save fresh ones
          // This ensures deleted children are removed
          try {
            const { save, getAll, remove, STORAGE_KEYS } = await import('./local-storage.service');
            
            // Get all existing children
            const existingResult = await getAll(STORAGE_KEYS.CHILDREN);
            if (existingResult.success && existingResult.data) {
              // Remove ALL children for this parent (including deleted ones)
              const childrenToRemove = (existingResult.data as any[])
                .filter((c: any) => c.parentId === parentId)
                .map((c: any) => c.id);
              
              for (const childId of childrenToRemove) {
                await remove(STORAGE_KEYS.CHILDREN, childId);
              }
              if (childrenToRemove.length > 0) {
                console.log(`🗑️ Removed ${childrenToRemove.length} child(ren) from AsyncStorage (clearing stale data)`);
              }
            }
            
            // Save fresh children from Supabase
            for (const child of children) {
              await save(STORAGE_KEYS.CHILDREN, {
                ...child,
                createdAt: child.createdAt.getTime(),
                updatedAt: child.updatedAt.getTime(),
                dateOfBirth: child.dateOfBirth ? child.dateOfBirth.getTime() : null,
              });
            }
            console.log(`✅ Synced ${children.length} children from Supabase to AsyncStorage (replaced all)`);
          } catch (syncError: any) {
            console.warn('⚠️ Failed to sync children to AsyncStorage:', syncError.message);
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

    // Sync to AsyncStorage - IMPORTANT: Remove ALL children for this parent first, then save fresh ones
    // This ensures deleted children are removed
    try {
      const { save, getAll, remove, STORAGE_KEYS } = await import('./local-storage.service');
      
      // Get all existing children
      const existingResult = await getAll(STORAGE_KEYS.CHILDREN);
      if (existingResult.success && existingResult.data) {
        // Remove ALL children for this parent (including deleted ones)
        const childrenToRemove = (existingResult.data as any[])
          .filter((c: any) => c.parentId === parentId)
          .map((c: any) => c.id);
        
        for (const childId of childrenToRemove) {
          await remove(STORAGE_KEYS.CHILDREN, childId);
        }
        if (childrenToRemove.length > 0) {
          console.log(`🗑️ Removed ${childrenToRemove.length} child(ren) from AsyncStorage (clearing stale data)`);
        }
      }
      
      // Save fresh children from API
      for (const child of children) {
        await save(STORAGE_KEYS.CHILDREN, {
          ...child,
          createdAt: child.createdAt.getTime(),
          updatedAt: child.updatedAt.getTime(),
          dateOfBirth: child.dateOfBirth ? child.dateOfBirth.getTime() : null,
        });
      }
      console.log(`✅ Synced ${children.length} children from API to AsyncStorage (replaced all)`);
    } catch (syncError: any) {
      console.warn('⚠️ Failed to sync children to AsyncStorage:', syncError.message);
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
    // Try AsyncStorage first
    try {
      const { getAll, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getAll(STORAGE_KEYS.CHILD_INSTRUCTIONS);
      if (result.success && result.data) {
        const childInst = (result.data as any[]).find((inst: any) => inst.childId === childId);
        if (childInst) {
          const instructions: ChildInstructions = {
            ...childInst,
            createdAt: new Date(childInst.createdAt || Date.now()),
            updatedAt: new Date(childInst.updatedAt || Date.now()),
            allergies: childInst.allergies ? (typeof childInst.allergies === 'string' ? JSON.parse(childInst.allergies) : childInst.allergies) : undefined,
            medications: childInst.medications ? (typeof childInst.medications === 'string' ? JSON.parse(childInst.medications) : childInst.medications) : undefined,
            favoriteActivities: childInst.favoriteActivities ? (typeof childInst.favoriteActivities === 'string' ? JSON.parse(childInst.favoriteActivities) : childInst.favoriteActivities) : undefined,
            comfortItems: childInst.comfortItems ? (typeof childInst.comfortItems === 'string' ? JSON.parse(childInst.comfortItems) : childInst.comfortItems) : undefined,
            emergencyContacts: childInst.emergencyContacts ? (typeof childInst.emergencyContacts === 'string' ? JSON.parse(childInst.emergencyContacts) : childInst.emergencyContacts) : undefined,
            doctorInfo: childInst.doctorInfo ? (typeof childInst.doctorInfo === 'string' ? JSON.parse(childInst.doctorInfo) : childInst.doctorInfo) : undefined,
          };
          console.log('✅ Loaded instructions from AsyncStorage');
          return { success: true, data: instructions };
        }
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to load from AsyncStorage, trying API:', localError.message);
    }

    // Try API, fallback to Supabase
    const result = await apiRequest<any>(API_ENDPOINTS.CHILD_INSTRUCTIONS(childId));

    if (!result.success) {
      // If not found, try Supabase fallback
      const errorCode = result.error?.code as string;
      if (errorCode === 'CHILD_NOT_FOUND' || errorCode === 'DOCUMENT_NOT_FOUND') {
        // Try Supabase fallback
        if (isSupabaseConfigured() && supabase) {
          try {
            const { data: supabaseData, error: supabaseError } = await supabase
              .from('child_instructions')
              .select('*')
              .eq('child_id', childId)
              .maybeSingle();
            
            if (supabaseError) {
              console.warn('⚠️ Supabase fetch failed:', supabaseError);
        return { success: true, data: null };
      }
            
            if (!supabaseData) {
              return { success: true, data: null };
            }
            
            // Parse JSON fields and map from DB columns to UI fields
            // Handle both old format (medication TEXT, allergies TEXT) and new format (medications JSONB, allergies JSONB)
            let medications: Array<{name: string; dosage: string; time: string}> | undefined;
            if (supabaseData.medications) {
              // New format: JSONB array
              medications = Array.isArray(supabaseData.medications) ? supabaseData.medications : undefined;
            } else if (supabaseData.medication) {
              // Old format: TEXT (JSON string) - backward compatibility
              try {
                const parsed = typeof supabaseData.medication === 'string' ? JSON.parse(supabaseData.medication) : supabaseData.medication;
                medications = Array.isArray(parsed) ? parsed : undefined;
              } catch (e) {
                // Ignore parse errors
              }
            }
            
            let allergies: string[] | undefined;
            if (supabaseData.allergies) {
              // New format: JSONB array or old format: TEXT (JSON string)
              if (Array.isArray(supabaseData.allergies)) {
                allergies = supabaseData.allergies;
              } else if (typeof supabaseData.allergies === 'string') {
                try {
                  const parsed = JSON.parse(supabaseData.allergies);
                  allergies = Array.isArray(parsed) ? parsed : undefined;
                } catch (e) {
                  // Ignore
                }
              }
            }
            
            let favoriteActivities: string[] | undefined;
            if (supabaseData.favorite_activities) {
              favoriteActivities = Array.isArray(supabaseData.favorite_activities) 
                ? supabaseData.favorite_activities 
                : (typeof supabaseData.favorite_activities === 'string' ? JSON.parse(supabaseData.favorite_activities) : undefined);
            }
            
            let comfortItems: string[] | undefined;
            if (supabaseData.comfort_items) {
              comfortItems = Array.isArray(supabaseData.comfort_items) 
                ? supabaseData.comfort_items 
                : (typeof supabaseData.comfort_items === 'string' ? JSON.parse(supabaseData.comfort_items) : undefined);
            }
            
            let doctorInfo: {name: string; phone: string; clinic?: string} | undefined;
            if (supabaseData.doctor_info) {
              doctorInfo = typeof supabaseData.doctor_info === 'object' 
                ? supabaseData.doctor_info 
                : (typeof supabaseData.doctor_info === 'string' ? JSON.parse(supabaseData.doctor_info) : undefined);
            }
            
            const instructions: ChildInstructions = {
              id: supabaseData.id,
              childId: supabaseData.child_id,
              parentId: supabaseData.parent_id,
              feedingSchedule: supabaseData.feeding_schedule,
              napSchedule: supabaseData.nap_schedule,
              bedtime: supabaseData.bedtime,
              dietaryRestrictions: supabaseData.dietary_restrictions,
              medications,
              allergies,
              favoriteActivities,
              comfortItems,
              routines: supabaseData.routines,
              specialNeeds: supabaseData.special_needs,
              emergencyContacts: supabaseData.emergency_contacts ? (typeof supabaseData.emergency_contacts === 'string' ? JSON.parse(supabaseData.emergency_contacts) : supabaseData.emergency_contacts) : undefined,
              doctorInfo,
              additionalNotes: supabaseData.additional_notes || supabaseData.special_instructions || undefined,
              createdAt: new Date(supabaseData.created_at),
              updatedAt: new Date(supabaseData.updated_at),
            };
            
            // Save to AsyncStorage
            try {
              const { save, STORAGE_KEYS } = await import('./local-storage.service');
              await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
                ...instructions,
                createdAt: instructions.createdAt.getTime(),
                updatedAt: instructions.updatedAt.getTime(),
              });
            } catch (storageError) {
              console.warn('⚠️ Failed to save to AsyncStorage:', storageError);
            }
            
            console.log('✅ Loaded instructions from Supabase (fallback)');
            return { success: true, data: instructions };
          } catch (supabaseError: any) {
            console.warn('⚠️ Supabase fallback failed:', supabaseError);
            return { success: true, data: null };
          }
        }
        return { success: true, data: null };
      }
      
      // Try Supabase fallback for other errors
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: supabaseData, error: supabaseError } = await supabase
            .from('child_instructions')
            .select('*')
            .eq('child_id', childId)
            .maybeSingle();
          
          if (supabaseError) {
            return { success: true, data: null };
          }
          
          if (!supabaseData) {
            return { success: true, data: null };
          }
          
          // Parse JSON fields and map from DB columns to UI fields (handle both old and new formats)
          let medications: Array<{name: string; dosage: string; time: string}> | undefined;
          if (supabaseData.medications) {
            medications = Array.isArray(supabaseData.medications) ? supabaseData.medications : undefined;
          } else if (supabaseData.medication) {
            // Old format fallback
            try {
              const parsed = typeof supabaseData.medication === 'string' ? JSON.parse(supabaseData.medication) : supabaseData.medication;
              medications = Array.isArray(parsed) ? parsed : undefined;
            } catch (e) {
              // Ignore
            }
          }
          
          let allergies: string[] | undefined;
          if (supabaseData.allergies) {
            if (Array.isArray(supabaseData.allergies)) {
              allergies = supabaseData.allergies;
            } else if (typeof supabaseData.allergies === 'string') {
              try {
                const parsed = JSON.parse(supabaseData.allergies);
                allergies = Array.isArray(parsed) ? parsed : undefined;
              } catch (e) {
                // Ignore
              }
            }
          }
          
          let favoriteActivities: string[] | undefined;
          if (supabaseData.favorite_activities) {
            favoriteActivities = Array.isArray(supabaseData.favorite_activities) 
              ? supabaseData.favorite_activities 
              : (typeof supabaseData.favorite_activities === 'string' ? JSON.parse(supabaseData.favorite_activities) : undefined);
          }
          
          let comfortItems: string[] | undefined;
          if (supabaseData.comfort_items) {
            comfortItems = Array.isArray(supabaseData.comfort_items) 
              ? supabaseData.comfort_items 
              : (typeof supabaseData.comfort_items === 'string' ? JSON.parse(supabaseData.comfort_items) : undefined);
          }
          
          let doctorInfo: {name: string; phone: string; clinic?: string} | undefined;
          if (supabaseData.doctor_info) {
            doctorInfo = typeof supabaseData.doctor_info === 'object' 
              ? supabaseData.doctor_info 
              : (typeof supabaseData.doctor_info === 'string' ? JSON.parse(supabaseData.doctor_info) : undefined);
          }
          
          const instructions: ChildInstructions = {
            id: supabaseData.id,
            childId: supabaseData.child_id,
            parentId: supabaseData.parent_id,
            feedingSchedule: supabaseData.feeding_schedule,
            napSchedule: supabaseData.nap_schedule,
            bedtime: supabaseData.bedtime,
            dietaryRestrictions: supabaseData.dietary_restrictions,
            medications,
            allergies,
            favoriteActivities,
            comfortItems,
            routines: supabaseData.routines,
            specialNeeds: supabaseData.special_needs,
            emergencyContacts: supabaseData.emergency_contacts ? (typeof supabaseData.emergency_contacts === 'string' ? JSON.parse(supabaseData.emergency_contacts) : supabaseData.emergency_contacts) : undefined,
            doctorInfo,
            additionalNotes: supabaseData.additional_notes || supabaseData.special_instructions || undefined,
            createdAt: new Date(supabaseData.created_at),
            updatedAt: new Date(supabaseData.updated_at),
          };
          
          console.log('✅ Loaded instructions from Supabase (API fallback)');
          return { success: true, data: instructions };
        } catch (supabaseError: any) {
          return { success: true, data: null };
        }
      }
      
      return result;
    }

    const apiData = result.data;
    
    // Handle empty instructions (id is empty string)
    if (!apiData.id || apiData.id === '') {
      return { success: true, data: null };
    }

    // Parse JSON fields and map from API response to UI fields
    // API returns: feedingSchedule, napSchedule, medication (string), allergies (string), emergencyContacts (dict), specialInstructions (string)
    let medications: Array<{name: string; dosage: string; time: string}> | undefined;
    try {
      if (apiData.medication) {
        const parsed = typeof apiData.medication === 'string' ? JSON.parse(apiData.medication) : apiData.medication;
        medications = Array.isArray(parsed) ? parsed : undefined;
      }
    } catch (e) {
      // If parsing fails, medication might be plain text - ignore
    }
    
    let allergies: string[] | undefined;
    try {
      if (apiData.allergies) {
        const parsed = typeof apiData.allergies === 'string' ? JSON.parse(apiData.allergies) : apiData.allergies;
        allergies = Array.isArray(parsed) ? parsed : undefined;
      }
    } catch (e) {
      // If parsing fails, allergies might be plain text - ignore
    }
    
    const instructions: ChildInstructions = {
      id: apiData.id,
      childId: apiData.childId,
      parentId: apiData.parentId,
      feedingSchedule: apiData.feedingSchedule,
      napSchedule: apiData.napSchedule,
      medications,
      allergies,
      emergencyContacts: apiData.emergencyContacts ? (typeof apiData.emergencyContacts === 'string' ? JSON.parse(apiData.emergencyContacts) : apiData.emergencyContacts) : undefined,
      additionalNotes: apiData.specialInstructions || undefined,
      createdAt: new Date(apiData.createdAt),
      updatedAt: new Date(apiData.updatedAt),
    };

    // Save to AsyncStorage
    try {
      const { save, STORAGE_KEYS } = await import('./local-storage.service');
      await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
        ...instructions,
        createdAt: instructions.createdAt.getTime(),
        updatedAt: instructions.updatedAt.getTime(),
      });
    } catch (storageError) {
      console.warn('⚠️ Failed to save to AsyncStorage:', storageError);
    }

    return { success: true, data: instructions };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}

/**
 * Get all child instructions for a parent
 */
export async function getParentInstructions(
  parentId: string
): Promise<ServiceResult<Record<string, ChildInstructions>>> {
  try {
    // Try AsyncStorage first
    try {
      const { getAll, STORAGE_KEYS } = await import('./local-storage.service');
      const result = await getAll(STORAGE_KEYS.CHILD_INSTRUCTIONS);
      if (result.success && result.data) {
        const parentInsts = (result.data as any[]).filter((inst: any) => inst.parentId === parentId);
        if (parentInsts.length > 0) {
          const instructionsMap: Record<string, ChildInstructions> = {};
          for (const inst of parentInsts) {
            instructionsMap[inst.childId] = {
              ...inst,
              createdAt: new Date(inst.createdAt || Date.now()),
              updatedAt: new Date(inst.updatedAt || Date.now()),
              allergies: inst.allergies ? (typeof inst.allergies === 'string' ? JSON.parse(inst.allergies) : inst.allergies) : undefined,
              medications: inst.medications ? (typeof inst.medications === 'string' ? JSON.parse(inst.medications) : inst.medications) : undefined,
              favoriteActivities: inst.favoriteActivities ? (typeof inst.favoriteActivities === 'string' ? JSON.parse(inst.favoriteActivities) : inst.favoriteActivities) : undefined,
              comfortItems: inst.comfortItems ? (typeof inst.comfortItems === 'string' ? JSON.parse(inst.comfortItems) : inst.comfortItems) : undefined,
              emergencyContacts: inst.emergencyContacts ? (typeof inst.emergencyContacts === 'string' ? JSON.parse(inst.emergencyContacts) : inst.emergencyContacts) : undefined,
              doctorInfo: inst.doctorInfo ? (typeof inst.doctorInfo === 'string' ? JSON.parse(inst.doctorInfo) : inst.doctorInfo) : undefined,
            };
          }
          console.log(`✅ Loaded ${Object.keys(instructionsMap).length} instructions from AsyncStorage`);
          return { success: true, data: instructionsMap };
        }
      }
    } catch (localError: any) {
      console.warn('⚠️ Failed to load from AsyncStorage, trying Supabase:', localError.message);
    }

    // Try Supabase directly
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: instructionsData, error: supabaseError } = await supabase
          .from('child_instructions')
          .select('*')
          .eq('parent_id', parentId);

        if (supabaseError) {
          console.error('❌ Supabase fetch failed:', supabaseError);
          return {
            success: false,
            error: {
              code: ErrorCode.DB_SELECT_ERROR,
              message: `Failed to fetch instructions: ${supabaseError.message}`,
            },
          };
        }

        const instructionsMap: Record<string, ChildInstructions> = {};
        for (const inst of instructionsData || []) {
          // Parse JSONB fields (handle both old TEXT and new JSONB formats)
          let medications: Array<{name: string; dosage: string; time: string}> | undefined;
          if (inst.medications) {
            if (Array.isArray(inst.medications)) {
              medications = inst.medications;
            } else if (typeof inst.medications === 'string') {
              try {
                const parsed = JSON.parse(inst.medications);
                medications = Array.isArray(parsed) ? parsed : undefined;
              } catch (e) {
                // Ignore parse errors
              }
            }
          } else if (inst.medication) {
            // Old format fallback
            try {
              const parsed = typeof inst.medication === 'string' ? JSON.parse(inst.medication) : inst.medication;
              medications = Array.isArray(parsed) ? parsed : undefined;
            } catch (e) {
              // Ignore
            }
          }
          
          let allergies: string[] | undefined;
          if (inst.allergies) {
            if (Array.isArray(inst.allergies)) {
              allergies = inst.allergies;
            } else if (typeof inst.allergies === 'string') {
              try {
                const parsed = JSON.parse(inst.allergies);
                allergies = Array.isArray(parsed) ? parsed : undefined;
              } catch (e) {
                // Ignore
              }
            }
          }
          
          let favoriteActivities: string[] | undefined;
          if (inst.favorite_activities) {
            favoriteActivities = Array.isArray(inst.favorite_activities) 
              ? inst.favorite_activities 
              : (typeof inst.favorite_activities === 'string' ? JSON.parse(inst.favorite_activities) : undefined);
          }
          
          let comfortItems: string[] | undefined;
          if (inst.comfort_items) {
            comfortItems = Array.isArray(inst.comfort_items) 
              ? inst.comfort_items 
              : (typeof inst.comfort_items === 'string' ? JSON.parse(inst.comfort_items) : undefined);
          }
          
          let doctorInfo: {name: string; phone: string; clinic?: string} | undefined;
          if (inst.doctor_info) {
            doctorInfo = typeof inst.doctor_info === 'object' 
              ? inst.doctor_info 
              : (typeof inst.doctor_info === 'string' ? JSON.parse(inst.doctor_info) : undefined);
          }
          
          instructionsMap[inst.child_id] = {
            id: inst.id,
            childId: inst.child_id,
            parentId: inst.parent_id,
            feedingSchedule: inst.feeding_schedule,
            napSchedule: inst.nap_schedule,
            bedtime: inst.bedtime,
            dietaryRestrictions: inst.dietary_restrictions,
            medications,
            allergies,
            favoriteActivities,
            comfortItems,
            routines: inst.routines,
            specialNeeds: inst.special_needs,
            emergencyContacts: inst.emergency_contacts ? (typeof inst.emergency_contacts === 'string' ? JSON.parse(inst.emergency_contacts) : inst.emergency_contacts) : undefined,
            doctorInfo,
            additionalNotes: inst.additional_notes || inst.special_instructions || undefined,
            createdAt: new Date(inst.created_at),
            updatedAt: new Date(inst.updated_at),
          };
        }

        // Save to AsyncStorage
        try {
          const { save, STORAGE_KEYS } = await import('./local-storage.service');
          for (const inst of Object.values(instructionsMap)) {
            await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
              ...inst,
              createdAt: inst.createdAt.getTime(),
              updatedAt: inst.updatedAt.getTime(),
            });
          }
        } catch (storageError) {
          console.warn('⚠️ Failed to save to AsyncStorage:', storageError);
        }

        console.log(`✅ Loaded ${Object.keys(instructionsMap).length} instructions from Supabase`);
        return { success: true, data: instructionsMap };
      } catch (error: any) {
        return {
          success: false,
          error: handleUnexpectedError(error),
        };
      }
    }

    return {
      success: false,
      error: {
        code: ErrorCode.DB_NOT_AVAILABLE,
        message: 'Supabase is not configured',
      },
    };
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

    // Prepare Supabase data - map to actual DB columns
    // DB now has all columns: feeding_schedule, nap_schedule, bedtime, dietary_restrictions,
    // medications (JSONB), allergies (JSONB), favorite_activities (JSONB), comfort_items (JSONB),
    // routines, special_needs, emergency_contacts (JSONB), doctor_info (JSONB), additional_notes
    const supabaseData: any = {
      child_id: instructionsData.childId,
      parent_id: instructionsData.parentId,
      feeding_schedule: instructionsData.feedingSchedule || null,
      nap_schedule: instructionsData.napSchedule || null,
      bedtime: instructionsData.bedtime || null,
      dietary_restrictions: instructionsData.dietaryRestrictions || null,
      // Map medications array to medications JSONB
      medications: instructionsData.medications && instructionsData.medications.length > 0
        ? instructionsData.medications
        : null,
      // Map allergies array to allergies JSONB
      allergies: instructionsData.allergies && instructionsData.allergies.length > 0
        ? instructionsData.allergies
        : null,
      // Map favoriteActivities array to favorite_activities JSONB
      favorite_activities: instructionsData.favoriteActivities && instructionsData.favoriteActivities.length > 0
        ? instructionsData.favoriteActivities
        : null,
      // Map comfortItems array to comfort_items JSONB
      comfort_items: instructionsData.comfortItems && instructionsData.comfortItems.length > 0
        ? instructionsData.comfortItems
        : null,
      routines: instructionsData.routines || null,
      special_needs: instructionsData.specialNeeds || null,
      // Map emergencyContacts to emergency_contacts JSONB
      emergency_contacts: instructionsData.emergencyContacts || null,
      // Map doctorInfo to doctor_info JSONB
      doctor_info: instructionsData.doctorInfo || null,
      additional_notes: instructionsData.additionalNotes || null,
      // Keep special_instructions for backward compatibility (can be removed later)
      special_instructions: instructionsData.specialNeeds || instructionsData.additionalNotes || null,
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

    // Try API first, fallback to direct Supabase if API fails
    const isUpdate = !!instructions.id && !instructions.id.startsWith('temp_');
    
    try {
      if (isUpdate) {
        console.log('💾 Updating instructions in API...');
      } else {
        console.log('💾 Creating instructions in API...');
      }
      
      // Prepare API data - API expects same fields as DB (updated with new columns)
      const apiData: any = {
        feedingSchedule: supabaseData.feeding_schedule,
        napSchedule: supabaseData.nap_schedule,
        bedtime: supabaseData.bedtime,
        dietaryRestrictions: supabaseData.dietary_restrictions,
        medications: supabaseData.medications,
        allergies: supabaseData.allergies,
        favoriteActivities: supabaseData.favorite_activities,
        comfortItems: supabaseData.comfort_items,
        routines: supabaseData.routines,
        specialNeeds: supabaseData.special_needs,
        emergencyContacts: supabaseData.emergency_contacts,
        doctorInfo: supabaseData.doctor_info,
        additionalNotes: supabaseData.additional_notes,
        // Keep for backward compatibility
        specialInstructions: supabaseData.special_instructions,
      };
          
          const result = await apiRequest<any>(API_ENDPOINTS.CHILD_INSTRUCTIONS(instructions.childId), {
            method: 'PUT',
            body: JSON.stringify(apiData),
          });

      if (!result.success) {
        console.warn('⚠️ API save failed, trying direct Supabase save...');
        
        // Fallback to direct Supabase save - always use upsert to handle both insert and update
        if (isSupabaseConfigured() && supabase) {
          try {
            // Use upsert to handle both insert and update cases based on unique constraint
            const { data: upsertData, error: upsertError } = await supabase
              .from('child_instructions')
              .upsert(supabaseData, {
                onConflict: 'child_id,parent_id',
                ignoreDuplicates: false
              })
              .select()
              .single();
            
            if (upsertError) {
              throw upsertError;
            }
            
            if (upsertData) {
              // Parse JSON fields and map from DB columns to UI fields (handle both old and new formats)
              let medications: Array<{name: string; dosage: string; time: string}> | undefined;
              if (upsertData.medications) {
                medications = Array.isArray(upsertData.medications) ? upsertData.medications : undefined;
              } else if (upsertData.medication) {
                try {
                  const parsed = typeof upsertData.medication === 'string' ? JSON.parse(upsertData.medication) : upsertData.medication;
                  medications = Array.isArray(parsed) ? parsed : undefined;
                } catch (e) {
                  // Ignore
                }
              }
              
              let allergies: string[] | undefined;
              if (upsertData.allergies) {
                allergies = Array.isArray(upsertData.allergies) 
                  ? upsertData.allergies 
                  : (typeof upsertData.allergies === 'string' ? JSON.parse(upsertData.allergies) : undefined);
              }
              
              let favoriteActivities: string[] | undefined;
              if (upsertData.favorite_activities) {
                favoriteActivities = Array.isArray(upsertData.favorite_activities) 
                  ? upsertData.favorite_activities 
                  : (typeof upsertData.favorite_activities === 'string' ? JSON.parse(upsertData.favorite_activities) : undefined);
              }
              
              let comfortItems: string[] | undefined;
              if (upsertData.comfort_items) {
                comfortItems = Array.isArray(upsertData.comfort_items) 
                  ? upsertData.comfort_items 
                  : (typeof upsertData.comfort_items === 'string' ? JSON.parse(upsertData.comfort_items) : undefined);
              }
              
              let doctorInfo: {name: string; phone: string; clinic?: string} | undefined;
              if (upsertData.doctor_info) {
                doctorInfo = typeof upsertData.doctor_info === 'object' 
                  ? upsertData.doctor_info 
                  : (typeof upsertData.doctor_info === 'string' ? JSON.parse(upsertData.doctor_info) : undefined);
              }
              
              const savedInstructions: ChildInstructions = {
                id: upsertData.id,
                childId: upsertData.child_id,
                parentId: upsertData.parent_id,
                feedingSchedule: upsertData.feeding_schedule,
                napSchedule: upsertData.nap_schedule,
                bedtime: upsertData.bedtime,
                dietaryRestrictions: upsertData.dietary_restrictions,
                medications,
                allergies,
                favoriteActivities,
                comfortItems,
                routines: upsertData.routines,
                specialNeeds: upsertData.special_needs,
                emergencyContacts: upsertData.emergency_contacts ? (typeof upsertData.emergency_contacts === 'string' ? JSON.parse(upsertData.emergency_contacts) : upsertData.emergency_contacts) : undefined,
                doctorInfo,
                additionalNotes: upsertData.additional_notes || upsertData.special_instructions || undefined,
                createdAt: new Date(upsertData.created_at),
                updatedAt: new Date(upsertData.updated_at),
            };
            
              // Update AsyncStorage with real data
            try {
                const { save, remove, STORAGE_KEYS } = await import('./local-storage.service');
                if (!isUpdate) {
                  await remove(STORAGE_KEYS.CHILD_INSTRUCTIONS, tempId);
                }
              await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
                  ...savedInstructions,
                  createdAt: savedInstructions.createdAt.getTime(),
                  updatedAt: savedInstructions.updatedAt.getTime(),
              });
              } catch (storageError) {
                console.warn('⚠️ Failed to update AsyncStorage:', storageError);
            }
              
              console.log('✅ Instructions saved in Supabase (direct fallback)');
              return { success: true, data: savedInstructions };
          }
          } catch (supabaseError: any) {
            console.error('❌ Direct Supabase save failed:', supabaseError);
            return {
              success: false,
              error: {
                code: ErrorCode.DB_INSERT_ERROR,
                message: `Failed to save instructions: ${supabaseError.message}`,
              },
            };
          }
    } else {
          return {
            success: false,
            error: {
              code: ErrorCode.DB_NOT_AVAILABLE,
              message: 'API save failed and Supabase is not configured',
            },
          };
        }
      }
      
      // API succeeded - parse response and map to UI fields
      if (result.success && result.data) {
        const apiData = result.data;
        
        // Parse all fields (handle both old and new API formats)
        let medications: Array<{name: string; dosage: string; time: string}> | undefined;
        if (apiData.medications) {
          medications = Array.isArray(apiData.medications) ? apiData.medications : undefined;
        } else if (apiData.medication) {
          try {
            const parsed = typeof apiData.medication === 'string' ? JSON.parse(apiData.medication) : apiData.medication;
            medications = Array.isArray(parsed) ? parsed : undefined;
          } catch (e) {
            // Ignore
          }
        }
        
        let allergies: string[] | undefined;
        if (apiData.allergies) {
          allergies = Array.isArray(apiData.allergies) 
            ? apiData.allergies 
            : (typeof apiData.allergies === 'string' ? JSON.parse(apiData.allergies) : undefined);
        }
        
        let favoriteActivities: string[] | undefined;
        if (apiData.favoriteActivities) {
          favoriteActivities = Array.isArray(apiData.favoriteActivities) 
            ? apiData.favoriteActivities 
            : (typeof apiData.favoriteActivities === 'string' ? JSON.parse(apiData.favoriteActivities) : undefined);
        }
        
        let comfortItems: string[] | undefined;
        if (apiData.comfortItems) {
          comfortItems = Array.isArray(apiData.comfortItems) 
            ? apiData.comfortItems 
            : (typeof apiData.comfortItems === 'string' ? JSON.parse(apiData.comfortItems) : undefined);
        }
        
        let doctorInfo: {name: string; phone: string; clinic?: string} | undefined;
        if (apiData.doctorInfo) {
          doctorInfo = typeof apiData.doctorInfo === 'object' 
            ? apiData.doctorInfo 
            : (typeof apiData.doctorInfo === 'string' ? JSON.parse(apiData.doctorInfo) : undefined);
        }
        
        const savedInstructions: ChildInstructions = {
              id: apiData.id,
              childId: apiData.childId,
              parentId: apiData.parentId,
              feedingSchedule: apiData.feedingSchedule,
              napSchedule: apiData.napSchedule,
              bedtime: apiData.bedtime,
              dietaryRestrictions: apiData.dietaryRestrictions,
          medications,
          allergies,
          favoriteActivities,
          comfortItems,
              routines: apiData.routines,
              specialNeeds: apiData.specialNeeds,
          emergencyContacts: apiData.emergencyContacts ? (typeof apiData.emergencyContacts === 'string' ? JSON.parse(apiData.emergencyContacts) : apiData.emergencyContacts) : undefined,
          doctorInfo,
          additionalNotes: apiData.additionalNotes || apiData.specialInstructions || undefined,
              createdAt: new Date(apiData.createdAt),
              updatedAt: new Date(apiData.updatedAt),
            };
            
        // Update AsyncStorage with real data
            try {
              const { save, remove, STORAGE_KEYS } = await import('./local-storage.service');
          if (!isUpdate) {
              await remove(STORAGE_KEYS.CHILD_INSTRUCTIONS, tempId);
          }
              await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
            ...savedInstructions,
            createdAt: savedInstructions.createdAt.getTime(),
            updatedAt: savedInstructions.updatedAt.getTime(),
              });
        } catch (storageError) {
          console.warn('⚠️ Failed to update AsyncStorage:', storageError);
            }
        
        console.log('✅ Instructions saved to API');
        return { success: true, data: savedInstructions };
          }
        } catch (error: any) {
      console.error('❌ Save instructions error:', error);
      
      // Try Supabase fallback even on exception - use upsert to handle both insert and update
      if (isSupabaseConfigured() && supabase) {
        try {
          // Always use upsert to handle both insert and update cases
          const { data: upsertData, error: upsertError } = await supabase
            .from('child_instructions')
            .upsert(supabaseData, {
              onConflict: 'child_id,parent_id',
              ignoreDuplicates: false
            })
            .select()
            .single();
          
          if (upsertError) throw upsertError;
          
          if (upsertData) {
            // Parse JSON fields and map from DB columns to UI fields (handle both old and new formats)
            let medications: Array<{name: string; dosage: string; time: string}> | undefined;
            if (upsertData.medications) {
              medications = Array.isArray(upsertData.medications) ? upsertData.medications : undefined;
            } else if (upsertData.medication) {
              try {
                const parsed = typeof upsertData.medication === 'string' ? JSON.parse(upsertData.medication) : upsertData.medication;
                medications = Array.isArray(parsed) ? parsed : undefined;
              } catch (e) {
                // Ignore
              }
            }
            
            let allergies: string[] | undefined;
            if (upsertData.allergies) {
              allergies = Array.isArray(upsertData.allergies) 
                ? upsertData.allergies 
                : (typeof upsertData.allergies === 'string' ? JSON.parse(upsertData.allergies) : undefined);
            }
            
            let favoriteActivities: string[] | undefined;
            if (upsertData.favorite_activities) {
              favoriteActivities = Array.isArray(upsertData.favorite_activities) 
                ? upsertData.favorite_activities 
                : (typeof upsertData.favorite_activities === 'string' ? JSON.parse(upsertData.favorite_activities) : undefined);
            }
            
            let comfortItems: string[] | undefined;
            if (upsertData.comfort_items) {
              comfortItems = Array.isArray(upsertData.comfort_items) 
                ? upsertData.comfort_items 
                : (typeof upsertData.comfort_items === 'string' ? JSON.parse(upsertData.comfort_items) : undefined);
        }
            
            let doctorInfo: {name: string; phone: string; clinic?: string} | undefined;
            if (upsertData.doctor_info) {
              doctorInfo = typeof upsertData.doctor_info === 'object' 
                ? upsertData.doctor_info 
                : (typeof upsertData.doctor_info === 'string' ? JSON.parse(upsertData.doctor_info) : undefined);
            }
            
            const savedInstructions: ChildInstructions = {
              id: upsertData.id,
              childId: upsertData.child_id,
              parentId: upsertData.parent_id,
              feedingSchedule: upsertData.feeding_schedule,
              napSchedule: upsertData.nap_schedule,
              bedtime: upsertData.bedtime,
              dietaryRestrictions: upsertData.dietary_restrictions,
              medications,
              allergies,
              favoriteActivities,
              comfortItems,
              routines: upsertData.routines,
              specialNeeds: upsertData.special_needs,
              emergencyContacts: upsertData.emergency_contacts ? (typeof upsertData.emergency_contacts === 'string' ? JSON.parse(upsertData.emergency_contacts) : upsertData.emergency_contacts) : undefined,
              doctorInfo,
              additionalNotes: upsertData.additional_notes || upsertData.special_instructions || undefined,
              createdAt: new Date(upsertData.created_at),
              updatedAt: new Date(upsertData.updated_at),
            };
            
            // Update AsyncStorage
            try {
              const { save, remove, STORAGE_KEYS } = await import('./local-storage.service');
              if (!isUpdate) {
                await remove(STORAGE_KEYS.CHILD_INSTRUCTIONS, tempId);
              }
              await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
                ...savedInstructions,
                createdAt: savedInstructions.createdAt.getTime(),
                updatedAt: savedInstructions.updatedAt.getTime(),
              });
            } catch (storageError) {
              console.warn('⚠️ Failed to update AsyncStorage:', storageError);
            }
            
            console.log('✅ Instructions saved in Supabase (exception fallback)');
            return { success: true, data: savedInstructions };
          }
        } catch (supabaseError: any) {
          return {
            success: false,
            error: {
              code: ErrorCode.DB_INSERT_ERROR,
              message: `Failed to save instructions: ${supabaseError.message}`,
            },
          };
        }
      }
      
      return {
        success: false,
        error: {
          code: ErrorCode.DB_INSERT_ERROR,
          message: `Failed to save instructions: ${error.message}`,
        },
      };
    }

    // Should not reach here, but fallback
    return { success: true, data: savedInstructions };
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
