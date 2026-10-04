import { captureEvent } from './eventCapture';

export interface RepositoryEventContext {
  userId?: string;
  sessionId?: string;
  ipHash?: string;
  userAgent?: string;
  referrer?: string;
  faculty?: string;
  department?: string;
  patronRole?: string;
}

export async function trackRepositoryItemView(itemId: string, context: RepositoryEventContext): Promise<void> {
  await captureEvent({
    event_type: 'repository_item_view',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'repository_item',
    entity_id: itemId,
    event_category: 'REPOSITORY',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackRepositorySearch(query: string, resultCount: number, context: RepositoryEventContext): Promise<void> {
  await captureEvent({
    event_type: 'repository_search',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    search_query: query,
    result_count: resultCount,
    event_category: 'REPOSITORY',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackRepositoryFileDownload(
  itemId: string,
  fileId: string | null,
  versionId: string | null,
  context: RepositoryEventContext,
): Promise<void> {
  await captureEvent({
    event_type: 'repository_file_download',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'repository_item',
    entity_id: itemId,
    metadata: { file_id: fileId, version_id: versionId },
    event_category: 'REPOSITORY',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}

export async function trackRepositorySubmission(itemId: string, context: RepositoryEventContext): Promise<void> {
  await captureEvent({
    event_type: 'repository_submission',
    user_id: context.userId,
    session_id: context.sessionId,
    ip_hash: context.ipHash,
    user_agent: context.userAgent,
    referrer: context.referrer,
    entity_type: 'repository_item',
    entity_id: itemId,
    event_category: 'REPOSITORY',
    faculty: context.faculty,
    department: context.department,
    patron_role: context.patronRole,
  });
}
