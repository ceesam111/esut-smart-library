import { describe, it, expect } from 'vitest';
import { assertRestoreTarget, findUnsafePaths, isRestoreTarget, preflightRestore, RESTORE_TARGETS } from './restore';
import { canApplyIncidentAction, incidentTransitionPatch } from './incidents';
import { getBearerToken } from '../auth/requireUser';

describe('restore safety (B12, B13)', () => {
  it('only accepts isolated, test and staging targets', () => {
    expect(RESTORE_TARGETS).toEqual(['isolated', 'test', 'staging']);
    for (const target of RESTORE_TARGETS) {
      expect(isRestoreTarget(target)).toBe(true);
      expect(assertRestoreTarget(target)).toEqual({ ok: true, target });
    }
  });

  it('fails closed on production, unknown and empty targets', () => {
    for (const target of ['production', 'live', 'prod', '', undefined, null, 0, {}]) {
      const result = assertRestoreTarget(target);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/not allowed/i);
    }
  });

  it('rejects absolute and parent-traversing paths', () => {
    expect(findUnsafePaths(['../etc/passwd', '/etc/passwd', 'C:\\windows', 'a\\b', 'ok/file.txt'])).toEqual([
      '../etc/passwd',
      '/etc/passwd',
      'C:\\windows',
      'a\\b',
    ]);
  });

  it('blocks restore preflight when the bag contains a traversal path', () => {
    const preflight = preflightRestore({
      bagName: 'item-x',
      files: new Map([
        ['../escape.txt', Buffer.from('nope')],
        ['bagit.txt', Buffer.from('Bag-It-Version: 1.0\nTag-File-Character-Encoding: UTF-8\n')],
      ]),
    });
    expect(preflight.valid).toBe(false);
    expect(preflight.errors.join('\n')).toMatch(/Unsafe path in AIP/);
  });
});

describe('incident lifecycle (B5)', () => {
  it('allows acknowledge then resolve but not the reverse', () => {
    expect(canApplyIncidentAction('open', 'acknowledged')).toBe(true);
    expect(canApplyIncidentAction('open', 'resolved')).toBe(true);
    expect(canApplyIncidentAction('acknowledged', 'resolved')).toBe(true);
    expect(canApplyIncidentAction('acknowledged', 'acknowledged')).toBe(false);
    expect(canApplyIncidentAction('resolved', 'acknowledged')).toBe(false);
    expect(canApplyIncidentAction('resolved', 'reopened')).toBe(true);
  });

  it('stamps actor and timestamp on each transition', () => {
    const now = new Date('2026-09-30T12:00:00.000Z');
    const ack = incidentTransitionPatch('acknowledged', 'actor-1', 'looking into it', now);
    expect(ack.status).toBe('acknowledged');
    expect(ack.patch.acknowledged_by).toBe('actor-1');
    expect(ack.patch.acknowledged_at).toBe('2026-09-30T12:00:00.000Z');

    const done = incidentTransitionPatch('resolved', 'actor-2', 'restored from backup', now);
    expect(done.status).toBe('resolved');
    expect(done.patch.resolved_by).toBe('actor-2');
    expect(done.patch.resolution_note).toBe('restored from backup');
  });
});

describe('preservation API authentication (B18, B19)', () => {
  it('requires a bearer token', () => {
    expect(getBearerToken(new Request('http://localhost/api/preservation/overview'))).toBeNull();
    expect(getBearerToken(new Request('http://localhost', { headers: { authorization: 'Basic abc' } }))).toBeNull();
    expect(getBearerToken(new Request('http://localhost', { headers: { authorization: 'Bearer   token-value  ' } }))).toBe('token-value');
  });
});
