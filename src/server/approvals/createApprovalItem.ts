import { z } from 'zod';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { writeAuditLog } from '@/server/audit/writeAuditLog';

export const approvalRiskTierSchema = z.enum(['auto', 'human', 'blocked']);

export const createApprovalItemSchema = z.object({
  tenantId: z.string().uuid().optional(),
  sourceTable: z.string().min(1).optional(),
  sourceId: z.string().uuid().optional(),
  contentType: z.string().min(1),
  actionType: z.string().min(1),
  riskTier: approvalRiskTierSchema,
  title: z.string().optional(),
  summary: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
  assignedTo: z.string().uuid().nullable().optional(),
  submittedBy: z.string().uuid().nullable().optional(),
});

export type CreateApprovalItemInput = z.input<typeof createApprovalItemSchema>;

export async function createApprovalItem(input: CreateApprovalItemInput) {
  const parsed = createApprovalItemSchema.parse(input);
  const tenant = parsed.tenantId ? { tenantId: parsed.tenantId } : await resolveTenant(parsed.submittedBy);
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('approval_queue')
    .insert({
      tenant_id: tenant.tenantId,
      source_table: parsed.sourceTable ?? null,
      source_id: parsed.sourceId ?? null,
      content_type: parsed.contentType,
      action_type: parsed.actionType,
      risk_tier: parsed.riskTier,
      title: parsed.title ?? null,
      summary: parsed.summary ?? null,
      payload: parsed.payload,
      assigned_to: parsed.assignedTo ?? null,
      submitted_by: parsed.submittedBy ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: tenant.tenantId,
    actorUserId: parsed.submittedBy ?? null,
    action: 'approval_item_created',
    entityType: 'approval_queue',
    entityId: data.id,
    afterData: data,
    metadata: { contentType: parsed.contentType, actionType: parsed.actionType },
  });

  return data;
}
