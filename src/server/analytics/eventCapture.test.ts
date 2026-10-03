import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { captureEvent, capturePageView, classifyBot, sanitizeMetadata } from './eventCapture';

describe('eventCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures valid event', async () => {
    await captureEvent({ event_type: 'catalogue_view', entity_id: '123' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });

  it('rejects invalid event type', async () => {
    await captureEvent({ event_type: 'invalid_type' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('sanitizes metadata', () => {
    const result = sanitizeMetadata({ password: 'secret', title: 'Hello', token: 'abc' });
    expect(result.password).toBeUndefined();
    expect(result.token).toBeUndefined();
    expect(result.title).toBe('Hello');
  });

  it('classifies known bots', () => {
    expect(classifyBot('Googlebot/2.1')).toBe('BOT');
    expect(classifyBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBeNull();
  });

  it('captures anonymous event', async () => {
    await captureEvent({ event_type: 'page_view', user_id: null, path: '/home' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });

  it('captures authenticated event', async () => {
    await captureEvent({ event_type: 'catalogue_view', user_id: 'user-123', entity_id: 'item-456' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });

  it('does not create duplicate page views within 5 seconds', async () => {
    await capturePageView({ event_type: 'page_view', session_id: 'sess-1', path: '/page' });
    await capturePageView({ event_type: 'page_view', session_id: 'sess-1', path: '/page' });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

describe('catalogue events', () => {
  it('tracks catalogue view', async () => {
    const { trackCatalogueView } = await import('./catalogueEvents');
    await trackCatalogueView('item-123', { userId: 'user-1' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });

  it('tracks catalogue search', async () => {
    const { trackCatalogueSearch } = await import('./catalogueEvents');
    await trackCatalogueSearch('education', 5, { userId: 'user-1' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });

  it('tracks catalogue result click', async () => {
    const { trackCatalogueResultClick } = await import('./catalogueEvents');
    await trackCatalogueResultClick('item-123', 'education', { userId: 'user-1' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });
});

describe('repository events', () => {
  it('tracks repository item view', async () => {
    const { trackRepositoryItemView } = await import('./repositoryEvents');
    await trackRepositoryItemView('repo-123', { userId: 'user-1' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });

  it('tracks repository file download', async () => {
    const { trackRepositoryFileDownload } = await import('./repositoryEvents');
    await trackRepositoryFileDownload('repo-123', 'file-456', 'v1', { userId: 'user-1' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });
});

describe('circulation events', () => {
  it('tracks checkout', async () => {
    const { trackCheckout } = await import('./circulationEvents');
    await trackCheckout('loan-1', 'item-1', { userId: 'user-1' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });

  it('tracks checkin', async () => {
    const { trackCheckin } = await import('./circulationEvents');
    await trackCheckin('loan-1', 'item-1', { userId: 'user-1' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });

  it('tracks renewal', async () => {
    const { trackRenewal } = await import('./circulationEvents');
    await trackRenewal('loan-1', 'item-1', { userId: 'user-1' });
    expect(mockFrom).toHaveBeenCalledWith('analytics_events');
  });
});
