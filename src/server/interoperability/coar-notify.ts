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
    const res = await fetch(inboxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(notification),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function validateCoarNotify(payload: unknown): payload is CoarNotifyNotification {
  if (!payload || typeof payload !== 'object') return false;
  const n = payload as Record<string, unknown>;
  return (
    typeof n['@context'] === 'string' &&
    typeof n.id === 'string' &&
    Array.isArray(n.type) &&
    typeof n.actor === 'object' &&
    typeof n.object === 'object' &&
    typeof n.target === 'object'
  );
}
