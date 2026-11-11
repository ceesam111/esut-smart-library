import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { logger } from '@/server/logging/logger';

export type EmailProviderConfigKind = 'resend' | 'emailbump' | 'smtp';

export interface EmailProviderSecrets {
  api_key?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_secure?: boolean;
}

export interface EmailProviderConfigRecord {
  id: string;
  provider: EmailProviderConfigKind;
  label: string;
  from_email: string;
  from_name: string | null;
  is_enabled: boolean;
  priority: number;
  config: EmailProviderSecrets;
  created_at: string;
  updated_at: string;
}

const CACHE_TTL_MS = 30_000;
const PROVIDER_KINDS: EmailProviderConfigKind[] = ['resend', 'emailbump', 'smtp'];

let cache: { at: number; rows: EmailProviderConfigRecord[] } | null = null;

export function invalidateEmailProviderConfigCache(): void {
  cache = null;
}

function normalizeRow(raw: Record<string, unknown>): EmailProviderConfigRecord | null {
  const provider = raw.provider;
  if (typeof provider !== 'string' || !PROVIDER_KINDS.includes(provider as EmailProviderConfigKind)) return null;
  const config = typeof raw.config === 'object' && raw.config !== null ? raw.config : {};
  return {
    id: String(raw.id ?? ''),
    provider: provider as EmailProviderConfigKind,
    label: String(raw.label ?? provider),
    from_email: String(raw.from_email ?? ''),
    from_name: typeof raw.from_name === 'string' ? raw.from_name : null,
    is_enabled: raw.is_enabled === true,
    priority: Number(raw.priority) || 100,
    config: config as EmailProviderSecrets,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
}

export async function getEmailProviderConfigs(options?: { fresh?: boolean }): Promise<EmailProviderConfigRecord[]> {
  if (!options?.fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('email_provider_configs')
      .select('id,provider,label,from_email,from_name,is_enabled,priority,config,created_at,updated_at')
      .order('priority', { ascending: true });
    if (error) throw new Error(error.message);
    const rows: EmailProviderConfigRecord[] = [];
    for (const raw of Array.isArray(data) ? (data as Record<string, unknown>[]) : []) {
      const row = normalizeRow(raw);
      if (row) rows.push(row);
    }
    cache = { at: Date.now(), rows };
    return rows;
  } catch (error) {
    logger.warn('[email] Provider configuration unavailable; using environment fallback', {
      detail: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
