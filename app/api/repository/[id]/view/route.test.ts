import { describe, it, expect, vi, beforeEach } from 'vitest';

let itemRow: { id: string; status: string; faculty_code: string | null; department: string | null } | null = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  status: 'published',
  faculty_code: 'ENG',
  department: 'Electrical',
};

const insertedEvents: Array<Record<string, unknown>> = [];
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

class ItemRecorder {
  calls: string[] = [];
  or(_expr: string) { this.calls.push(`or:${_expr}`); return this; }
  select(_cols: string) { this.calls.push('select'); return this; }
  maybeSingle() { return Promise.resolve({ data: itemRow, error: null }); }
}

class EventRecorder {
  insert(row: Record<string, unknown>) { insertedEvents.push(row); return Promise.resolve({ data: null, error: null }); }
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'repository_items') return new ItemRecorder();
  return new EventRecorder();
});

const mockRpc = vi.fn(async (name: string, args: Record<string, unknown>): Promise<{ data: number | null; error: { message: string } | null }> => {
  rpcCalls.push({ name, args });
  return { data: 7, error: null };
});

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

import { POST } from './route';

function makeRequest(opts: { ip?: string; ua?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (opts.ip) headers.set('x-forwarded-for', opts.ip);
  if (opts.ua) headers.set('user-agent', opts.ua);
  if (opts.body !== undefined) headers.set('content-type', 'application/json');
  return new Request('http://localhost/api/repository/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/view', {
    method: 'POST',
    headers,
    body: opts.body === undefined ? null : JSON.stringify(opts.body),
  }) as never;
}

function makeParams(id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') {
  return { params: Promise.resolve({ id }) };
}

describe('repository view counter route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedEvents.length = 0;
    rpcCalls.length = 0;
    itemRow = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'published',
      faculty_code: 'ENG',
      department: 'Electrical',
    };
  });

  it('rejects item references with invalid characters', async () => {
    const response = await POST(makeRequest(), makeParams('bad!id'));
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown items', async () => {
    itemRow = null;
    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 404 for unpublished items', async () => {
    itemRow = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'review', faculty_code: null, department: null };
    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('increments published items for human visitors and records a human event', async () => {
    const response = await POST(makeRequest({ ip: '203.0.113.5', ua: 'Mozilla/5.0' }), makeParams());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, counted: true, view_count: 7 });
    expect(rpcCalls).toEqual([{ name: 'increment_repository_view_count', args: { p_item_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }]);
    expect(insertedEvents).toHaveLength(1);
    expect(insertedEvents[0].event_type).toBe('repository_item_view');
    expect(insertedEvents[0].bot_flag).toBe('HUMAN');
    expect(insertedEvents[0].entity_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(insertedEvents[0].faculty).toBe('ENG');
    expect(String(insertedEvents[0].ip_hash)).toHaveLength(32);
  });

  it('never increments for bots but still captures a bot-flagged event', async () => {
    const response = await POST(makeRequest({ ip: '66.249.66.1', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }), makeParams());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, counted: false });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(insertedEvents).toHaveLength(1);
    expect(insertedEvents[0].bot_flag).toBe('BOT');
  });

  it('deduplicates repeated views from the same IP within the window', async () => {
    const first = await POST(makeRequest({ ip: '198.51.100.9', ua: 'Mozilla/5.0' }), makeParams());
    const firstBody = await first.json();
    expect(firstBody.counted).toBe(true);

    const second = await POST(makeRequest({ ip: '198.51.100.9', ua: 'Mozilla/5.0' }), makeParams());
    const secondBody = await second.json();
    expect(secondBody).toEqual({ success: true, counted: false, deduped: true });
    expect(rpcCalls).toHaveLength(1);
    expect(insertedEvents).toHaveLength(1);
  });

  it('counts separate IPs independently', async () => {
    await POST(makeRequest({ ip: '198.51.100.10', ua: 'Mozilla/5.0' }), makeParams());
    const response = await POST(makeRequest({ ip: '198.51.100.11', ua: 'Mozilla/5.0' }), makeParams());
    const body = await response.json();
    expect(body.counted).toBe(true);
    expect(rpcCalls).toHaveLength(2);
  });

  it('increments downloads through the download counter without deduplication', async () => {
    const first = await POST(makeRequest({ ip: '192.0.2.1', ua: 'Mozilla/5.0', body: { action: 'download' } }), makeParams());
    const firstBody = await first.json();
    expect(firstBody).toEqual({ success: true, counted: true, download_count: 7 });
    expect(rpcCalls[0].name).toBe('increment_repository_download_count');

    const second = await POST(makeRequest({ ip: '192.0.2.1', ua: 'Mozilla/5.0', body: { action: 'download' } }), makeParams());
    const secondBody = await second.json();
    expect(secondBody.counted).toBe(true);
    expect(rpcCalls).toHaveLength(2);
    expect(insertedEvents.every((e) => e.event_type === 'repository_file_download')).toBe(true);
  });

  it('accepts handle-style references', async () => {
    const response = await POST(makeRequest({ ip: '203.0.113.77', ua: 'Mozilla/5.0' }), makeParams('esut.2024.001'));
    expect(response.status).toBe(200);
    expect(rpcCalls).toHaveLength(1);
  });

  it('degrades gracefully when the counter function is unavailable', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'function does not exist' } });
    const response = await POST(makeRequest({ ip: '203.0.113.88', ua: 'Mozilla/5.0' }), makeParams());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, counted: false });
    expect(insertedEvents).toHaveLength(1);
    expect(insertedEvents[0].bot_flag).toBe('HUMAN');
  });
});
