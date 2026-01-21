/**
 * Sync Service - Comprehensive Data Synchronization
 * Syncs all data from Supabase to AsyncStorage for offline access
 */
import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { STORAGE_KEYS } from './local-storage.service';
import { save, getAll } from './local-storage.service';
import { ServiceResult } from '@/src/types/error.types';

export interface SyncResult {
  users: number;
  children: number;
  instructions: number;
  sessions: number;
  alerts: number;
  messages: number;
  success: boolean;
  error?: string;
}

/**
 * Sync all data from Supabase to AsyncStorage
 */
export async function syncAllDataFromSupabase(userId: string): Promise<ServiceResult<SyncResult>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: 'Supabase is not configured',
        },
      };
    }

    console.log('🔄 Starting comprehensive data sync from Supabase...');
    const result: SyncResult = {
      users: 0,
      children: 0,
      instructions: 0,
      sessions: 0,
      alerts: 0,
      messages: 0,
      success: true,
    };

    // 1. Sync User Profile
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData) {
        // MERGE with existing data to preserve fields not in sync payload
        const existing = await getAll(STORAGE_KEYS.USERS);
        const existingUser = existing.success && existing.data 
          ? existing.data.find((u: any) => u.id === userId)
          : null;
        
        // Merge: preserve existing fields, update with synced fields
        const mergedUser = {
          ...existingUser, // Preserve existing fields first
          id: userData.id,
          email: userData.email,
          displayName: userData.display_name || existingUser?.displayName,
          role: userData.role === 'sitter' ? 'babysitter' : (userData.role || existingUser?.role || 'parent'),
          preferredLanguage: userData.preferred_language || existingUser?.preferredLanguage || 'en',
          userNumber: userData.user_number || existingUser?.userNumber,
          phoneNumber: userData.phone_number ?? existingUser?.phoneNumber,
          profileImageUrl: userData.photo_url ?? existingUser?.profileImageUrl,
          address: userData.address ?? existingUser?.address,
          city: userData.city ?? existingUser?.city,
          country: userData.country ?? existingUser?.country,
          theme: userData.theme || existingUser?.theme || 'auto',
          isVerified: userData.is_verified ?? existingUser?.isVerified ?? false,
          verificationStatus: userData.verification_status ?? existingUser?.verificationStatus,
          hourlyRate: userData.hourly_rate ?? existingUser?.hourlyRate,
          bio: userData.bio ?? existingUser?.bio,
          createdAt: userData.created_at ? new Date(userData.created_at).getTime() : (existingUser?.createdAt || Date.now()),
          updatedAt: userData.updated_at ? new Date(userData.updated_at).getTime() : Date.now(),
        };
        
        await save(STORAGE_KEYS.USERS, mergedUser);
        result.users = 1;
        console.log('✅ User profile synced (merged with existing data)');
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to sync user:', error.message);
    }

    // 2. Sync Children
    try {
      const { data: childrenData } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', userId)
        .order('created_at', { ascending: false });

      if (childrenData) {
        // MERGE with existing children to preserve fields not in sync payload
        const existing = await getAll(STORAGE_KEYS.CHILDREN);
        const existingMap = new Map<string, any>();
        if (existing.success && existing.data) {
          existing.data.forEach((c: any) => {
            if (c.parentId === userId) {
              existingMap.set(c.id, c);
            }
          });
        }

        // Get IDs of children from database
        const syncedIds = new Set(childrenData.map(c => c.id));

        // Merge and save children
        for (const child of childrenData) {
          const existingChild = existingMap.get(child.id);
          const mergedChild = {
            ...existingChild, // Preserve existing fields first
            id: child.id,
            parentId: child.parent_id,
            childNumber: child.child_number ?? existingChild?.childNumber,
            parentNumber: child.parent_number ?? existingChild?.parentNumber,
            sitterNumber: child.sitter_number ?? existingChild?.sitterNumber,
            name: child.name || existingChild?.name,
            age: child.age ?? existingChild?.age,
            dateOfBirth: child.date_of_birth ? new Date(child.date_of_birth).getTime() : (existingChild?.dateOfBirth || null),
            gender: child.gender ?? existingChild?.gender,
            photoUrl: child.photo_url ?? existingChild?.photoUrl,
            createdAt: child.created_at ? new Date(child.created_at).getTime() : (existingChild?.createdAt || Date.now()),
            updatedAt: child.updated_at ? new Date(child.updated_at).getTime() : Date.now(),
          };
          await save(STORAGE_KEYS.CHILDREN, mergedChild);
          existingMap.delete(child.id); // Mark as synced
        }

        // Remove children that are no longer in database
        for (const [id, _] of existingMap.entries()) {
          const { remove } = await import('./local-storage.service');
          await remove(STORAGE_KEYS.CHILDREN, id);
          console.log(`🗑️ Removed deleted child from AsyncStorage: ${id}`);
        }

        result.children = childrenData.length;
        console.log(`✅ ${childrenData.length} children synced (merged, preserved existing fields)`);
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to sync children:', error.message);
    }

    // 3. Sync Child Instructions
    try {
      const { data: instructionsData } = await supabase
        .from('child_instructions')
        .select('*')
        .eq('parent_id', userId);

      if (instructionsData) {
        for (const inst of instructionsData) {
          await save(STORAGE_KEYS.CHILD_INSTRUCTIONS, {
            id: inst.id,
            childId: inst.child_id,
            parentId: inst.parent_id,
            feedingSchedule: inst.feeding_schedule,
            napSchedule: inst.nap_schedule,
            bedtime: inst.bedtime,
            dietaryRestrictions: inst.dietary_restrictions,
            allergies: inst.allergies,
            medications: inst.medications,
            favoriteActivities: inst.favorite_activities,
            comfortItems: inst.comfort_items,
            routines: inst.routines,
            specialNeeds: inst.special_needs,
            emergencyContacts: inst.emergency_contacts,
            doctorInfo: inst.doctor_info,
            additionalNotes: inst.additional_notes,
            createdAt: new Date(inst.created_at).getTime(),
            updatedAt: new Date(inst.updated_at).getTime(),
          });
        }
        result.instructions = instructionsData.length;
        console.log(`✅ ${instructionsData.length} child instructions synced`);
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to sync child instructions:', error.message);
    }

    // 4. Sync Sessions
    try {
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .or(`parent_id.eq.${userId},sitter_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (sessionsData) {
        for (const session of sessionsData) {
          await save(STORAGE_KEYS.SESSIONS, {
            id: session.id,
            parentId: session.parent_id,
            sitterId: session.sitter_id,
            childId: session.child_id,
            status: session.status,
            startTime: session.start_time ? new Date(session.start_time).getTime() : null,
            endTime: session.end_time ? new Date(session.end_time).getTime() : null,
            createdAt: new Date(session.created_at).getTime(),
            updatedAt: new Date(session.updated_at).getTime(),
          });
        }
        result.sessions = sessionsData.length;
        console.log(`✅ ${sessionsData.length} sessions synced`);
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to sync sessions:', error.message);
    }

    // 5. Sync Alerts
    try {
      const { data: alertsData } = await supabase
        .from('alerts')
        .select('*')
        .eq('parent_id', userId)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to recent 100 alerts

      if (alertsData) {
        for (const alert of alertsData) {
          await save(STORAGE_KEYS.ALERTS, {
            id: alert.id,
            parentId: alert.parent_id,
            sessionId: alert.session_id,
            childId: alert.child_id,
            type: alert.type,
            message: alert.message,
            severity: alert.severity,
            status: alert.status,
            acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at).getTime() : null,
            resolvedAt: alert.resolved_at ? new Date(alert.resolved_at).getTime() : null,
            createdAt: new Date(alert.created_at).getTime(),
            updatedAt: new Date(alert.updated_at).getTime(),
          });
        }
        result.alerts = alertsData.length;
        console.log(`✅ ${alertsData.length} alerts synced`);
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to sync alerts:', error.message);
    }

    // 6. Sync Chat Messages (recent)
    try {
      const { data: messagesData } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(200); // Limit to recent 200 messages

      if (messagesData) {
        for (const msg of messagesData) {
          await save(STORAGE_KEYS.CHAT_MESSAGES, {
            id: msg.id,
            sessionId: msg.session_id,
            senderId: msg.sender_id,
            receiverId: msg.receiver_id,
            message: msg.message,
            read: msg.read || false,
            readAt: msg.read_at ? new Date(msg.read_at).getTime() : null,
            createdAt: new Date(msg.created_at).getTime(),
          });
        }
        result.messages = messagesData.length;
        console.log(`✅ ${messagesData.length} messages synced`);
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to sync messages:', error.message);
    }

    console.log('✅ Comprehensive sync complete:', result);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return {
      success: false,
      error: {
        code: 'SYNC_ERROR',
        message: error.message || 'Failed to sync data',
      },
    };
  }
}
