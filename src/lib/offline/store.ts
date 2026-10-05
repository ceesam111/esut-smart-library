import type {
  OfflineCache,
  OfflineSession,
  QueuedState,
  QueuedTx,
} from './types';

export interface KvBackend {
  get(store: string, key: string): Promise<unknown | undefined>;
  set(store: string, key: string, value: unknown): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  keys(store: string): Promise<string[]>;
  entries<T>(store: string): Promise<Array<{ key: string; value: T }>>;
}

const DB_NAME = 'esut-offline-v1';
const KV_STORE = 'kv';
const IDB_NAME_PREFIX = `${DB_NAME}:`;

function idbKey(store: string, key: string): string {
  return `${store}::${key}`;
}

class IdbBackend implements KvBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(KV_STORE)) {
            req.result.createObjectStore(KV_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
      });
    }
    return this.dbPromise;
  }

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(KV_STORE, mode).objectStore(KV_STORE);
  }

  async get(store: string, key: string): Promise<unknown | undefined> {
    const os = await this.tx('readonly');
    return new Promise((resolve, reject) => {
      const req = os.get(idbKey(store, key));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
    });
  }

  async set(store: string, key: string, value: unknown): Promise<void> {
    const os = await this.tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = os.put(value, idbKey(store, key));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB put failed'));
    });
  }

  async delete(store: string, key: string): Promise<void> {
    const os = await this.tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = os.delete(idbKey(store, key));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'));
    });
  }

  async keys(store: string): Promise<string[]> {
    const os = await this.tx('readonly');
    return new Promise((resolve, reject) => {
      const req = os.getAllKeys();
      req.onsuccess = () => {
        const prefix = `${store}::`;
        resolve((req.result as IDBValidKey[]).filter((k) => typeof k === 'string' && k.startsWith(prefix)).map((k) => String(k).slice(prefix.length)));
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB keys failed'));
    });
  }

  async entries<T>(store: string): Promise<Array<{ key: string; value: T }>> {
    const os = await this.tx('readonly');
    const prefix = `${store}::`;
    const [keys, values] = await Promise.all([
      new Promise<IDBValidKey[]>((resolve, reject) => {
        const req = os.getAllKeys();
        req.onsuccess = () => resolve(req.result as IDBValidKey[]);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB keys failed'));
      }),
      new Promise<unknown[]>((resolve, reject) => {
        const req = os.getAll();
        req.onsuccess = () => resolve(req.result as unknown[]);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'));
      }),
    ]);
    const out: Array<{ key: string; value: T }> = [];
    keys.forEach((k, i) => {
      if (typeof k === 'string' && k.startsWith(prefix)) {
        out.push({ key: k.slice(prefix.length), value: values[i] as T });
      }
    });
    return out;
  }
}

/**
 * In-memory backend used in tests and as a fallback when IndexedDB is
 * unavailable (private-mode browsers, SSR). Instances with the same name share
 * one registry so a "reload" (new store instance) observes prior writes — the
 * same durability contract the IndexedDB backend provides in the browser.
 */
const memoryRegistry = new Map<string, Map<string, unknown>>();

