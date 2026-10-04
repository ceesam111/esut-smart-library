import { captureEvent } from './eventCapture';

export interface FederatedEventContext {
  userId?: string;
  sessionId?: string;
  ipHash?: string;
  userAgent?: string;
  referrer?: string;
  faculty?: string;
  department?: string;
  patronRole?: string;
}

export async function trackFederatedSearch(
  query: string,
  resultCount: number,
  providerMix: string[],
  providerFailures: string[],
  context: FederatedEventContext,
): Promise<void> {
  await captureEvent({
    event_type: 'federated_search',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    search_query: query,
    result_count: resultCount,
    provider: providerMix.join(','),
    metadata: { provider_mix: providerMix, provider_failures: providerFailures },
    event_category: 'DISCOVERY',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackFederatedResultClick(
  query: string,
  provider: string,
  entityId: string,
  context: FederatedEventContext,
): Promise<void> {
  await captureEvent({
    event_type: 'federated_result_click',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    search_query: query,
    provider,
    entity_type: 'federated_result',
    entity_id: entityId,
    event_category: 'DISCOVERY',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackProviderResultClick(
  query: string,
  provider: string,
  entityId: string,
  context: FederatedEventContext,
): Promise<void> {
  await captureEvent({
    event_type: 'provider_result_click',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    search_query: query,
    provider,
    entity_type: 'provider_result',
    entity_id: entityId,
    event_category: 'DISCOVERY',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}
