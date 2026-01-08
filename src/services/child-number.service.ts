/**
 * Child Number Service - Supabase
 * Generates readable child numbers: c1, c2, c3...
 * 
 * Format:
 * - Child: c1, c2, c3...
 */

import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';

/**
 * Get the next child number
 */
export async function getNextChildNumber(): Promise<ServiceResult<string>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      // Fallback to local
      return { success: true, data: await getNextChildNumberFromLocal() };
    }

    const prefix = 'c';

    // Get all children to find the highest number
    const { data, error } = await supabase
      .from('children')
      .select('child_number');

    if (error) {
      console.warn('⚠️ Failed to fetch from Supabase, using local fallback:', error.message);
      return { success: true, data: await getNextChildNumberFromLocal() };
    }

    let nextNumber = 1;
    let maxNumber = 0;

    // Find the highest childNumber
    (data || []).forEach((row: any) => {
      const childNumber = row.child_number;
      
      if (childNumber && typeof childNumber === 'string') {
        // Extract number from format like "c1", "c2", "c3"
        const match = childNumber.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    });

    if (maxNumber > 0) {
      nextNumber = maxNumber + 1;
    }

    const childNumber = `${prefix}${nextNumber}`;

    return { success: true, data: childNumber };
  } catch (error: any) {
    // Fallback to local
    return { success: true, data: await getNextChildNumberFromLocal() };
  }
}

/**
 * Generate child number from AsyncStorage (fallback)
 */
export async function getNextChildNumberFromLocal(): Promise<string> {
  try {
    const { getAll, STORAGE_KEYS } = await import('./local-storage.service');

    const result = await getAll(STORAGE_KEYS.CHILDREN);
    
    if (!result.success || !result.data || result.data.length === 0) {
      return 'c1';
    }

    const prefix = 'c';
    
    // Find highest number
    let maxNumber = 0;
    for (const child of result.data) {
      if (child.childNumber && typeof child.childNumber === 'string') {
        const match = child.childNumber.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    }

    return `${prefix}${maxNumber + 1}`;
  } catch (error) {
    // Fallback to simple numbering
    return 'c1';
  }
}
