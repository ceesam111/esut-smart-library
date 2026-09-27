import { describe, it, expect } from 'vitest';
import { createCoarNotify, validateCoarNotify } from '@/server/interoperability/coar-notify';

describe('coar-notify', () => {
  it('creates valid COAR Notify notification', () => {
    const notification = createCoarNotify({
      actorId: 'https://example.com/actor',
      objectId: 'https://example.com/object',
      targetId: 'https://example.com/target',
    });
    expect(notification['@context']).toContain('activitystreams');
    expect(notification.type).toContain('coar-notify:EndorsementAction');
    expect(notification.actor.id).toBe('https://example.com/actor');
  });

  it('validates COAR Notify payload', () => {
    const valid = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://example.com/1',
      type: ['coar-notify:EndorsementAction'],
      actor: { id: 'https://example.com/a', type: 'Service' },
      object: { id: 'https://example.com/o', type: 'Document' },
      target: { id: 'https://example.com/t', type: 'Service' },
    };
    expect(validateCoarNotify(valid)).toBe(true);
    expect(validateCoarNotify(null)).toBe(false);
    expect(validateCoarNotify({})).toBe(false);
  });
});
