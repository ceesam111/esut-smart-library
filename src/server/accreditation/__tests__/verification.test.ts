import { describe, expect, it } from 'vitest';
import {
  checkLink,
  runLinkVerification,
  type FetchLike,
  type LinkCheckResult,
  type VerificationRecord,
  type VerificationRepo,
  type VerificationPatch,
} from '../verification';

const createMemoryRepo = (records: VerificationRecord[]) => {
  const rows = new Map(records.map((entry) => [entry.id, { ...entry }]));
  const applied: Array<{ id: string; patch: VerificationPatch }> = [];
  const requestedLimits: number[] = [];
  const repo: VerificationRepo = {
    async listRecords(limit) {
      requestedLimits.push(limit);
      return [...rows.values()];
    },
    async applyResult(id, patch) {
      applied.push({ id, patch });
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, ...patch });
    },
  };
  return { repo, rows, applied, requestedLimits };
};

const record = (overrides: Partial<VerificationRecord> = {}): VerificationRecord => ({
  id: 'rec-1',
  full_text_url: 'https://example.org/full.pdf',
  landing_page_url: 'https://example.org/record/1',
  access_state: 'full_text',
  verification_status: 'unverified',
  abstract_text: 'An abstract.',
  ...overrides,
});

const sequenceFetch = (statuses: number[]) => {
  const queue = [...statuses];
  const calls: Array<{ url: string; method: string | undefined; userAgent: string | undefined }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({ url, method: init?.method, userAgent: headers?.['user-agent'] });
    return { status: queue.shift() ?? 500 };
  };
  return { fetchImpl, calls };
};

const checkReturning = (result: LinkCheckResult) => {
  const seen: string[] = [];
  const check = async (url: string): Promise<LinkCheckResult> => {
    seen.push(url);
    return result;
  };
  return { check, seen };
};

