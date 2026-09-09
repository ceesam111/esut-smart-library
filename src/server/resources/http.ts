const DEFAULT_TIMEOUT_MS = 6500;

export async function fetchJson<T>(url: string, options?: { signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string> }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (options?.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ESUT-Smart-Library/1.0 (open-access discovery; contact: library@esut.edu.ng)',
        ...options?.headers,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(url: string, options?: { signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string> }): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (options?.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'ESUT-Smart-Library/1.0 (open-access discovery; contact: library@esut.edu.ng)', ...options?.headers } });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
