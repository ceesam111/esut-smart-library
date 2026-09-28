import type { LibraryResource } from '@/config/libraryResources.config';
import { OPEN_ACCESS_DATABASES } from '@/config/openAccessDatabases.data';
import { SUBSCRIBED_DATABASES } from '@/config/subscribedDatabases.data';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export type DirectoryKind = 'open_access' | 'subscribed';

export const DIRECTORY_KINDS: DirectoryKind[] = ['open_access', 'subscribed'];

export function isDirectoryKind(value: string | null | undefined): value is DirectoryKind {
  return value === 'open_access' || value === 'subscribed';
}

export interface DirectoryRow {
  id: string;
  directory: string;
  name: string;
  is_active: boolean;
  payload: Partial<LibraryResource>;
  created_at?: string;
  updated_at?: string;
}

export interface DirectoryEntry {
  resource: LibraryResource;
  source: 'catalog' | 'custom';
  active: boolean;
}

export function getStaticBase(kind: DirectoryKind): LibraryResource[] {
  return kind === 'open_access' ? OPEN_ACCESS_DATABASES : SUBSCRIBED_DATABASES;
}

export function rowToResource(row: DirectoryRow): LibraryResource {
  const payload = (row.payload ?? {}) as Partial<LibraryResource>;
  return {
    ...payload,
    id: row.id,
    name: row.name || payload.name || row.id,
    status: row.is_active ? 'active' : 'inactive',
  } as LibraryResource;
}

/**
 * Static catalog entries are the shipped base. Directory rows act as an
 * overlay: a row with the same id replaces (or hides, when is_active=false)
 * the static entry; a row with a new id is an admin-created custom entry.
 */
export function mergeDirectory(kind: DirectoryKind, base: LibraryResource[], rows: DirectoryRow[], includeInactive: boolean): DirectoryEntry[] {
  const overrides = new Map(rows.filter((row) => row.directory === kind).map((row) => [row.id, row]));
  const baseIds = new Set(base.map((item) => item.id));
  const entries: DirectoryEntry[] = [];

  for (const item of base) {
    const override = overrides.get(item.id);
    if (override) {
      overrides.delete(item.id);
      const active = override.is_active;
      if (!active && !includeInactive) continue;
      entries.push({ resource: rowToResource(override), source: 'catalog', active });
    } else {
      const active = item.status !== 'inactive';
      if (!active && !includeInactive) continue;
      entries.push({ resource: item, source: 'catalog', active });
    }
  }

  for (const row of overrides.values()) {
    const active = row.is_active;
    if (!active && !includeInactive) continue;
    entries.push({ resource: rowToResource(row), source: baseIds.has(row.id) ? 'catalog' : 'custom', active });
  }

  return entries;
}

export async function fetchDirectoryRows(kind: DirectoryKind): Promise<DirectoryRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('directory_databases')
    .select('*')
    .eq('directory', kind)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as DirectoryRow[];
}

export async function getPublicDirectory(kind: DirectoryKind): Promise<LibraryResource[]> {
  const base = getStaticBase(kind);
  try {
    const rows = await fetchDirectoryRows(kind);
    return mergeDirectory(kind, base, rows, false).map((entry) => entry.resource);
  } catch {
    return base;
  }
}

export async function getAdminDirectory(kind: DirectoryKind): Promise<DirectoryEntry[]> {
  const base = getStaticBase(kind);
  const rows = await fetchDirectoryRows(kind);
  return mergeDirectory(kind, base, rows, true);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'entry'
  );
}

async function uniqueId(kind: DirectoryKind, desired: string): Promise<string> {
  const base = getStaticBase(kind);
  const rows = await fetchDirectoryRows(kind);
  const taken = new Set([...base.map((item) => item.id), ...rows.map((row) => row.id)]);
  let candidate = desired;
  let suffix = 2;
  while (taken.has(candidate)) candidate = `${desired}-${suffix++}`;
  return candidate;
}

export async function createDirectoryEntry(kind: DirectoryKind, resource: LibraryResource, active: boolean): Promise<LibraryResource> {
  const desired = (resource.id || '').trim() || slugify(resource.name);
  const id = await uniqueId(kind, desired);
  const created: LibraryResource = { ...resource, id, status: active ? 'active' : 'inactive' };
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('directory_databases').insert({
    id,
    directory: kind,
    name: created.name,
    is_active: active,
    payload: created,
  });
  if (error) throw new Error(error.message);
  return created;
}

export async function updateDirectoryEntry(kind: DirectoryKind, id: string, resource: LibraryResource, active: boolean): Promise<void> {
  const payload: LibraryResource = { ...resource, id, status: active ? 'active' : 'inactive' };
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('directory_databases')
    .upsert(
      {
        id,
        directory: kind,
        name: payload.name,
        is_active: active,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,directory' },
    );
  if (error) throw new Error(error.message);
}

/**
 * Deleting a shipped catalog entry hides it from the public page (soft-hide
 * overlay) instead of removing it; admin-created entries are hard-deleted.
 */
export async function deleteDirectoryEntry(kind: DirectoryKind, id: string): Promise<void> {
  const base = getStaticBase(kind);
  const staticItem = base.find((item) => item.id === id);
  const supabase = getSupabaseAdminClient();

  if (staticItem) {
    const { error } = await supabase.from('directory_databases').upsert(
      {
        id,
        directory: kind,
        name: staticItem.name,
        is_active: false,
        payload: { ...staticItem, status: 'inactive' },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,directory' },
    );
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('directory_databases').delete().eq('id', id).eq('directory', kind);
  if (error) throw new Error(error.message);
}
