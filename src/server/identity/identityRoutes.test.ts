import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST as verifyOrcid } from '../../../app/api/profile/orcid/verify/route';
import { GET as identityDuplicates } from '../../../app/api/admin/identity/duplicates/route';
import { GET as orcidLookup } from '../../../app/api/orcid/route';

function request(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

describe('identity routes reject unauthenticated callers', () => {
  it('POST /api/profile/orcid/verify returns 401', async () => {
    const response = await verifyOrcid(
      request('http://localhost/api/profile/orcid/verify', {
        method: 'POST',
        body: JSON.stringify({ orcid: '0000-0002-1825-0097' }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('GET /api/admin/identity/duplicates returns 401', async () => {
    const response = await identityDuplicates(request('http://localhost/api/admin/identity/duplicates'));
    expect(response.status).toBe(401);
  });
});

describe('GET /api/orcid input validation', () => {
  it('requires an id', async () => {
    const response = await orcidLookup(request('http://localhost/api/orcid'));
    expect(response.status).toBe(400);
  });

  it('rejects a checksum-invalid id before touching the registry', async () => {
    const response = await orcidLookup(request('http://localhost/api/orcid?id=0000-0002-1825-0094'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('checksum');
  });

  it('rejects malformed input', async () => {
    const response = await orcidLookup(request(`http://localhost/api/orcid?id=${encodeURIComponent('not an orcid')}`));
    expect(response.status).toBe(400);
  });
});
