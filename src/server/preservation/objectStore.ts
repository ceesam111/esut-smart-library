import { getSupabaseAdminClient } from '../supabase/adminClient';
import { getSignedDownloadUrl, objectExists, listObjectsByPrefix } from '../storage/b2Client';

export type StorageProvider = 'supabase' | 'b2';

export interface StoredObjectRef {
  provider: StorageProvider;
  bucket?: string | null;
  key: string;
}

export type ObjectReadStatus = 'ok' | 'missing' | 'error' | 'inactive';

export interface ObjectReadResult {
  provider: StorageProvider;
  status: ObjectReadStatus;
  bytes?: Buffer;
  error?: string;
  contentType?: string;
}

export interface ObjectWriteResult {
  provider: StorageProvider;
  status: 'ok' | 'error' | 'inactive';
  error?: string;
}

export interface ObjectStore {
  provider: StorageProvider;
  active: boolean;
  inactiveReason: string | null;
  read(ref: Omit<StoredObjectRef, 'provider'>): Promise<ObjectReadResult>;
  write(ref: Omit<StoredObjectRef, 'provider'>, bytes: Buffer, contentType?: string): Promise<ObjectWriteResult>;
  list(prefix: string): Promise<{ status: 'ok' | 'error' | 'inactive'; keys: string[]; error?: string }>;
}

const SUPABASE_AIP_BUCKET = 'aip-exports';

function b2Missing(): { configured: boolean; reason: string } {
  const missing = ['B2_ENDPOINT', 'B2_REGION', 'B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET_LIBRARY_FILES']
    .filter((name) => !process.env[name]);
  if (missing.length) {
    return { configured: false, reason: `Backblaze B2 is not configured (missing ${missing.join(', ')}).` };
  }
  return { configured: true, reason: '' };
}

function isNotFound(error: unknown): boolean {
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : JSON.stringify(error ?? '');
  return /not found|No such key|NoSuchKey|"statusCode":\s*"?404/i.test(message);
}

