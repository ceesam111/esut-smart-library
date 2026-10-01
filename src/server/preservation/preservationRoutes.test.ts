import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET as getOverview } from '../../../app/api/preservation/overview/route';
import { GET as getIncidents, PATCH as patchIncidents } from '../../../app/api/preservation/incidents/route';
import { GET as getFiles, POST as postFiles } from '../../../app/api/preservation/files/route';
import { GET as getRuns, POST as postRestore } from '../../../app/api/preservation/restore/route';

function unauthenticated(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

describe('preservation routes reject unauthenticated callers (B18)', () => {
  it('GET /api/preservation/overview returns 401', async () => {
    const response = await getOverview(unauthenticated('http://localhost/api/preservation/overview'));
    expect(response.status).toBe(401);
  });

  it('GET /api/preservation/incidents returns 401', async () => {
    const response = await getIncidents(unauthenticated('http://localhost/api/preservation/incidents'));
    expect(response.status).toBe(401);
  });

  it('PATCH /api/preservation/incidents returns 401', async () => {
    const response = await patchIncidents(
      unauthenticated('http://localhost/api/preservation/incidents', { method: 'PATCH', body: JSON.stringify({ id: 'x', action: 'resolved' }) }),
    );
    expect(response.status).toBe(401);
  });

  it('GET /api/preservation/files returns 401', async () => {
    const response = await getFiles(unauthenticated('http://localhost/api/preservation/files'));
    expect(response.status).toBe(401);
  });

  it('POST /api/preservation/files returns 401', async () => {
    const response = await postFiles(
      unauthenticated('http://localhost/api/preservation/files', { method: 'POST', body: JSON.stringify({ action: 'recheck', fileId: 'x' }) }),
    );
    expect(response.status).toBe(401);
  });

  it('GET /api/preservation/restore returns 401', async () => {
    const response = await getRuns(unauthenticated('http://localhost/api/preservation/restore'));
    expect(response.status).toBe(401);
  });

  it('POST /api/preservation/restore returns 401', async () => {
    const response = await postRestore(
      unauthenticated('http://localhost/api/preservation/restore', { method: 'POST', body: JSON.stringify({ aipPath: 'item-x', target: 'isolated' }) }),
    );
    expect(response.status).toBe(401);
  });
});
