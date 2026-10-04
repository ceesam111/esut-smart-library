import { describe, it, expect } from 'vitest';
import { renderNotice, getTemplate, listTemplates, type NoticeTemplate } from './notices';

describe('notice template rendering', () => {
  it('renders variables in subject and body', () => {
    const template = getTemplate('overdue');
    const result = renderNotice(template, {
      patron_name: 'Jane Doe',
      item_title: 'Test Book',
      due_date: '2026-10-01',
    });
    expect(result.subject).toBe('Overdue Notice: Test Book');
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('Test Book');
    expect(result.text).toContain('2026-10-01');
  });

  it('escapes HTML in variable values', () => {
    const template = getTemplate('overdue');
    const result = renderNotice(template, {
      patron_name: '<script>alert("xss")</script>',
      item_title: 'Test Book',
      due_date: '2026-10-01',
    });
    expect(result.html).not.toContain('<script>');
    expect(result.text).not.toContain('<script>');
  });

  it('handles missing optional variables gracefully', () => {
    const template = getTemplate('overdue');
    const result = renderNotice(template, {
      patron_name: 'Jane',
      item_title: 'Book',
      due_date: '2026-10-01',
    });
    expect(result.subject).toBe('Overdue Notice: Book');
  });

  it('handles date objects', () => {
    const template = getTemplate('due_soon');
    const result = renderNotice(template, {
      patron_name: 'Jane',
      item_title: 'Book',
      due_date: new Date('2026-10-15'),
    });
    expect(result.text).toContain('2026-10-15');
  });

  it('strips script tags from HTML body', () => {
    const template: NoticeTemplate = {
      ...getTemplate('overdue'),
      body_html: '<p>Hello</p><script>alert("xss")</script>',
    };
    const result = renderNotice(template, {
      patron_name: 'Jane',
      item_title: 'Book',
      due_date: '2026-10-01',
    });
    expect(result.html).not.toContain('<script>');
  });

  it('lists all templates', () => {
    const templates = listTemplates();
    expect(templates.length).toBeGreaterThan(0);
    const types = templates.map((t) => t.notice_type);
    expect(types).toContain('checkout_receipt');
    expect(types).toContain('overdue');
    expect(types).toContain('hold_ready');
    expect(types).toContain('published');
  });

  it('lists templates filtered by channel', () => {
    const emailTemplates = listTemplates('email');
    expect(emailTemplates.every((t) => t.channel === 'email')).toBe(true);
  });

  it('handles all notice types', () => {
    const allTypes = listTemplates();
    const uniqueTypes = new Set(allTypes.map((t) => t.notice_type));
    expect(uniqueTypes.size).toBeGreaterThanOrEqual(20);
  });
});

describe('notice type taxonomy', () => {
  it('includes circulation notice types', () => {
    const templates = listTemplates();
    const types = templates.map((t) => t.notice_type);
    expect(types).toContain('checkout_receipt');
    expect(types).toContain('checkin_receipt');
    expect(types).toContain('due_soon');
    expect(types).toContain('overdue');
    expect(types).toContain('overdue_escalation');
    expect(types).toContain('hold_ready');
    expect(types).toContain('hold_cancelled');
    expect(types).toContain('renewal_confirmation');
    expect(types).toContain('fine_notice');
  });

  it('includes account notice types', () => {
    const templates = listTemplates();
    const types = templates.map((t) => t.notice_type);
    expect(types).toContain('welcome');
    expect(types).toContain('email_verification');
    expect(types).toContain('password_reset');
    expect(types).toContain('account_expiry');
    expect(types).toContain('account_restriction');
  });

  it('includes repository notice types', () => {
    const templates = listTemplates();
    const types = templates.map((t) => t.notice_type);
    expect(types).toContain('submission_received');
    expect(types).toContain('reviewer_assigned');
    expect(types).toContain('changes_requested');
    expect(types).toContain('approved');
    expect(types).toContain('rejected');
    expect(types).toContain('published');
  });

  it('includes acquisitions notice types', () => {
    const templates = listTemplates();
    const types = templates.map((t) => t.notice_type);
    expect(types).toContain('claim_notice');
    expect(types).toContain('order_notice');
    expect(types).toContain('vendor_notice');
  });
});
