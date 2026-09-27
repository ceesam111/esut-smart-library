import { describe, it, expect } from 'vitest';
import { generateNoticeContent } from '@/server/circulation/notices';

describe('notices', () => {
  it('generates overdue notice', () => {
    const result = generateNoticeContent({
      type: 'overdue',
      recipient_email: 'test@example.com',
      recipient_name: 'Test User',
      item_title: 'Test Book',
      due_date: '2026-01-01',
    });
    expect(result.subject).toContain('Overdue');
    expect(result.html).toContain('Test Book');
    expect(result.text).toContain('Test Book');
  });

  it('generates due soon notice', () => {
    const result = generateNoticeContent({
      type: 'due_soon',
      recipient_email: 'test@example.com',
      recipient_name: 'Test User',
      item_title: 'Test Book',
      due_date: '2026-01-15',
    });
    expect(result.subject).toContain('Due Soon');
  });

  it('generates hold available notice', () => {
    const result = generateNoticeContent({
      type: 'hold_available',
      recipient_email: 'test@example.com',
      recipient_name: 'Test User',
      item_title: 'Test Book',
    });
    expect(result.subject).toContain('Hold Available');
  });

  it('generates receipt notice', () => {
    const result = generateNoticeContent({
      type: 'receipt',
      recipient_email: 'test@example.com',
      recipient_name: 'Test User',
      item_title: 'Test Book',
      return_date: '2026-01-20',
    });
    expect(result.subject).toContain('Return Receipt');
  });

  it('generates fine notice with amount', () => {
    const result = generateNoticeContent({
      type: 'fine',
      recipient_email: 'test@example.com',
      recipient_name: 'Test User',
      item_title: 'Test Book',
      fine_amount: 500,
    });
    expect(result.subject).toContain('Fine');
    expect(result.html).toContain('500');
  });
});
