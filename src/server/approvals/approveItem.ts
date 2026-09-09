import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';

export async function approveItem(input: { id: string; actorUserId: string; actorRole?: string | null; decisionNote?: string | null }) {
  const supabase = getSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from('approval_queue').select('*').eq('id', input.id).single();
  if (beforeError) throw new Error(beforeError.message);

  const { data, error } = await supabase
    .from('approval_queue')
    .update({
      status: 'approved',
      approved_by: input.actorUserId,
      rejected_by: null,
      decision_note: input.decisionNote ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: data.tenant_id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole ?? null,
    action: 'approval_item_approved',
    entityType: 'approval_queue',
    entityId: input.id,
    beforeData: before,
    afterData: data,
  });

  return data;
}
