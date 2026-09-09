import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';
import { RESOURCE_SOURCES, type DownloadPolicy } from './sourceRegistry';

export interface ResourceSourceControl {
  id?: string;
  sourceType: string;
  name: string;
  category: string;
  requiresKey: boolean;
  keyEnv?: string;
  rightsBehavior: string;
  downloadsAllowed: boolean;
  enabled: boolean;
  priority: number;
  limitPerRun: number;
  downloadPolicy: DownloadPolicy;
  requiresHumanApproval: boolean;
  missingApiKey: boolean;
}

function envPresent(name?: string) {
  return !name || Boolean(process.env[name]);
}

function configFromRow(row: any, source: typeof RESOURCE_SOURCES[number]): ResourceSourceControl {
  const config = row?.query_config ?? {};
  return {
    id: row?.id,
    sourceType: source.sourceType,
    name: source.name,
    category: source.category,
    requiresKey: source.requiresKey,
    keyEnv: source.keyEnv,
    rightsBehavior: source.rightsBehavior,
    downloadsAllowed: source.downloadsAllowed,
    enabled: row?.enabled ?? source.defaultEnabled,
    priority: Number(config.priority ?? source.priority),
    limitPerRun: Number(config.limitPerRun ?? source.defaultLimit ?? 5),
    downloadPolicy: (config.downloadPolicy ?? source.downloadPolicy) as DownloadPolicy,
    requiresHumanApproval: Boolean(config.requiresHumanApproval ?? source.requiresHumanApproval),
    missingApiKey: source.requiresKey && !envPresent(source.keyEnv),
  };
}

export async function getTenantSourceControls(tenantId: string): Promise<{ controls: ResourceSourceControl[]; schemaAvailable: boolean }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('resource_harvest_sources').select('*').eq('tenant_id', tenantId);
  if (error) {
    if (isMissingSchemaError(error)) {
      return { controls: RESOURCE_SOURCES.map((source) => configFromRow(null, source)), schemaAvailable: false };
    }
    throw new Error(error.message);
  }

  const rowsByType = new Map((data ?? []).map((row: any) => [row.source_type, row]));
  const missing = RESOURCE_SOURCES.filter((source) => !rowsByType.has(source.sourceType));
  if (missing.length) {
    await supabase.from('resource_harvest_sources').upsert(missing.map((source) => ({
      tenant_id: tenantId,
      name: source.name,
      source_type: source.sourceType,
      enabled: source.defaultEnabled,
      query_config: {
        priority: source.priority,
        limitPerRun: source.defaultLimit,
        downloadPolicy: source.downloadPolicy,
        requiresHumanApproval: source.requiresHumanApproval,
      },
    })), { onConflict: 'tenant_id,name' });
    return getTenantSourceControls(tenantId);
  }

  return {
    controls: RESOURCE_SOURCES.map((source) => configFromRow(rowsByType.get(source.sourceType), source)).sort((a, b) => b.priority - a.priority),
    schemaAvailable: true,
  };
}

export async function updateTenantSourceControl(tenantId: string, input: { sourceType: string; enabled?: boolean; priority?: number; limitPerRun?: number; downloadPolicy?: DownloadPolicy; requiresHumanApproval?: boolean }) {
  const source = RESOURCE_SOURCES.find((item) => item.sourceType === input.sourceType);
  if (!source) throw new Error('Unknown resource source.');
  const current = await getTenantSourceControls(tenantId);
  const existing = current.controls.find((item) => item.sourceType === input.sourceType);
  const queryConfig = {
    priority: input.priority ?? existing?.priority ?? source.priority,
    limitPerRun: input.limitPerRun ?? existing?.limitPerRun ?? source.defaultLimit,
    downloadPolicy: input.downloadPolicy ?? existing?.downloadPolicy ?? source.downloadPolicy,
    requiresHumanApproval: input.requiresHumanApproval ?? existing?.requiresHumanApproval ?? source.requiresHumanApproval,
  };
  const { data, error } = await getSupabaseAdminClient().from('resource_harvest_sources').upsert({
    tenant_id: tenantId,
    name: source.name,
    source_type: source.sourceType,
    enabled: input.enabled ?? existing?.enabled ?? source.defaultEnabled,
    query_config: queryConfig,
  }, { onConflict: 'tenant_id,name' }).select('*').single();
  if (error) throw new Error(error.message);
  return configFromRow(data, source);
}