export function createMemoryBackend(name = 'default'): KvBackend {
  const registryName = `${IDB_NAME_PREFIX}${name}`;
  if (!memoryRegistry.has(registryName)) memoryRegistry.set(registryName, new Map());
  const data = memoryRegistry.get(registryName)!;
  return {
    async get(store, key) {
      return data.get(idbKey(store, key));
    },
    async set(store, key, value) {
      data.set(idbKey(store, key), value);
    },
    async delete(store, key) {
      data.delete(idbKey(store, key));
    },
    async keys(store) {
      const prefix = `${store}::`;
      return [...data.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    },
    async entries<T>(store: string) {
      const prefix = `${store}::`;
      const out: Array<{ key: string; value: T }> = [];
      for (const [k, v] of data) {
        if (k.startsWith(prefix)) out.push({ key: k.slice(prefix.length), value: v as T });
      }
      return out;
    },
  };
}

export function resetMemoryBackend(name = 'default'): void {
  memoryRegistry.delete(`${IDB_NAME_PREFIX}${name}`);
}

function defaultBackend(): KvBackend {
  try {
    if (typeof indexedDB !== 'undefined') return new IdbBackend();
  } catch {
    /* fall through to memory */
  }
  return createMemoryBackend('fallback');
}

const STORE = {
  meta: 'meta',
  queue: 'queue',
  cache: 'cache',
  session: 'session',
};

const META_KEYS = {
  deviceId: 'device_id',
  nextSeq: 'next_seq',
  lastSync: 'last_sync',
};

export class OfflineStore {
  constructor(private backend: KvBackend = defaultBackend()) {}

  async getDeviceId(): Promise<string> {
    const existing = (await this.backend.get(STORE.meta, META_KEYS.deviceId)) as string | undefined;
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await this.backend.set(STORE.meta, META_KEYS.deviceId, id);
    return id;
  }

  private async nextSeq(): Promise<number> {
    const current = ((await this.backend.get(STORE.meta, META_KEYS.nextSeq)) as number | undefined) ?? 0;
    const next = current + 1;
    await this.backend.set(STORE.meta, META_KEYS.nextSeq, next);
    return next;
  }

  async enqueue(
    operation: QueuedTx['operation'],
    payload: QueuedTx['payload'],
    operatorId: string,
  ): Promise<QueuedTx> {
    const tx: QueuedTx = {
      client_txn_id:
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      local_seq: await this.nextSeq(),
      operation,
      client_timestamp: new Date().toISOString(),
      queued_by: operatorId,
      state: 'pending',
      attempts: 0,
      payload,
    };
    await this.backend.set(STORE.queue, tx.client_txn_id, tx);
    return tx;
  }

  async listQueue(): Promise<QueuedTx[]> {
    const rows = await this.backend.entries<QueuedTx>(STORE.queue);
    return rows.map((r) => r.value).sort((a, b) => a.local_seq - b.local_seq);
  }

  async getTx(clientTxnId: string): Promise<QueuedTx | null> {
    return ((await this.backend.get(STORE.queue, clientTxnId)) as QueuedTx | undefined) ?? null;
  }

  async saveTx(tx: QueuedTx): Promise<void> {
    await this.backend.set(STORE.queue, tx.client_txn_id, tx);
  }

  async removeTx(clientTxnId: string): Promise<void> {
    await this.backend.delete(STORE.queue, clientTxnId);
  }

  async setTxState(
    clientTxnId: string,
    state: QueuedState,
    opts: { conflict_code?: string | null; message?: string; resolution?: 'retry' | 'override' | null; bumpAttempts?: boolean } = {},
  ): Promise<void> {
    const tx = await this.getTx(clientTxnId);
    if (!tx) return;
    tx.state = state;
    if (opts.conflict_code !== undefined) tx.conflict_code = opts.conflict_code;
    if (opts.message !== undefined) tx.message = opts.message;
    if (opts.resolution !== undefined) tx.resolution = opts.resolution;
    if (opts.bumpAttempts) tx.attempts += 1;
    await this.saveTx(tx);
  }

  async loadSession(): Promise<OfflineSession | null> {
    const s = (await this.backend.get(STORE.session, 'grant')) as OfflineSession | undefined;
    if (!s) return null;
    if (Date.parse(s.expires_at) < Date.now()) return null;
    return s;
  }

  async saveSession(session: OfflineSession): Promise<void> {
    await this.backend.set(STORE.session, 'grant', session);
  }

  /** Logout: clears the session grant but deliberately preserves the queue. */
  async clearSession(): Promise<void> {
    await this.backend.delete(STORE.session, 'grant');
  }

  async loadCache(): Promise<OfflineCache | null> {
    return ((await this.backend.get(STORE.cache, 'circulation')) as OfflineCache | undefined) ?? null;
  }

  async saveCache(cache: OfflineCache): Promise<void> {
    await this.backend.set(STORE.cache, 'circulation', cache);
  }

  async setLastSync(iso: string): Promise<void> {
    await this.backend.set(STORE.meta, META_KEYS.lastSync, iso);
  }

  async getLastSync(): Promise<string | null> {
    return ((await this.backend.get(STORE.meta, META_KEYS.lastSync)) as string | undefined) ?? null;
  }
}

export const offlineStore = new OfflineStore();
