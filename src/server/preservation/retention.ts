import { getSupabaseAdminClient } from '../supabase/adminClient';

export interface RetentionPolicyRow {
  id: string;
  name: string;
  entity_type: string;
  older_than_years: number;
  statuses: string[];
  enabled: boolean;
}

export interface RetentionReviewSummary {
  ok: boolean;
  policiesReviewed: number;
  candidates: number;
  flagged: number;
  eventsWritten: number;
  error?: string;
}

export const RETENTION_FLAG_CAP_PER_POLICY = 200;
export const RETENTION_CANDIDATE_LIMIT = 500;

export function isRetentionDue(input: {
  createdAt: string;
  status: string;
  policy: Pick<RetentionPolicyRow, 'older_than_years' | 'statuses'>;
  now: Date;
}): boolean {
  if (!input.policy.statuses.includes(input.status)) return false;
  const created = new Date(input.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const cutoffYear = input.now.getUTCFullYear() - input.policy.older_than_years;
  return created.getUTCFullYear() <= cutoffYear;
}

export async function reviewRetention(options: { payload?: Record<string, unknown> } = {}): Promise<RetentionReviewSummary> {
  void options;
  const supabase = getSupabaseAdminClient();
  const now = new Date();

  const { data: policies, error: policyError } = await supabase
    .from('retention_policies')
    .select('id, name, entity_type, older_than_years, statuses, enabled')
    .eq('enabled', true);
  if (policyError) return { ok: false, policiesReviewed: 0, candidates: 0, flagged: 0, eventsWritten: 0, error: policyError.message };

  const rows = (policies ?? []) as RetentionPolicyRow[];
  let candidates = 0;
  let flagged = 0;
  let eventsWritten = 0;

  for (const policy of rows) {
    if (policy.entity_type !== 'repository_item') continue;
    const { data: items, error: itemError } = await supabase
      .from('repository_items')
      .select('id, status, created_at, retention_reviewed_at')
      .is('retention_reviewed_at', null)
      .not('created_at', 'is', null)
      .limit(RETENTION_CANDIDATE_LIMIT);
    if (itemError) return { ok: false, policiesReviewed: rows.length, candidates, flagged, eventsWritten, error: itemError.message };

    const due = ((items ?? []) as Array<{ id: string; status: string; created_at: string }>).filter((item) =>
      isRetentionDue({ createdAt: item.created_at, status: item.status, policy, now }),
    );
    candidates += (items ?? []).length;
    const batch = due.slice(0, RETENTION_FLAG_CAP_PER_POLICY);
    if (batch.length === 0) continue;

    const stamp = now.toISOString();
    const { error: updateError } = await supabase
      .from('repository_items')
      .update({ retention_reviewed_at: stamp })
      .in('id', batch.map((item) => item.id));
    if (updateError) return { ok: false, policiesReviewed: rows.length, candidates, flagged, eventsWritten, error: updateError.message };

    const { error: eventError } = await supabase.from('preservation_events').insert(
      batch.map((item) => ({
        event_type: 'RETENTION_FLAGGED',
        repository_item_id: item.id,
        details: { policyId: policy.id, policyName: policy.name, status: item.status, createdAt: item.created_at },
      })),
    );
    if (eventError) return { ok: false, policiesReviewed: rows.length, candidates, flagged, eventsWritten, error: eventError.message };

    flagged += batch.length;
    eventsWritten += batch.length;
  }

  return { ok: true, policiesReviewed: rows.length, candidates, flagged, eventsWritten };
}
