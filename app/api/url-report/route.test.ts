import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

function makeRequest(query = '') {
  return new Request(`http://localhost/api/url-report${query}`);
}

describe('url-report route', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes base, canonical, hreflang, robots and source', async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.base).toBe('https://virtuallibrary.esut.edu.ng');
    expect(body.data.canonical).toBe('https://virtuallibrary.esut.edu.ng/');
    expect(body.data.hreflang).toEqual([]);
    expect(body.data.robots.title).toBe('ESUT Smart Library');
    expect(body.data.robots.sitemap).toBe('https://virtuallibrary.esut.edu.ng/sitemap.xml');
    expect(body.data.source).toBe('static:fallback');
  });

  it('resolves the canonical for a requested path', async () => {
    const response = await GET(makeRequest('?path=%2Ftheses%2Fabc'));
    const body = await response.json();
    expect(body.data.canonical).toBe('https://virtuallibrary.esut.edu.ng/theses/abc');
    expect(body.data.robots.indexable).toBe(true);
  });

  it('marks noindex prefixes as not indexable', async () => {
    const response = await GET(makeRequest('?path=/dashboard'));
    const body = await response.json();
    expect(body.data.robots.indexable).toBe(false);
  });

  it('rejects traversal and malformed paths', async () => {
    const traversal = await (await GET(makeRequest('?path=..%2F..%2Fetc'))).json();
    expect(traversal.data.canonical).toBe('https://virtuallibrary.esut.edu.ng/');
    const malformed = await (await GET(makeRequest('?path=javascript:alert(1)'))).json();
    expect(malformed.data.canonical).toBe('https://virtuallibrary.esut.edu.ng/');
  });

  it('reports env source when APP_BASE_URL is configured', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://staging.example.edu.ng');
    const body = await (await GET(makeRequest())).json();
    expect(body.data.base).toBe('https://staging.example.edu.ng');
    expect(body.data.source).toBe('env:APP_BASE_URL');
  });
});
