import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { classifyBot, hashIp } from './eventCapture';
import { buildCsv, escapeCsvValue } from './csv';
import { buildSegments, SMALL_GROUP_THRESHOLD } from './segmentation';

describe('federated events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks federated search with provider mix and failures', async () => {
    const { trackFederatedSearch } = await import('./federatedEvents');
    await trackFederatedSearch('quantum computing', 12, ['local', 'OpenAlex', 'Crossref'], ['Crossref: timeout'], {
      userId: 'user-1',
      faculty: 'Science',
      patronRole: 'student',
    });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.event_type).toBe('federated_search');
    expect(payload.search_query).toBe('quantum computing');
    expect(payload.result_count).toBe(12);
    expect(payload.provider).toBe('local,OpenAlex,Crossref');
    expect(payload.metadata.provider_mix).toEqual(['local', 'OpenAlex', 'Crossref']);
    expect(payload.metadata.provider_failures).toEqual(['Crossref: timeout']);
    expect(payload.faculty).toBe('Science');
    expect(payload.patron_role).toBe('student');
  });

  it('tracks federated result click for local items', async () => {
    const { trackFederatedResultClick } = await import('./federatedEvents');
    await trackFederatedResultClick('quantum computing', 'ESUT Library', 'item-9', { userId: 'user-1' });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.event_type).toBe('federated_result_click');
    expect(payload.entity_id).toBe('item-9');
    expect(payload.provider).toBe('ESUT Library');
  });

  it('tracks provider result click for external results', async () => {
    const { trackProviderResultClick } = await import('./federatedEvents');
    await trackProviderResultClick('quantum computing', 'OpenAlex', 'ext-42', { userId: 'user-1' });
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.event_type).toBe('provider_result_click');
    expect(payload.entity_id).toBe('ext-42');
    expect(payload.provider).toBe('OpenAlex');
  });
});

describe('csv export', () => {
  it('escapes formula injection prefixes', () => {
    expect(escapeCsvValue('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(escapeCsvValue('+1234')).toBe("'+1234");
    expect(escapeCsvValue('-cmd')).toBe("'-cmd");
    expect(escapeCsvValue('@import')).toBe("'@import");
  });

  it('quotes plain values and escapes embedded quotes', () => {
    expect(escapeCsvValue('hello')).toBe('"hello"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue(null)).toBe('""');
  });

  it('builds csv with header row', () => {
    const csv = buildCsv([
      { title: 'Book A', count: 3 },
      { title: 'Book B', count: 7 },
    ]);
    expect(csv).toBe('title,count\n"Book A","3"\n"Book B","7"');
  });

  it('returns empty string for no rows', () => {
    expect(buildCsv([])).toBe('');
  });
});

describe('segmentation and small-group suppression', () => {
  it('suppresses segments below the threshold', () => {
    const events = [
      { faculty: 'Science', event_type: 'checkout' },
      { faculty: 'Science', event_type: 'checkout' },
      { faculty: 'Science', event_type: 'catalogue_search' },
      { faculty: 'Science', event_type: 'catalogue_search' },
      { faculty: 'Science', event_type: 'catalogue_search' },
      { faculty: 'Arts', event_type: 'checkout' },
      { faculty: 'Arts', event_type: 'catalogue_search' },
    ];
    const result = buildSegments(events, 'faculty');
    const science = result.find((s) => s.segment === 'Science');
    const arts = result.find((s) => s.segment === 'Arts');
    expect(science?.total).toBe(5);
    expect(science?.counts).toEqual({ checkout: 2, catalogue_search: 3 });
    expect(arts?.total).toBe('SUPPRESSED');
    expect(arts?.counts).toEqual({});
  });

  it('groups by department and patron_role', () => {
    const events = Array.from({ length: SMALL_GROUP_THRESHOLD }, () => ({
      department: 'Physics',
      patron_role: 'student',
      event_type: 'repository_item_view',
    }));
    const byDept = buildSegments(events, 'department');
    expect(byDept[0].segment).toBe('Physics');
    expect(byDept[0].total).toBe(SMALL_GROUP_THRESHOLD);

    const byRole = buildSegments(events, 'patron_role');
    expect(byRole[0].segment).toBe('student');
  });

  it('sorts segments by total descending', () => {
    const events = [
      ...Array.from({ length: 6 }, () => ({ faculty: 'Big', event_type: 'checkout' })),
      ...Array.from({ length: 5 }, () => ({ faculty: 'Small', event_type: 'checkout' })),
    ];
    const result = buildSegments(events, 'faculty');
    expect(result[0].segment).toBe('Big');
    expect(result[1].segment).toBe('Small');
  });
});

describe('observability metrics', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('counts attempted, persisted, and human events', async () => {
    const { captureEvent: capture, getAnalyticsMetrics: metrics } = await import('./eventCapture');
    await capture({ event_type: 'catalogue_view', entity_id: '1' });
    const m = metrics();
    expect(m.eventsAttempted).toBe(1);
    expect(m.eventsPersisted).toBe(1);
    expect(m.humanEvents).toBe(1);
    expect(m.writeFailures).toBe(0);
    expect(m.lastSuccessAt).toBeTruthy();
  });

  it('counts bot events separately', async () => {
    const { captureEvent: capture, getAnalyticsMetrics: metrics } = await import('./eventCapture');
    await capture({ event_type: 'page_view', user_agent: 'Googlebot/2.1', path: '/' });
    const m = metrics();
    expect(m.botEvents).toBe(1);
    expect(m.humanEvents).toBe(0);
  });

  it('counts write failures when insert returns an error', async () => {
    mockInsert.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });
    const { captureEvent: capture, getAnalyticsMetrics: metrics } = await import('./eventCapture');
    await capture({ event_type: 'catalogue_view', entity_id: '1' });
    const m = metrics();
    expect(m.eventsAttempted).toBe(1);
    expect(m.eventsPersisted).toBe(0);
    expect(m.writeFailures).toBe(1);
    expect(m.lastFailureAt).toBeTruthy();
  });

  it('counts write failures when insert throws', async () => {
    mockInsert.mockRejectedValueOnce(new Error('network'));
    const { captureEvent: capture, getAnalyticsMetrics: metrics } = await import('./eventCapture');
    await capture({ event_type: 'catalogue_view', entity_id: '1' });
    const m = metrics();
    expect(m.writeFailures).toBe(1);
  });
});

describe('ip hashing', () => {
  it('is deterministic and does not leak the raw ip', () => {
    const a = hashIp('10.0.0.1');
    const b = hashIp('10.0.0.1');
    expect(a).toBe(b);
    expect(a).not.toContain('10.0.0.1');
    expect(a).toHaveLength(32);
  });

  it('differs for different ips', () => {
    expect(hashIp('10.0.0.1')).not.toBe(hashIp('10.0.0.2'));
  });
});

describe('bot classification', () => {
  it('classifies monitoring and crawler agents as bots', () => {
    expect(classifyBot('Googlebot/2.1')).toBe('BOT');
    expect(classifyBot('Pingdom.com_bot_version_1.4')).toBe('BOT');
    expect(classifyBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBeNull();
  });
});
