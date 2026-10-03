import { captureEvent } from './eventCapture';

export interface CatalogueEventContext {
  userId?: string;
  sessionId?: string;
  ipHash?: string;
  userAgent?: string;
  referrer?: string;
  faculty?: string;
  department?: string;
  patronRole?: string;
}

export async function trackCatalogueView(itemId: string, context: CatalogueEventContext): Promise<void> {
  await captureEvent({
    event_type: 'catalogue_view',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'catalogue_item',
    entity_id: itemId,
    event_category: 'CATALOGUE',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackCatalogueSearch(query: string, resultCount: number, context: CatalogueEventContext): Promise<void> {
  await captureEvent({
    event_type: 'catalogue_search',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    search_query: query,
    result_count: resultCount,
    event_category: 'CATALOGUE',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackCatalogueResultClick(itemId: string, query: string, context: CatalogueEventContext): Promise<void> {
  await captureEvent({
    event_type: 'catalogue_result_click',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'catalogue_item',
    entity_id: itemId,
    search_query: query,
    event_category: 'CATALOGUE',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackCatalogueExport(itemId: string, context: CatalogueEventContext): Promise<void> {
  await captureEvent({
    event_type: 'catalogue_export',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'catalogue_item',
    entity_id: itemId,
    event_category: 'CATALOGUE',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}
