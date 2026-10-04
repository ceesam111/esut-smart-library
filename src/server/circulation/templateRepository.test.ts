import { describe, it, expect, vi, beforeEach } from 'vitest';

const state: {
  results: Array<Record<string, unknown>>;
} = { results: [] };

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({
    from: () => {
      const result = state.results.length > 1 ? state.results.shift()! : state.results[0] ?? { data: null, error: null };
      const q: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'upsert', 'delete', 'or', 'is', 'range']) {
        q[method] = () => q;
      }
      const resolved = result;
      q.maybeSingle = () => Promise.resolve(resolved);
      q.single = () => Promise.resolve(resolved);
      q.then = (onFulfilled: unknown, onRejected: unknown) =>
        Promise.resolve(resolved).then(onFulfilled as never, onRejected as never);
      return q;
    },
  }),
}));

async function fresh() {
  vi.resetModules();
  return import('./templateRepository');
}

beforeEach(() => {
  state.results = [];
});

describe('resolveTemplate', () => {
  it('falls back to built-in template when the table is missing', async () => {
    const { resolveTemplate } = await fresh();
    state.results = [{ data: null, error: { message: 'Could not find the table public.notice_templates' } }];
    const resolved = await resolveTemplate('overdue');
    expect(resolved.source).toBe('builtin-fallback');
    expect(resolved.notice_type).toBe('overdue');
    expect(resolved.subject.length).toBeGreaterThan(0);
    expect(resolved.version).toBe(1);
  });

  it('uses the database row when available (database source wins)', async () => {
    const { resolveTemplate } = await fresh();
    state.results = [
      { data: null, error: null }, // bootstrap upsert
      {
        data: {
          id: 'tpl-overdue-custom',
          notice_type: 'overdue',
          name: 'Custom Overdue',
          subject: 'CUSTOM SUBJECT',
          body_text: 'custom body',
          channel: 'email',
          locale: 'en',
          enabled: true,
          variables: {},
          version: 4,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-02T00:00:00Z',
        },
        error: null,
      }, // select by notice_type
    ];
    const resolved = await resolveTemplate('overdue');
    expect(resolved.source).toBe('database');
    expect(resolved.id).toBe('tpl-overdue-custom');
    expect(resolved.subject).toBe('CUSTOM SUBJECT');
    expect(resolved.version).toBe(4);
  });

  it('never throws even when the database errors unexpectedly', async () => {
    const { resolveTemplate } = await fresh();
    state.results = [{ data: null, error: { message: 'boom' } }];
    const resolved = await resolveTemplate('due_soon');
    expect(resolved.source).toBe('builtin-fallback');
    expect(resolved.notice_type).toBe('due_soon');
  });
});

describe('listTemplatesDb', () => {
  it('falls back to built-in list when the table is missing', async () => {
    const { listTemplatesDb } = await fresh();
    state.results = [{ data: null, error: { message: 'relation "public.notice_templates" does not exist' } }];
    const templates = await listTemplatesDb();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => t.subject.length > 0)).toBe(true);
  });
});

describe('updateTemplate', () => {
  const row = {
    id: 'tpl-overdue-custom',
    notice_type: 'overdue',
    name: 'Custom Overdue',
    subject: 'SUBJ',
    body_text: 'body',
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {},
    version: 4,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };

  it('increments version on a successful edit', async () => {
    const { updateTemplate } = await fresh();
    state.results = [
      { data: row, error: null }, // read current
      { data: { ...row, version: 5, subject: 'NEW' }, error: null }, // update
    ];
    const updated = await updateTemplate('tpl-overdue-custom', { subject: 'NEW' });
    expect(updated.version).toBe(5);
    expect(updated.subject).toBe('NEW');
  });

  it('rejects concurrent edits with a retryable error', async () => {
    const { updateTemplate } = await fresh();
    state.results = [
      { data: row, error: null }, // read current
      { data: null, error: null }, // update matched 0 rows (version changed)
    ];
    await expect(updateTemplate('tpl-overdue-custom', { subject: 'NEW' })).rejects.toThrow(/modified concurrently/i);
  });

  it('throws when the template does not exist', async () => {
    const { updateTemplate } = await fresh();
    state.results = [{ data: null, error: null }];
    await expect(updateTemplate('missing', { subject: 'X' })).rejects.toThrow(/not found/i);
  });
});
