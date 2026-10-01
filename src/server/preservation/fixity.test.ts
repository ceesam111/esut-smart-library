import { describe, it, expect } from 'vitest';
import { classifyFixity, resolveBatchSize, resolveCadenceDays, nextDueAt, FIXITY_STATES, DEFAULT_BATCH_SIZE } from './fixity';

const EXPECTED = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

function ok(bytes: Buffer) {
  return { status: 'ok' as const, bytes };
}

describe('fixity state machine (B3)', () => {
  it('reports VALID when observed bytes match the expected checksum', () => {
    const decision = classifyFixity({ read: ok(Buffer.from('hello world')), expected: EXPECTED, algorithm: 'sha256' });
    expect(decision.state).toBe('VALID');
    expect(decision.event).toBe('FIXITY_VERIFIED');
    expect(decision.incident).toBeNull();
    expect(decision.recordCalculatedChecksum).toBe(false);
    expect(decision.observed).toBe(EXPECTED);
  });

  it('reports MISMATCH and opens an incident without overwriting the expected checksum', () => {
    const decision = classifyFixity({ read: ok(Buffer.from('changed')), expected: EXPECTED, algorithm: 'sha256' });
    expect(decision.state).toBe('MISMATCH');
    expect(decision.event).toBe('FIXITY_FAILED');
    expect(decision.incident?.type).toBe('MISMATCH');
    expect(decision.incident?.expected).toBe(EXPECTED);
    expect(decision.recordCalculatedChecksum).toBe(false);
    expect(decision.observed).toBe(EXPECTED === decision.observed ? 'x' : decision.observed);
    expect(decision.observed).not.toBe(EXPECTED);
  });

  it('reports MISSING and opens a MISSING incident', () => {
    const decision = classifyFixity({ read: { status: 'missing' }, expected: EXPECTED, algorithm: 'sha256' });
    expect(decision.state).toBe('MISSING');
    expect(decision.incident?.type).toBe('MISSING');
    expect(decision.event).toBe('FIXITY_FAILED');
  });

  it('reports ERROR for an unreadable object without opening an incident', () => {
    const decision = classifyFixity({ read: { status: 'error', error: 'HTTP 500' }, expected: EXPECTED, algorithm: 'sha256' });
    expect(decision.state).toBe('ERROR');
    expect(decision.incident).toBeNull();
    expect(decision.event).toBe('FIXITY_FAILED');
    expect(decision.note).toMatch(/not evidence of corruption/i);
  });

  it('reports ERROR for an inactive storage provider without opening an incident', () => {
    const decision = classifyFixity({ read: { status: 'inactive', provider: 'b2', error: 'not configured' }, expected: EXPECTED, algorithm: 'sha256' });
    expect(decision.state).toBe('ERROR');
    expect(decision.incident).toBeNull();
    expect(decision.eventDetails.reason).toBe('storage_provider_inactive');
  });

  it('calculates and records a checksum only when none exists', () => {
    const decision = classifyFixity({ read: ok(Buffer.from('hello world')), expected: null, algorithm: 'sha256' });
    expect(decision.state).toBe('VALID');
    expect(decision.recordCalculatedChecksum).toBe(true);
    expect(decision.event).toBe('CHECKSUM_CALCULATED');
    expect(decision.observed).toBe(EXPECTED);
  });

  it('refuses unsupported algorithms instead of guessing', () => {
    const decision = classifyFixity({ read: ok(Buffer.from('hello world')), expected: EXPECTED, algorithm: 'md5' });
    expect(decision.state).toBe('ERROR');
    expect(decision.incident).toBeNull();
    expect(decision.eventDetails.reason).toBe('unsupported_algorithm');
  });

  it('exposes exactly the documented states', () => {
    expect([...FIXITY_STATES]).toEqual(['PENDING', 'VALID', 'MISMATCH', 'MISSING', 'ERROR']);
  });
});

describe('fixity scheduling inputs (B2)', () => {
  it('honours the producer payload cadence', () => {
    expect(resolveCadenceDays(30, '999')).toBe(30);
  });

  it('rejects out of range cadences and falls back', () => {
    expect(resolveCadenceDays(0, '0')).toBe(7);
    expect(resolveCadenceDays(-1, 'abc')).toBe(7);
    expect(resolveCadenceDays(undefined, undefined)).toBe(7);
  });

  it('bounds the batch size', () => {
    expect(resolveBatchSize(10)).toBe(10);
    expect(resolveBatchSize(0)).toBe(DEFAULT_BATCH_SIZE);
    expect(resolveBatchSize(9999)).toBe(500);
  });

  it('schedules the next verification a full cadence ahead', () => {
    const now = new Date('2026-09-30T00:00:00.000Z');
    expect(nextDueAt(7, now)).toBe('2026-10-07T00:00:00.000Z');
  });
});
