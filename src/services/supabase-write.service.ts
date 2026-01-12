import { isSupabaseConfigured, supabase } from '@/src/config/supabase';
import { getSyncStatus, updateSyncStatus } from './local-storage.service';

/**
 * Execute a Supabase write action with retries and record failures to sync status.
 * The `action` should call the Supabase client and return its response object
 * (e.g. the result of `supabase.from(...).insert(...)`).
 */
export async function executeWrite<T = any>(
  action: () => Promise<{ data?: T; error?: any }> ,
  description = 'supabase_write',
  retries = 3
): Promise<{ data?: T; error?: any }> {
  if (!isSupabaseConfigured() || !supabase) {
    const err = { message: 'Supabase is not configured' };
    await recordPendingSync(`${description}: ${err.message}`);
    return { error: err };
  }

  let attempt = 0;
  while (attempt < retries) {
    try {
      const res = await action();
      if (!res.error) return res;

      // If error returned by Supabase, retry unless final attempt
      attempt += 1;
      if (attempt >= retries) {
        await recordPendingSync(`${description}: ${res.error?.message || JSON.stringify(res.error)}`);
        return res;
      }
      // exponential backoff
      await delay(300 * attempt);
    } catch (e: any) {
      attempt += 1;
      if (attempt >= retries) {
        await recordPendingSync(`${description}: exception ${e?.message || String(e)}`);
        return { error: e };
      }
      await delay(300 * attempt);
    }
  }

  const finalErr = { message: `${description}: failed after ${retries} attempts` };
  await recordPendingSync(`${description}: ${finalErr.message}`);
  return { error: finalErr };
}

async function recordPendingSync(message: string) {
  try {
    const status = await getSyncStatus();
    if (!status.success) return;
    const pending = Array.isArray(status.data?.pendingSyncs) ? status.data!.pendingSyncs : [];
    pending.push(`${Date.now()}: ${message}`);
    await updateSyncStatus({ pendingSyncs: pending });
  } catch (e) {
    // swallow - do not throw from logging
    console.warn('⚠️ Failed to record pending sync:', e?.message || e);
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default executeWrite;
