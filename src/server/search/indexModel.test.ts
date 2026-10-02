import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexRepositoryItem, reindexAll } from './indexModel';

const updateMock = vi.fn();
const insertMock = vi.fn();
const deleteMock = vi.fn();
const selectMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({
    from: vi.fn(() => ({
      select: selectMock,
      update: updateMock,
      insert: insertMock,
      delete: deleteMock,
    })),
    rpc: rpcMock,
  }),
}));

function chain<T>(value: T): unknown {
  const api: Record<string, unknown> = {};
  for (const method of ['select', 'update', 'insert', 'delete', 'eq', 'order', 'limit']) {
    api[method] = vi.fn(() => chain(value));
  }
  api.maybeSingle = vi.fn(() => Promise.resolve({ data: value, error: null }));
  api.then = (resolve: (result: { data: T; error: null }) => unknown) => resolve({ data: value, error: null });
  return api;
}

describe('indexRepositoryItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockReturnValue(chain(null));
    updateMock.mockReturnValue(chain(null));
    insertMock.mockResolvedValue({ error: null });
    deleteMock.mockReturnValue(chain(null));
  });

  it('builds one search document per file with denormalized metadata', async () => {
    const item = {
      id: 'item-1',
      title: 'Thesis on Storage',
      authors: ['A. Author'],
      subjects: ['Energy'],
      keywords: ['storage'],
      abstract: 'An abstract.',
      embargo_until: null,
    };
    const files = [
      {
        id: 'file-1',
        repository_version_id: 'v1',
        uploader_id: 'user-1',
        display_filename: 'thesis.pdf',
        original_filename: 'thesis.pdf',
        extracted_text: 'full text',
        access_level: 'PUBLIC',
        embargo_until: null,
        extracted_text_status: 'COMPLETE',
      },
      {
        id: 'file-2',
        repository_version_id: null,
        uploader_id: 'user-1',
        display_filename: 'data.csv',
        original_filename: 'data.csv',
        extracted_text: null,
        access_level: 'PRIVATE',
        embargo_until: null,
        extracted_text_status: 'PENDING',
      },
    ];

    selectMock
      .mockReturnValueOnce(chain(item))
      .mockReturnValueOnce(chain(files))
      .mockReturnValueOnce(chain({ id: 'v1' }));

    const result = await indexRepositoryItem('item-1');

    expect(result.documents).toBe(2);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const rows = insertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      repository_item_id: 'item-1',
      repository_file_id: 'file-1',
      title: 'Thesis on Storage',
      access_level: 'PUBLIC',
      is_current_version: true,
      extraction_status: 'COMPLETE',
    });
    expect(rows[1]).toMatchObject({
      repository_file_id: 'file-2',
      access_level: 'PRIVATE',
      file_text: null,
      is_current_version: true,
    });
  });

  it('adds a metadata-only row when the item has no files', async () => {
    selectMock
      .mockReturnValueOnce(chain({ id: 'item-2', title: 'No Files', authors: [], subjects: [], keywords: [], abstract: null, embargo_until: null }))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain(null));

    const result = await indexRepositoryItem('item-2');

    expect(result.documents).toBe(1);
    const rows = insertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      repository_file_id: null,
      file_text: null,
      access_level: 'PUBLIC',
      is_current_version: true,
      extraction_status: 'not_required',
    });
  });

  it('marks historical version files as not current', async () => {
    selectMock
      .mockReturnValueOnce(chain({ id: 'item-3', title: 'Versioned', authors: [], subjects: [], keywords: [], abstract: null, embargo_until: null }))
      .mockReturnValueOnce(chain([
        { id: 'file-old', repository_version_id: 'v1', uploader_id: null, display_filename: 'old.pdf', original_filename: 'old.pdf', extracted_text: 'old', access_level: 'PUBLIC', embargo_until: null, extracted_text_status: 'COMPLETE' },
      ]))
      .mockReturnValueOnce(chain([{ id: 'v2' }]));

    await indexRepositoryItem('item-3');

    const rows = insertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].is_current_version).toBe(false);
  });

  it('clears existing documents before rebuilding', async () => {
    selectMock
      .mockReturnValueOnce(chain({ id: 'item-4', title: 'X', authors: [], subjects: [], keywords: [], abstract: null, embargo_until: null }))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain(null));

    await indexRepositoryItem('item-4');
    expect(deleteMock).toHaveBeenCalled();
  });
});

describe('reindexAll', () => {
  it('indexes every item and totals the documents', async () => {
    selectMock
      .mockReturnValueOnce(chain([{ id: 'a' }, { id: 'b' }]))
      .mockReturnValueOnce(chain({ id: 'a', title: 'A', authors: [], subjects: [], keywords: [], abstract: null, embargo_until: null }))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain(null))
      .mockReturnValueOnce(chain({ id: 'b', title: 'B', authors: [], subjects: [], keywords: [], abstract: null, embargo_until: null }))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain(null));

    const result = await reindexAll();
    expect(result.items).toBe(2);
    expect(result.documents).toBe(2);
  });
});
