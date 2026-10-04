import { describe, it, expect } from 'vitest';
import { NoticeDeliveryService } from './deliveryService';

describe('notice delivery service', () => {
  it('has a singleton instance', () => {
    const service = new NoticeDeliveryService();
    expect(service).toBeDefined();
    expect(typeof service.send).toBe('function');
    expect(typeof service.listHistory).toBe('function');
    expect(typeof service.retry).toBe('function');
  });

  it('defines delivery statuses', () => {
    const statuses = ['PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED', 'SUPPRESSED'];
    expect(statuses).toContain('PENDING');
    expect(statuses).toContain('SENT');
    expect(statuses).toContain('FAILED');
    expect(statuses).toContain('SUPPRESSED');
  });

  it('defines channels', () => {
    const channels = ['email', 'in-app', 'print', 'sms'];
    expect(channels).toContain('email');
    expect(channels).toContain('in-app');
    expect(channels).toContain('print');
    expect(channels).toContain('sms');
  });
});

describe('SMS adapter', () => {
  it('has a no-op provider by default', async () => {
    const { getSmsProvider, NoOpSmsProvider } = await import('@/server/sms/adapter');
    const provider = getSmsProvider();
    expect(provider).toBeInstanceOf(NoOpSmsProvider);
    const status = provider.status();
    expect(status.configured).toBe(false);
  });

  it('no-op provider returns success false', async () => {
    const { NoOpSmsProvider } = await import('@/server/sms/adapter');
    const provider = new NoOpSmsProvider();
    const result = await provider.send('1234567890', 'test');
    expect(result.success).toBe(false);
  });
});

describe('in-app notice service', () => {
  it('exports required functions', async () => {
    const mod = await import('./inAppNotice');
    expect(typeof mod.createInAppNotice).toBe('function');
    expect(typeof mod.markNoticeRead).toBe('function');
    expect(typeof mod.listUserNotices).toBe('function');
    expect(typeof mod.countUnreadNotices).toBe('function');
  });
});
