import { createClient } from '@supabase/supabase-js';
import type { WorkerConfig } from './config';

export function createWorkerSupabase(config: WorkerConfig) {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-smart-library-worker': config.workerId } },
  });
}
