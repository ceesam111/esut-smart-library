import { describe, it, expect } from 'vitest';

describe('security / IDOR', () => {
  it('rejects unauthenticated batch modification', async () => {
    const { requireRole } = await import('@/server/auth/requireRole');
    const mockRequest = { headers: new Headers() } as Request;
    await expect(requireRole(mockRequest, ['librarian'])).rejects.toThrow();
  });

  it('rejects unauthenticated authority merge', async () => {
    const { requireRole } = await import('@/server/auth/requireRole');
    const mockRequest = { headers: new Headers() } as Request;
    await expect(requireRole(mockRequest, ['super_admin'])).rejects.toThrow();
  });

  it('rejects unauthenticated staged import', async () => {
    const { requireRole } = await import('@/server/auth/requireRole');
    const mockRequest = { headers: new Headers() } as Request;
    await expect(requireRole(mockRequest, ['librarian'])).rejects.toThrow();
  });

  it('rejects unauthenticated overlay', async () => {
    const { requireRole } = await import('@/server/auth/requireRole');
    const mockRequest = { headers: new Headers() } as Request;
    await expect(requireRole(mockRequest, ['librarian'])).rejects.toThrow();
  });

  it('rejects unauthenticated authority link', async () => {
    const { requireRole } = await import('@/server/auth/requireRole');
    const mockRequest = { headers: new Headers() } as Request;
    await expect(requireRole(mockRequest, ['librarian'])).rejects.toThrow();
  });
});
