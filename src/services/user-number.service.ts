/**
 * User Number Service - Supabase
 * Generates readable user numbers: p1, p2, b1, b2, a1, a2
 * 
 * Format:
 * - Parent: p1, p2, p3...
 * - Babysitter: b1, b2, b3...
 * - Admin: a1, a2, a3...
 */

import { UserRole } from '@/src/config/constants';
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { ErrorCode, ServiceResult } from '@/src/types/error.types';

/**
 * Get the next user number for a role
 */
export async function getNextUserNumber(role: UserRole): Promise<ServiceResult<string>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      // Fallback to local
      return { success: true, data: await getNextUserNumberFromLocal(role) };
    }

    // Role prefix mapping
    const rolePrefix: Record<UserRole, string> = {
      parent: 'p',
      babysitter: 'b',
      admin: 'a',
    };

    const prefix = rolePrefix[role] || 'u';

    // Get all users with this role to find the highest number
    const { data, error } = await supabase
      .from('users')
      .select('user_number')
      .eq('role', role);

    if (error) {
      console.warn('⚠️ Failed to fetch from Supabase, using local fallback:', error.message);
      return { success: true, data: await getNextUserNumberFromLocal(role) };
    }

    let nextNumber = 1;
    let maxNumber = 0;

    // Find the highest userNumber for this role
    (data || []).forEach((row: any) => {
      const userNumber = row.user_number;
      
      if (userNumber && typeof userNumber === 'string') {
        // Extract number from format like "p1", "b2", "a3"
        const match = userNumber.match(/\d+$/);
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

    const userNumber = `${prefix}${nextNumber}`;

    return { success: true, data: userNumber };
  } catch (error: any) {
    // Fallback to local
    return { success: true, data: await getNextUserNumberFromLocal(role) };
  }
}

/**
 * Generate user number from AsyncStorage (fallback)
 */
export async function getNextUserNumberFromLocal(role: UserRole): Promise<string> {
  try {
    const { getAll, STORAGE_KEYS } = await import('./local-storage.service');

    const result = await getAll(STORAGE_KEYS.USERS);
    
    if (!result.success || !result.data) {
      return role === 'parent' ? 'p1' : role === 'babysitter' ? 'b1' : 'a1';
    }

    const rolePrefix: Record<UserRole, string> = {
      parent: 'p',
      babysitter: 'b',
      admin: 'a',
    };

    const prefix = rolePrefix[role] || 'u';
    const usersWithRole = result.data.filter((u: any) => u.role === role);
    
    if (usersWithRole.length === 0) {
      return `${prefix}1`;
    }

    // Find highest number
    let maxNumber = 0;
    for (const user of usersWithRole) {
      if (user.userNumber && typeof user.userNumber === 'string') {
        const match = user.userNumber.match(/\d+$/);
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
    return role === 'parent' ? 'p1' : role === 'babysitter' ? 'b1' : 'a1';
  }
}
