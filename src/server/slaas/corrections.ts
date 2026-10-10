import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { captureEvent } from '@/server/analytics/eventCapture';

export interface CorrectVisitInput {
  visitId: string;
  newStatus: 'checked_out' | 'auto_closed' | 'checked_in';
  newCheckedOutAt: string | null;
  reason: string;
  correctedBy: string;
  actorRole: string | null;
  tenantId: string;
}

export interface CorrectionResult {
  ok: boolean;
  error: string | null;
  visit: { id: string; status: string; checked_out_at: string | null; duration_minutes: number | null } | null;
}

export async function correctVisit(input: CorrectVisitInput): Promise<CorrectionResult> {
  const supabase = getSupabaseAdminClient();
  const { data: current, error: fetchError } = await supabase
    .from('access_visits')
    .select('id, status, checked_in_at, checked_out_at, duration_minutes, patron_id, branch_id, tenant_id')
    .eq('id', input.visitId)
    .maybeSingle();
  if (fetchError || !current) return { ok: false, error: 'VISIT_NOT_FOUND', visit: null };

  const newCheckedOutAt = input.newStatus === 'checked_in' ? null : input.newCheckedOutAt;
  let duration: number | null = null;
  if (newCheckedOutAt) {
    const inMs = new Date(current.checked_in_at).getTime();
    const outMs = new Date(newCheckedOutAt).getTime();
    if (outMs < inMs) return { ok: false, error: 'INVALID_TIMES', visit: null };
    duration = Math.max(0, Math.round((outMs - inMs) / 60000));
  }

  const { data: updated, error: updateError } = await supabase
    .from('access_visits')
    .update({
      status: input.newStatus,
      checked_out_at: newCheckedOutAt,
      duration_minutes: duration,
      correction_reason: input.reason,
      corrected_by: input.correctedBy,
      corrected_at: new Date().toISOString(),
      is_observed: false,
    })
    .eq('id', input.visitId)
    .select('id, status, checked_out_at, duration_minutes')
    .single();
  if (updateError) return { ok: false, error: updateError.message, visit: null };

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: input.correctedBy,
    actorRole: input.actorRole,
    action: 'access.correction',
    entityType: 'access_visits',
    entityId: input.visitId,
    beforeData: { status: current.status, checked_out_at: current.checked_out_at, duration_minutes: current.duration_minutes },
    afterData: { status: updated.status, checked_out_at: updated.checked_out_at, duration_minutes: updated.duration_minutes },
    metadata: { reason: input.reason, source: 'correction' },
  });

  await captureEvent({
    event_type: 'library_gate',
    user_id: current.patron_id,
    event_category: 'ACCESS',
    entity_type: 'access_visit',
    entity_id: input.visitId,
    metadata: { action: 'correction', branch_id: current.branch_id, reason: input.reason },
  });

  return { ok: true, error: null, visit: updated };
}
