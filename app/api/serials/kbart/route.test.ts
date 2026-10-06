import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authState = vi.hoisted(() => ({
  behavior: 'allow' as 'allow' | 'anonymous' | 'forbidden',
  capturedRequest: null as Request | null,
}));

const dbState = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  error: null as string | null,
}));

vi.mock('@/server/auth/requireRole', () => ({
  requireRole: vi.fn(async (request: Request) => {
    authState.capturedRequest = request;
    if (authState.behavior === 'anonymous') throw new Error('Authentication required.');
    if (authState.behavior === 'forbidden') throw new Error('Forbidden.');
    return { roles: ['library_admin'], primaryRole: 'library_admin' };
  }),
}));

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        limit: async () => ({ data: dbState.rows, error: dbState.error ? { message: dbState.error } : null }),
      }),
    }),
  }),
}));

import { GET } from './route';

function request(): NextRequestLike {
  return new NextRequest('http://localhost/api/serials/kbart', {
    headers: { authorization: 'Bearer test-token' },
  }) as NextRequestLike;
}

type NextRequestLike = Parameters<typeof GET>[0];

describe('GET /api/serials/kbart', () => {
  beforeEach(() => {
    authState.behavior = 'allow';
    authState.capturedRequest = null;
    dbState.rows = [];
    dbState.error = null;
  });

  it('exports KBART with correct headers and body', async () => {
    dbState.rows = [
      { title: 'Journal of Testing', issn: '1234-5678', eissn: null, publisher: 'Test Press', start_date: '2024-01-01', end_date: null, frequency: 'Quarterly', url: null, subjects: ['Science'] },
    ];
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/tab-separated-values');
    expect(res.headers.get('content-disposition')).toContain('esut_serials_kbart.txt');
    expect(res.headers.get('x-request-id')).toBeTruthy();
    const body = await res.text();
    const lines = body.split('\n');
    expect(lines[0].split('\t')).toContain('publication_title');
    expect(lines[1]).toContain('Journal of Testing');
    expect(lines[1]).toContain('1234-5678');
  });

  it('passes the real incoming request to requireRole (no synthetic request)', async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(authState.capturedRequest).not.toBeNull();
    expect(authState.capturedRequest!.headers.get('authorization')).toBe('Bearer test-token');
    expect(authState.capturedRequest!.url).toBe('http://localhost/api/serials/kbart');
  });

  it('returns 401 UNAUTHORIZED for anonymous callers instead of 500', async () => {
    authState.behavior = 'anonymous';
    const res = await GET(request());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 FORBIDDEN for insufficient roles', async () => {
    authState.behavior = 'forbidden';
    const res = await GET(request());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 500 INTERNAL_ERROR when the serials query fails', async () => {
    dbState.error = 'connection refused';
    const res = await GET(request());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns a header-only export when no serials exist', async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe(
      'publication_title\tprint_identifier\tonline_identifier\tpublisher\tstart_year\tend_year\tfrequency\turl\tsubject',
    );
  });
});