describe('checkLink', () => {
  it('accepts a live HEAD response with the documented user agent', async () => {
    const { fetchImpl, calls } = sequenceFetch([200]);
    const result = await checkLink('https://example.org/full.pdf', fetchImpl);
    expect(result).toEqual({ status: 'ok', httpStatus: 200 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('HEAD');
    expect(calls[0]?.url).toBe('https://example.org/full.pdf');
    expect(calls[0]?.userAgent).toBeTruthy();
  });

  it('treats redirects as reachable', async () => {
    const { fetchImpl } = sequenceFetch([301]);
    const result = await checkLink('https://example.org/old', fetchImpl);
    expect(result.status).toBe('ok');
  });

  it('falls back to GET when HEAD is not allowed', async () => {
    const { fetchImpl, calls } = sequenceFetch([405, 200]);
    const result = await checkLink('https://example.org/full.pdf', fetchImpl);
    expect(result).toEqual({ status: 'ok', httpStatus: 200 });
    expect(calls.map((entry) => entry.method)).toEqual(['HEAD', 'GET']);
  });

  it('falls back to GET when the server answers 501 to HEAD', async () => {
    const { fetchImpl, calls } = sequenceFetch([501, 404]);
    const result = await checkLink('https://example.org/full.pdf', fetchImpl);
    expect(result).toEqual({ status: 'not_found', httpStatus: 404 });
    expect(calls.map((entry) => entry.method)).toEqual(['HEAD', 'GET']);
  });

  it('reports a definite failure for 404 without a second request', async () => {
    const { fetchImpl, calls } = sequenceFetch([404]);
    const result = await checkLink('https://example.org/gone.pdf', fetchImpl);
    expect(result).toEqual({ status: 'not_found', httpStatus: 404 });
    expect(calls).toHaveLength(1);
  });

  it('treats 410 and 451 as definite failures', async () => {
    expect((await checkLink('https://x.org/a', sequenceFetch([410]).fetchImpl)).status).toBe('not_found');
    expect((await checkLink('https://x.org/b', sequenceFetch([451]).fetchImpl)).status).toBe('not_found');
  });

  it('keeps 401, 403, 429 and 5xx answers inconclusive', async () => {
    for (const status of [401, 403, 429, 500, 503]) {
      const result = await checkLink('https://example.org/full.pdf', sequenceFetch([status]).fetchImpl);
      expect(result).toEqual({ status: 'inconclusive', httpStatus: status });
    }
  });

  it('reports a network failure or timeout as inconclusive without a status', async () => {
    const failing: FetchLike = async () => {
      throw new Error('aborted');
    };
    const result = await checkLink('https://example.org/full.pdf', failing);
    expect(result).toEqual({ status: 'inconclusive', httpStatus: null });
  });
});

describe('runLinkVerification', () => {
  it('marks a reachable link verified with its HTTP status and check time', async () => {
    const { repo, applied } = createMemoryRepo([record()]);
    const { check } = checkReturning({ status: 'ok', httpStatus: 200 });

    const summary = await runLinkVerification(
      {},
      { repo, check, now: () => new Date('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(summary).toEqual({ checked: 1, verified: 1, failed: 0, unverifiable: 0 });
    expect(applied[0]?.patch).toEqual({
      verification_status: 'verified',
      verification_http_status: 200,
      verification_checked_at: '2026-11-01T10:00:00.000Z',
    });
    expect(Object.keys(applied[0]?.patch ?? {})).not.toContain('access_state');
  });

  it('checks the full text URL in preference to the landing page', async () => {
    const { repo } = createMemoryRepo([record({ full_text_url: 'https://example.org/full.pdf' })]);
    const { check, seen } = checkReturning({ status: 'ok', httpStatus: 200 });
    await runLinkVerification({}, { repo, check, sleep: async () => undefined });
    expect(seen).toEqual(['https://example.org/full.pdf']);
  });

  it('falls back to the landing page when there is no full text URL', async () => {
    const { repo } = createMemoryRepo([
      record({ full_text_url: null, access_state: 'metadata_only', abstract_text: null }),
    ]);
    const { check, seen } = checkReturning({ status: 'ok', httpStatus: 200 });
    await runLinkVerification({}, { repo, check, sleep: async () => undefined });
    expect(seen).toEqual(['https://example.org/record/1']);
  });

  it('marks a dead full text link failed, keeps the URL and downgrades access', async () => {
    const { repo, applied, rows } = createMemoryRepo([record()]);
    const { check } = checkReturning({ status: 'not_found', httpStatus: 404 });

    const summary = await runLinkVerification(
      {},
      { repo, check, now: () => new Date('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(summary).toEqual({ checked: 1, verified: 0, failed: 1, unverifiable: 0 });
    expect(applied[0]?.patch).toMatchObject({
      verification_status: 'failed',
      verification_http_status: 404,
      access_state: 'abstract_only',
    });
    expect(Object.keys(applied[0]?.patch ?? {})).not.toContain('full_text_url');
    expect(rows.get('rec-1')?.full_text_url).toBe('https://example.org/full.pdf');
  });

  it('downgrades a dead full text link without an abstract to metadata_only', async () => {
    const { repo } = createMemoryRepo([record({ abstract_text: null })]);
    const { check } = checkReturning({ status: 'not_found', httpStatus: 410 });
    await runLinkVerification({}, { repo, check, sleep: async () => undefined });
    const patched = (await repo.listRecords(1))[0];
    expect(patched?.access_state).toBe('metadata_only');
  });

  it('downgrades a dead landing page from abstract_only to metadata_only', async () => {
    const { repo } = createMemoryRepo([
      record({ full_text_url: null, access_state: 'abstract_only' }),
    ]);
    const { check } = checkReturning({ status: 'not_found', httpStatus: 404 });
    await runLinkVerification({}, { repo, check, sleep: async () => undefined });
    const patched = (await repo.listRecords(1))[0];
    expect(patched?.access_state).toBe('metadata_only');
    expect(patched?.verification_status).toBe('failed');
  });

  it('downgrades a previously verified link to stale when a recheck is inconclusive', async () => {
    const { repo, applied } = createMemoryRepo([record({ verification_status: 'verified' })]);
    const { check } = checkReturning({ status: 'inconclusive', httpStatus: 403 });

    const summary = await runLinkVerification(
      {},
      { repo, check, now: () => new Date('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(summary).toEqual({ checked: 1, verified: 0, failed: 0, unverifiable: 1 });
    expect(applied[0]?.patch).toMatchObject({
      verification_status: 'stale',
      verification_http_status: 403,
      verification_checked_at: '2026-11-01T10:00:00.000Z',
    });
    expect(Object.keys(applied[0]?.patch ?? {})).not.toContain('access_state');
  });

  it('leaves records that were never verified untouched when the recheck is inconclusive', async () => {
    const { repo, applied } = createMemoryRepo([record({ verification_status: 'unverified' })]);
    const { check } = checkReturning({ status: 'inconclusive', httpStatus: 429 });

    const summary = await runLinkVerification({}, { repo, check, sleep: async () => undefined });

    expect(summary).toEqual({ checked: 1, verified: 0, failed: 0, unverifiable: 1 });
    expect(applied).toHaveLength(0);
  });

  it('aggregates honest counts across a mixed batch', async () => {
    const { repo } = createMemoryRepo([
      record({ id: 'a', full_text_url: 'https://a.org/full.pdf', verification_status: 'verified' }),
      record({ id: 'b', full_text_url: 'https://b.org/full.pdf', verification_status: 'verified' }),
      record({ id: 'c', full_text_url: 'https://c.org/full.pdf' }),
      record({ id: 'd', full_text_url: 'https://d.org/full.pdf' }),
    ]);
    const results: Record<string, LinkCheckResult> = {
      'https://a.org/full.pdf': { status: 'ok', httpStatus: 200 },
      'https://b.org/full.pdf': { status: 'not_found', httpStatus: 404 },
      'https://c.org/full.pdf': { status: 'inconclusive', httpStatus: 500 },
      'https://d.org/full.pdf': { status: 'ok', httpStatus: 301 },
    };
    const check = async (url: string): Promise<LinkCheckResult> =>
      results[url] ?? { status: 'inconclusive', httpStatus: null };

    const summary = await runLinkVerification({}, { repo, check, sleep: async () => undefined });
    expect(summary).toEqual({ checked: 4, verified: 2, failed: 1, unverifiable: 1 });
  });

  it('requests at most the documented batch size and at least one record', async () => {
    const defaultRun = createMemoryRepo([record()]);
    await runLinkVerification({}, { repo: defaultRun.repo, check: checkReturning({ status: 'ok', httpStatus: 200 }).check, sleep: async () => undefined });
    expect(defaultRun.requestedLimits).toEqual([25]);

    const oversized = createMemoryRepo([record()]);
    await runLinkVerification({ limit: 1000 }, { repo: oversized.repo, check: checkReturning({ status: 'ok', httpStatus: 200 }).check, sleep: async () => undefined });
    expect(oversized.requestedLimits).toEqual([100]);

    const zero = createMemoryRepo([record()]);
    await runLinkVerification({ limit: 0 }, { repo: zero.repo, check: checkReturning({ status: 'ok', httpStatus: 200 }).check, sleep: async () => undefined });
    expect(zero.requestedLimits).toEqual([1]);
  });

  it('waits a courtesy delay between link checks', async () => {
    const { repo } = createMemoryRepo([record({ id: 'a' }), record({ id: 'b' }), record({ id: 'c' })]);
    const sleeps: number[] = [];
    await runLinkVerification(
      {},
      {
        repo,
        check: checkReturning({ status: 'ok', httpStatus: 200 }).check,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );
    expect(sleeps).toEqual([250, 250]);
  });
});
