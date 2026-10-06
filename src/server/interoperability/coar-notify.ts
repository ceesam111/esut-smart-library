import { generateCoarNonce, isCoarConfigured, signCoarPayload } from '@/server/interoperability/coar-security';

export interface CoarNotifyNotification {
  '@context': string;
  id: string;
  type: string[];
  actor: {
    id: string;
    type: string;
  };
  object: {
    id: string;
    type: string;
    'ietf:cite-as'?: string;
  };
  target: {
    id: string;
    type: string;
  };
}

export function createCoarNotify(input: {
  actorId: string;
  objectId: string;
  targetId: string;
  objectType?: string;
}): CoarNotifyNotification {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `https://esutlibrary.edu.ng/notify/${crypto.randomUUID()}`,
    type: ['coar-notify:EndorsementAction', 'Like'],
    actor: {
      id: input.actorId,
      type: 'Service',
    },
    object: {
      id: input.objectId,
      type: input.objectType || 'https://purl.org/coar/resource_type/c_6501',
    },
    target: {
      id: input.targetId,
      type: 'Service',
    },
  };
}

export async function sendCoarNotify(notification: CoarNotifyNotification, inboxUrl: string): Promise<boolean> {
  try {
    const body = JSON.stringify(notification);
    const headers: Record<string, string> = { 'Content-Type': 'application/ld+json' };
    if (isCoarConfigured()) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      headers['x-coar-timestamp'] = timestamp;
      headers['x-coar-nonce'] = generateCoarNonce();
      headers['x-coar-signature'] = signCoarPayload(body, timestamp);
    }
    const res = await fetch(inboxUrl, { method: 'POST', headers, body });
    return res.ok;
  } catch {
    return false;
  }
}

export function validateCoarNotify(payload: unknown): payload is CoarNotifyNotification {
  if (!payload || typeof payload !== 'object') return false;
  const n = payload as Record<string, unknown>;
  const hasStringId = (value: unknown): boolean =>
    !!value && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string';
  return (
    typeof n['@context'] === 'string' &&
    typeof n.id === 'string' &&
    Array.isArray(n.type) &&
    n.type.length > 0 &&
    n.type.every((t) => typeof t === 'string') &&
    hasStringId(n.actor) &&
    hasStringId(n.object) &&
    hasStringId(n.target)
  );
}
