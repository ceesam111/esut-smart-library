import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import {
  getEmailProviderConfigs,
  invalidateEmailProviderConfigCache,
  type EmailProviderSecrets,
} from '@/server/email/providerConfig';
import { logger } from '@/server/logging/logger';

export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
const PROVIDER_KINDS = ['resend', 'emailbump', 'smtp'] as const;
type ProviderKind = (typeof PROVIDER_KINDS)[number];

function isProviderKind(value: unknown): value is ProviderKind {
  return typeof value === 'string' && (PROVIDER_KINDS as readonly string[]).includes(value);
}

interface MaskedSecret {
  set: boolean;
  last4: string | null;
}

function maskSecret(value: unknown): MaskedSecret {
  if (typeof value !== 'string' || !value) return { set: false, last4: null };
  return { set: true, last4: value.slice(-4) };
}

function maskRow(row: {
  id: string;
  provider: string;
  label: string;
  from_email: string;
  from_name: string | null;
  is_enabled: boolean;
  priority: number;
  config: EmailProviderSecrets;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    fromEmail: row.from_email,
    fromName: row.from_name,
    isEnabled: row.is_enabled,
    priority: row.priority,
    apiKey: maskSecret(row.config.api_key),
    smtpHost: row.config.smtp_host ?? null,
    smtpPort: row.config.smtp_port ?? null,
    smtpUser: row.config.smtp_user ?? null,
    smtpSecure: row.config.smtp_secure ?? null,
    smtpPassword: maskSecret(row.config.smtp_password),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const rows = await getEmailProviderConfigs({ fresh: true });
    return NextResponse.json({
      providers: rows.map(maskRow),
      environment: {
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        gmailConfigured: Boolean(process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_APP_PASSWORD),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

    const provider = body.provider;
    if (!isProviderKind(provider)) {
      return NextResponse.json({ error: 'Unknown provider type.' }, { status: 400 });
    }
    const fromEmail = String(body.fromEmail ?? '').trim();
    if (!EMAIL_PATTERN.test(fromEmail)) {
      return NextResponse.json({ error: 'A valid from address is required.' }, { status: 400 });
    }
    const fromName = String(body.fromName ?? '').trim() || null;
    const label = String(body.label ?? '').trim() || `${provider}`;
    const isEnabled = body.isEnabled === true;
    const priorityRaw = Number(body.priority);
    const priority = Number.isFinite(priorityRaw) ? Math.min(Math.max(Math.trunc(priorityRaw), 1), 1000) : 100;

    const incoming = (typeof body.config === 'object' && body.config !== null ? body.config : {}) as Record<string, unknown>;
    const config: EmailProviderSecrets = {};

    const id = typeof body.id === 'string' && body.id ? body.id : null;
    if (id) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('email_provider_configs')
        .select('config')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const existing = (data as { config: EmailProviderSecrets } | null)?.config;
      if (existing) Object.assign(config, existing);
    }

    if (provider === 'resend' || provider === 'emailbump') {
      const apiKey = String(incoming.api_key ?? incoming.apiKey ?? '').trim();
      if (apiKey) config.api_key = apiKey;
      if (!config.api_key) {
        return NextResponse.json({ error: 'An API key is required for this provider.' }, { status: 400 });
      }
      delete config.smtp_host;
      delete config.smtp_port;
      delete config.smtp_user;
      delete config.smtp_password;
      delete config.smtp_secure;
    }

    if (provider === 'smtp') {
      const host = String(incoming.smtp_host ?? incoming.smtpHost ?? '').trim();
      const user = String(incoming.smtp_user ?? incoming.smtpUser ?? '').trim();
      const password = String(incoming.smtp_password ?? incoming.smtpPassword ?? '').trim();
      const portRaw = Number(incoming.smtp_port ?? incoming.smtpPort);
      const port = Number.isFinite(portRaw) && portRaw > 0 ? Math.trunc(portRaw) : 587;
      const secure = incoming.smtp_secure === true || incoming.smtpSecure === true || port === 465;
      if (!host || !user) {
        return NextResponse.json({ error: 'SMTP host and username are required.' }, { status: 400 });
      }
      if (password) config.smtp_password = password;
      if (!config.smtp_password) {
        return NextResponse.json({ error: 'An SMTP password is required.' }, { status: 400 });
      }
      config.smtp_host = host;
      config.smtp_port = port;
      config.smtp_user = user;
      config.smtp_secure = secure;
      delete config.api_key;
    }

    const supabase = getSupabaseAdminClient();
    const payload = { provider, label, from_email: fromEmail, from_name: fromName, is_enabled: isEnabled, priority, config };

    if (id) {
      const { data, error } = await supabase
        .from('email_provider_configs')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      invalidateEmailProviderConfigCache();
      logger.info('[email] Admin updated provider config', { provider, id });
      return NextResponse.json({ provider: maskRow(data as Parameters<typeof maskRow>[0]) });
    }

    const { data, error } = await supabase
      .from('email_provider_configs')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    invalidateEmailProviderConfigCache();
    logger.info('[email] Admin created provider config', { provider });
    return NextResponse.json({ provider: maskRow(data as Parameters<typeof maskRow>[0]) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'A provider id is required.' }, { status: 400 });

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('email_provider_configs').delete().eq('id', id);
    if (error) throw new Error(error.message);
    invalidateEmailProviderConfigCache();
    logger.info('[email] Admin deleted provider config', { id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 500 });
  }
}
