export interface WorkerConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  workerId: string;
  concurrency: number;
  pollIntervalMs: number;
  lockTimeoutMinutes: number;
  healthPort: number;
  schedulerEnabled: boolean;
  schedulerIntervalMs: number;
}

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readBoolean(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function loadWorkerConfig(): WorkerConfig {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.');
  if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    workerId: process.env.WORKER_ID || `smart-library-worker-${process.pid}`,
    concurrency: readNumber('WORKER_CONCURRENCY', 2),
    pollIntervalMs: readNumber('WORKER_POLL_INTERVAL_MS', 5000),
    lockTimeoutMinutes: readNumber('WORKER_LOCK_TIMEOUT_MINUTES', 15),
    healthPort: readNumber('WORKER_HEALTH_PORT', 8787),
    schedulerEnabled: readBoolean('WORKER_SCHEDULER_ENABLED', true),
    schedulerIntervalMs: readNumber('WORKER_SCHEDULER_INTERVAL_MS', 60000),
  };
}
