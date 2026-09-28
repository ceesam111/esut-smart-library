import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import type { LibraryResource } from '@/config/libraryResources.config';
import {
  createDirectoryEntry,
  deleteDirectoryEntry,
  getAdminDirectory,
  isDirectoryKind,
  updateDirectoryEntry,
} from '@/server/directory/directory';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown, fallback: string) {
  const msg = error instanceof Error ? error.message : fallback;
  if (msg === 'Authentication required.') return NextResponse.json({ success: false, error: msg }, { status: 401 });
  if (msg === 'Forbidden.') return NextResponse.json({ success: false, error: msg }, { status: 403 });
  if (msg.startsWith('Invalid')) return NextResponse.json({ success: false, error: msg }, { status: 400 });
  return NextResponse.json({ success: false, error: msg }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const directory = new URL(request.url).searchParams.get('directory');
    if (!isDirectoryKind(directory)) throw new Error('Invalid directory.');
    const data = await getAdminDirectory(directory);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load directory.');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => null);
    const directory = body?.directory;
    const resource = body?.resource as LibraryResource | undefined;
    if (!isDirectoryKind(directory)) throw new Error('Invalid directory.');
    if (!resource?.name?.trim()) throw new Error('Invalid resource.');
    const created = await createDirectoryEntry(directory, resource, body?.active !== false);
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    return errorResponse(error, 'Failed to create entry.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => null);
    const directory = body?.directory;
    const id = typeof body?.id === 'string' ? body.id : '';
    const resource = body?.resource as LibraryResource | undefined;
    if (!isDirectoryKind(directory)) throw new Error('Invalid directory.');
    if (!id || !resource?.name?.trim()) throw new Error('Invalid resource.');
    await updateDirectoryEntry(directory, id, resource, body?.active !== false);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to update entry.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const params = new URL(request.url).searchParams;
    const directory = params.get('directory');
    const id = params.get('id');
    if (!isDirectoryKind(directory)) throw new Error('Invalid directory.');
    if (!id) throw new Error('Invalid resource.');
    await deleteDirectoryEntry(directory, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete entry.');
  }
}
