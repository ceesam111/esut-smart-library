import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { resolveTenant } from '@/server/tenant/resolveTenant';

export interface AuditLogInput {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(input: AuditLogInput) {
  const supabase = getSupabaseAdminClient();
  const tenant = input.tenantId ? { tenantId: input.tenantId } : await resolveTenant(input.actorUserId);

  const payload = {
    tenant_id: tenant.tenantId,
    user_id: input.actorUserId ?? null,
    actor_user_id: input.actorUserId ?? null,
    actor_role: input.actorRole ?? null,
    action: input.action,
    table_name: input.entityType,
    entity_type: input.entityType,
    record_id: input.entityId ?? null,
    entity_id: input.entityId ?? null,
    old_values: input.beforeData ?? null,
    new_values: input.afterData ?? null,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  };

  const { data, error } = await supabase.from('audit_logs').insert(payload).select('id').single();

  if (!error) return data;

  const message = error.message || '';
  const retryPayload = /column .* does not exist|schema cache|PGRST204/i.test(message)
    ? {
        user_id: input.actorUserId ?? null,
        action: input.action,
        table_name: input.entityType,
        record_id: input.entityId ?? null,
        old_values: input.beforeData ?? null,
        new_values: input.afterData ?? null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      }
    : null;

  if (retryPayload) {
    const retry = await supabase.from('audit_logs').insert(retryPayload).select('id').single();
    if (!retry.error) return retry.data;
    console.warn('Audit log write failed:', retry.error.message);
    return null;
  }

  console.warn('Audit log write failed:', message);
  return null;
}
