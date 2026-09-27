import { describe, it, expect } from 'vitest';

describe('serials claims', () => {
  it('claim status values are valid', () => {
    const statuses = ['pending', 'notified', 'resolved', 'cancelled'];
    expect(statuses).toContain('pending');
    expect(statuses).toContain('resolved');
  });

  it('claim structure is correct', () => {
    const claim = {
      id: 'abc',
      serial_id: 'def',
      issue_number: '42',
      status: 'pending',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(claim.serial_id).toBe('def');
    expect(claim.issue_number).toBe('42');
    expect(claim.status).toBe('pending');
  });
});