export function supabaseStore(): ObjectStore {
  return {
    provider: 'supabase',
    active: true,
    inactiveReason: null,
    async read(ref) {
      if (!ref.bucket) return { provider: 'supabase', status: 'error', error: 'storage_bucket is missing on the file record.' };
      try {
        const signed = await getSupabaseAdminClient().storage.from(ref.bucket).createSignedUrl(ref.key, 60, { download: true });
        if (signed.error || !signed.data?.signedUrl) {
          const message = signed.error?.message ?? 'A signed download URL was not issued.';
          if (isNotFound(message)) return { provider: 'supabase', status: 'missing' };
          return { provider: 'supabase', status: 'error', error: message };
        }
        const response = await fetch(signed.data.signedUrl, { cache: 'no-store' });
        if (response.status === 404 || response.status === 403) return { provider: 'supabase', status: 'missing' };
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          if (detail && isNotFound(detail)) return { provider: 'supabase', status: 'missing' };
          return { provider: 'supabase', status: 'error', error: `Storage GET returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}.` };
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        return { provider: 'supabase', status: 'ok', bytes, contentType: response.headers.get('content-type') ?? undefined };
      } catch (error) {
        return { provider: 'supabase', status: 'error', error: error instanceof Error ? error.message : String(error) };
      }
    },
    async write(ref, bytes, contentType) {
      if (!ref.bucket) return { provider: 'supabase', status: 'error', error: 'storage_bucket is missing on the file record.' };
      try {
        const { error } = await getSupabaseAdminClient().storage.from(ref.bucket).upload(ref.key, bytes, {
          contentType: contentType || 'application/octet-stream',
          upsert: true,
        });
        if (error) return { provider: 'supabase', status: 'error', error: error.message };
        return { provider: 'supabase', status: 'ok' };
      } catch (error) {
        return { provider: 'supabase', status: 'error', error: error instanceof Error ? error.message : String(error) };
      }
    },
    async list(prefix) {
      try {
        const { data, error } = await getSupabaseAdminClient().storage.from(SUPABASE_AIP_BUCKET).list(prefix, { limit: 1000 });
        if (error) return { status: 'error', keys: [], error: error.message };
        const keys = (data ?? [])
          .filter((entry) => entry.name && entry.id)
          .map((entry) => `${prefix}/${entry.name}`);
        return { status: 'ok', keys };
      } catch (error) {
        return { status: 'error', keys: [], error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

/** Depth-first listing of every object under a storage prefix. */
export async function listObjectsRecursive(bucket: string, prefix: string): Promise<{ status: 'ok' | 'error'; keys: string[]; error?: string }> {
  const client = getSupabaseAdminClient().storage.from(bucket);
  const keys: string[] = [];
  const walk = async (path: string): Promise<string | null> => {
    const { data, error } = await client.list(path, { limit: 1000 });
    if (error) return error.message;
    for (const entry of data ?? []) {
      if (!entry.name) continue;
      const child = path ? `${path}/${entry.name}` : entry.name;
      if (entry.id) {
        keys.push(child);
      } else {
        const failure = await walk(child);
        if (failure) return failure;
      }
    }
    return null;
  };
  const failure = await walk(prefix);
  if (failure) return { status: 'error', keys: [], error: failure };
  return { status: 'ok', keys };
}

export function b2Store(): ObjectStore {
  const { configured, reason } = b2Missing();
  return {
    provider: 'b2',
    active: configured,
    inactiveReason: configured ? null : reason,
    async read(ref) {
      if (!configured) return { provider: 'b2', status: 'inactive', error: reason };
      try {
        const signed = await getSignedDownloadUrl({ key: ref.key, bucket: ref.bucket ?? undefined, expiresIn: 60 });
        const response = await fetch(signed);
        if (response.status === 404 || response.status === 403) return { provider: 'b2', status: 'missing' };
        if (!response.ok) return { provider: 'b2', status: 'error', error: `B2 GET returned HTTP ${response.status}.` };
        const bytes = Buffer.from(await response.arrayBuffer());
        return { provider: 'b2', status: 'ok', bytes, contentType: response.headers.get('content-type') ?? undefined };
      } catch (error) {
        return { provider: 'b2', status: 'error', error: error instanceof Error ? error.message : String(error) };
      }
    },
    async write() {
      if (!configured) return { provider: 'b2', status: 'inactive', error: reason };
      return { provider: 'b2', status: 'error', error: 'B2 writes are not enabled for preservation objects.' };
    },
    async list(prefix) {
      if (!configured) return { status: 'inactive', keys: [], error: reason };
      try {
        const items = await listObjectsByPrefix({ prefix, maxKeys: 1000 });
        const keys = items.map((item) => item.key ?? '').filter((key) => key.length > 0);
        return { status: 'ok', keys };
      } catch (error) {
        return { status: 'error', keys: [], error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

const stores: Record<StorageProvider, () => ObjectStore> = {
  supabase: supabaseStore,
  b2: b2Store,
};

export function resolveStore(provider: StorageProvider | null | undefined): ObjectStore {
  const key: StorageProvider = provider === 'b2' ? 'b2' : 'supabase';
  return stores[key]();
}

export function describeStores(): Array<{ provider: StorageProvider; active: boolean; inactiveReason: string | null }> {
  return (Object.keys(stores) as StorageProvider[]).map((provider) => {
    const store = stores[provider]();
    return { provider, active: store.active, inactiveReason: store.inactiveReason };
  });
}

export async function readStoredObject(ref: StoredObjectRef): Promise<ObjectReadResult> {
  return resolveStore(ref.provider).read({ bucket: ref.bucket, key: ref.key });
}

export async function writeStoredObject(ref: StoredObjectRef, bytes: Buffer, contentType?: string): Promise<ObjectWriteResult> {
  return resolveStore(ref.provider).write({ bucket: ref.bucket, key: ref.key }, bytes, contentType);
}

export async function b2ObjectAvailable(key: string, bucket?: string): Promise<{ available: boolean; reason?: string }> {
  const { configured, reason } = b2Missing();
  if (!configured) return { available: false, reason };
  try {
    await objectExists({ key, bucket });
    return { available: true };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
