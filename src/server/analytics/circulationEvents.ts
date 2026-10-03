import { captureEvent } from './eventCapture';

export interface CirculationEventContext {
  userId?: string;
  sessionId?: string;
  ipHash?: string;
  userAgent?: string;
  referrer?: string;
  faculty?: string;
  department?: string;
  patronRole?: string;
}

export async function trackCheckout(loanId: string, itemId: string, context: CirculationEventContext): Promise<void> {
  await captureEvent({
    event_type: 'checkout',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'loan',
    entity_id: loanId,
    metadata: { item_id: itemId },
    event_category: 'CIRCULATION',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackCheckin(loanId: string, itemId: string, context: CirculationEventContext): Promise<void> {
  await captureEvent({
    event_type: 'checkin',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'loan',
    entity_id: loanId,
    metadata: { item_id: itemId },
    event_category: 'CIRCULATION',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackRenewal(loanId: string, itemId: string, context: CirculationEventContext): Promise<void> {
  await captureEvent({
    event_type: 'renewal',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'loan',
    entity_id: loanId,
    metadata: { item_id: itemId },
    event_category: 'CIRCULATION',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackHoldPlaced(holdId: string, itemId: string, context: CirculationEventContext): Promise<void> {
  await captureEvent({
    event_type: 'hold_placed',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'hold',
    entity_id: holdId,
    metadata: { item_id: itemId },
    event_category: 'CIRCULATION',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackHoldFulfilled(holdId: string, itemId: string, context: CirculationEventContext): Promise<void> {
  await captureEvent({
    event_type: 'hold_fulfilled',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'hold',
    entity_id: holdId,
    metadata: { item_id: itemId },
    event_category: 'CIRCULATION',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackHoldCancelled(holdId: string, itemId: string, context: CirculationEventContext): Promise<void> {
  await captureEvent({
    event_type: 'hold_cancelled',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'hold',
    entity_id: holdId,
    metadata: { item_id: itemId },
    event_category: 'CIRCULATION',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}
