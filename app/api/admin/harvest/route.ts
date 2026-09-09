import { z } from 'zod';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { runExternalResourceDiscovery } from '@/server/resources/discovery';
import { RESOURCE_SOURCES } from '@/server/resources/sourceRegistry';
import { getTenantSourceControls, updateTenantSourceControl } from '@/server/resources/sourceControls';
import { withHandler } from '@/server/api/withHandler';
import { ApiError } from '@/server/api/errors';

const harvestRunSchema = z.object({ query: z.string().min(1), limitPerSource: z.number().int().min(1).max(20).optional(), sourceTypes: z.array(z.string()).optional() });
const sourceControlSchema = z.object({
  sourceType: z.string().min(1),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  limitPerRun: z.number().int().min(0).max(50).optional(),
  downloadPolicy: z.enum(['metadata_only', 'link_only', 'download_legal_files']).optional(),
  requiresHumanApproval: z.boolean().optional(),
});

export const GET = withHandler({
  handler: async ({ request }) => {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const sourceControls = await getTenantSourceControls(tenant.tenantId);
    const [{ data: sources }, { data: runs }, { data: candidates }, { data: logs }] = await Promise.all([
      supabase.from('resource_harvest_sources').select('*').eq('tenant_id', tenant.tenantId).order('created_at', { ascending: false }),
      supabase.from('resource_harvest_runs').select('*').eq('tenant_id', tenant.tenantId).order('started_at', { ascending: false }).limit(25),
      supabase.from('resource_candidates').select('*').eq('tenant_id', tenant.tenantId).order('created_at', { ascending: false }).limit(100),
      supabase.from('resource_discovery_logs').select('*').eq('tenant_id', tenant.tenantId).order('created_at', { ascending: false }).limit(50),
    ]);
    return { data: { sourceRegistry: RESOURCE_SOURCES, sourceControls: sourceControls.controls, sources: sources ?? [], runs: runs ?? [], candidates: candidates ?? [], logs: logs ?? [] } };
  },
});

export const PATCH = withHandler({
  bodySchema: sourceControlSchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof sourceControlSchema>;
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const source = await updateTenantSourceControl(tenant.tenantId, parsed);
    return { data: { source } };
  },
});

export const POST = withHandler({
  bodySchema: harvestRunSchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof harvestRunSchema>;
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const query = parsed.query.trim();
    if (!query) throw new ApiError('BAD_REQUEST', 'query is required.', 400);
    const discovery = await runExternalResourceDiscovery({ tenantId: tenant.tenantId, userId: ctx.user.id, query, triggerType: 'manual_admin', limitPerSource: parsed.limitPerSource ?? 8, sourceTypes: parsed.sourceTypes });
    return { data: discovery };
  },
});
