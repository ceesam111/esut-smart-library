import { describe, it, expect } from 'vitest';
import { mergeDirectory, rowToResource, type DirectoryRow } from './directory';
import type { LibraryResource } from '@/config/libraryResources.config';

function makeBase(): LibraryResource[] {
  return [
    {
      id: 'doaj',
      name: 'DOAJ',
      description: 'Open access journals index.',
      provider: 'DOAJ',
      subjects: ['Multidisciplinary'],
      resourceType: 'Journals',
      accessType: 'Open Access',
      accessCode: 'OA',
      url: 'https://doaj.org/',
      imageUrl: '',
      isExternal: true,
      status: 'active',
    },
    {
      id: 'legacy',
      name: 'Legacy DB',
      description: 'Old entry.',
      provider: 'Provider',
      subjects: [],
      resourceType: 'Index',
      accessType: 'Open Access',
      url: 'https://example.com/',
      imageUrl: '',
      isExternal: true,
      status: 'active',
    },
  ];
}

function makeRow(partial: Partial<DirectoryRow> & Pick<DirectoryRow, 'id'>): DirectoryRow {
  return {
    directory: 'open_access',
    name: partial.payload?.name ?? partial.id,
    is_active: true,
    payload: {},
    ...partial,
  };
}

describe('mergeDirectory', () => {
  it('returns base catalog entries untouched when there are no overlay rows', () => {
    const entries = mergeDirectory('open_access', makeBase(), [], false);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.source === 'catalog' && e.active)).toBe(true);
    expect(entries[0].resource.id).toBe('doaj');
  });

  it('replaces a catalog entry when an overlay row has the same id', () => {
    const rows = [makeRow({ id: 'doaj', name: 'DOAJ (updated)', payload: { name: 'DOAJ (updated)', url: 'https://doaj.org/' } })];
    const entries = mergeDirectory('open_access', makeBase(), rows, false);
    expect(entries).toHaveLength(2);
    const doaj = entries.find((e) => e.resource.id === 'doaj');
    expect(doaj?.resource.name).toBe('DOAJ (updated)');
    expect(doaj?.source).toBe('catalog');
    expect(doaj?.active).toBe(true);
  });

  it('hides a catalog entry when its overlay row is inactive', () => {
    const rows = [makeRow({ id: 'doaj', is_active: false, payload: { name: 'DOAJ' } })];
    const publicView = mergeDirectory('open_access', makeBase(), rows, false);
    expect(publicView.find((e) => e.resource.id === 'doaj')).toBeUndefined();
    expect(publicView).toHaveLength(1);

    const adminView = mergeDirectory('open_access', makeBase(), rows, true);
    const doaj = adminView.find((e) => e.resource.id === 'doaj');
    expect(doaj?.active).toBe(false);
    expect(doaj?.resource.status).toBe('inactive');
    expect(adminView).toHaveLength(2);
  });

  it('appends admin-created custom entries', () => {
    const rows = [makeRow({ id: 'custom-one', name: 'My DB', payload: { name: 'My DB', url: 'https://my.db/' } })];
    const entries = mergeDirectory('open_access', makeBase(), rows, false);
    expect(entries).toHaveLength(3);
    const custom = entries.find((e) => e.resource.id === 'custom-one');
    expect(custom?.source).toBe('custom');
    expect(custom?.active).toBe(true);
  });

  it('excludes inactive custom entries from the public view only', () => {
    const rows = [makeRow({ id: 'custom-one', name: 'My DB', is_active: false, payload: { name: 'My DB' } })];
    expect(mergeDirectory('open_access', makeBase(), rows, false)).toHaveLength(2);
    const adminView = mergeDirectory('open_access', makeBase(), rows, true);
    expect(adminView).toHaveLength(3);
    expect(adminView.find((e) => e.resource.id === 'custom-one')?.active).toBe(false);
  });

  it('ignores rows from a different directory', () => {
    const rows = [makeRow({ id: 'sub-only', directory: 'subscribed', payload: { name: 'Sub only' } })];
    const entries = mergeDirectory('open_access', makeBase(), rows, false);
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.resource.id === 'sub-only')).toBeUndefined();
  });
});

describe('rowToResource', () => {
  it('maps active rows to an active resource with payload fields', () => {
    const resource = rowToResource(
      makeRow({ id: 'x', name: 'X', payload: { name: 'X', provider: 'P', url: 'https://x.test/' } }),
    );
    expect(resource.id).toBe('x');
    expect(resource.provider).toBe('P');
    expect(resource.status).toBe('active');
  });

  it('maps inactive rows to an inactive resource', () => {
    const resource = rowToResource(makeRow({ id: 'x', is_active: false, payload: { name: 'X' } }));
    expect(resource.status).toBe('inactive');
  });
});
