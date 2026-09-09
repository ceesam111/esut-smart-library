import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export interface TenantContext {
  tenantId: string;
  source: 'patron' | 'role' | 'default';
}

export async function resolveTenant(userId?: string | null): Promise<TenantContext> {
  if (!userId) return { tenantId: DEFAULT_TENANT_ID, source: 'default' };

  const supabase = getSupabaseAdminClient();
  const { data: patron, error: patronError } = await supabase
    .from('patrons')
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (patronError) {
    if (isMissingSchemaError(patronError)) return { tenantId: DEFAULT_TENANT_ID, source: 'default' };
    throw new Error(patronError.message);
  }
  if (patron?.tenant_id) return { tenantId: patron.tenant_id, source: 'patron' };

  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('tenant_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (roleError) {
    if (isMissingSchemaError(roleError)) return { tenantId: DEFAULT_TENANT_ID, source: 'default' };
    throw new Error(roleError.message);
  }
  if (role?.tenant_id) return { tenantId: role.tenant_id, source: 'role' };

  return { tenantId: DEFAULT_TENANT_ID, source: 'default' };
}
