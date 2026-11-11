import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireRole = vi.fn();
vi.mock('@/server/auth/requireRole', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

import { GET } from './route';

function makeRequest() {
  return new Request('http://localhost/api/admin/canonical-url/theses');
}

function makeProps(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe('admin canonical-url route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockRequireRole.mockResolvedValue(undefined);
  });

  it('rejects non-admin callers with 403', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden.'));
    const response = await GET(makeRequest(), makeProps('theses'));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('returns base, canonical, robots and source', async () => {
    const response = await GET(makeRequest(), makeProps('theses'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.base).toBe('https://virtuallibrary.esut.edu.ng');
    expect(body.data.canonical).toBe('https://virtuallibrary.esut.edu.ng/theses');
    expect(body.data.robots.title).toBe('ESUT Smart Library');
    expect(body.data.robots.description).toContain('Enugu State University');
    expect(typeof body.data.robots.indexable).toBe('boolean');
    expect(body.data.source).toBe('static:fallback');
  });

  it('marks admin paths as not indexable', async () => {
    const response = await GET(makeRequest(), makeProps('admin'));
    const body = await response.json();
    expect(body.data.robots.indexable).toBe(false);
  });

  it('reports env source when APP_BASE_URL is configured', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://staging.example.edu.ng');
    const response = await GET(makeRequest(), makeProps('theses'));
    const body = await response.json();
    expect(body.data.base).toBe('https://staging.example.edu.ng');
    expect(body.data.source).toBe('env:APP_BASE_URL');
  });

  it('strips unsafe characters from the slug', async () => {
    const response = await GET(makeRequest(), makeProps('the ses/../admin'));
    const body = await response.json();
    expect(body.data.canonical).toBe('https://virtuallibrary.esut.edu.ng/theses/admin');
  });

  it('rejects non-canonical hosts with 403 in production before any role check', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = new Request('https://attacker.example/api/admin/canonical-url/theses', {
      headers: { 'x-forwarded-host': 'attacker.example' },
    });
    const response = await GET(request, makeProps('theses'));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it('rejects requests with no host information in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await GET(new Request('https://virtuallibrary.esut.edu.ng/api/admin/canonical-url/theses'), makeProps('theses'));
    expect(response.status).toBe(403);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it('serves the canonical host in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = new Request('https://virtuallibrary.esut.edu.ng/api/admin/canonical-url/theses', {
      headers: { 'x-forwarded-host': 'virtuallibrary.esut.edu.ng' },
    });
    const response = await GET(request, makeProps('theses'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.canonical).toBe('https://virtuallibrary.esut.edu.ng/theses');
    expect(mockRequireRole).toHaveBeenCalledTimes(1);
  });

  it('tolerates a forwarded host with an explicit port', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = new Request('https://virtuallibrary.esut.edu.ng/api/admin/canonical-url/theses', {
      headers: { 'x-forwarded-host': 'virtuallibrary.esut.edu.ng:443' },
    });
    const response = await GET(request, makeProps('theses'));
    expect(response.status).toBe(200);
  });
});
