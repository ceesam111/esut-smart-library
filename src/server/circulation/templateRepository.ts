import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import {
  DEFAULT_TEMPLATES,
  type NoticeTemplate,
  type NoticeType,
} from './notices';

export type TemplateSource = 'database' | 'builtin-fallback';

export interface ResolvedTemplate extends NoticeTemplate {
  source: TemplateSource;
}

function isMissingTable(error: { message?: string } | null | undefined): boolean {
  const message = error?.message ?? '';
  return /Could not find the table|schema cache|does not exist|PGRST20|42P01|relation .* does not exist/i.test(message);
}

export function rowToTemplate(row: Record<string, unknown>): NoticeTemplate {
  return {
    id: String(row.id),
    notice_type: row.notice_type as NoticeType,
    name: String(row.name),
    subject: String(row.subject),
    body_text: String(row.body_text),
    body_html: row.body_html ? String(row.body_html) : undefined,
    channel: row.channel as NoticeTemplate['channel'],
    locale: String(row.locale ?? 'en'),
    enabled: row.enabled !== false,
    variables: (row.variables ?? {}) as NoticeTemplate['variables'],
    tenant_id: row.tenant_id ? String(row.tenant_id) : undefined,
    library_id: row.library_id ? String(row.library_id) : undefined,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    created_by: row.created_by ? String(row.created_by) : undefined,
    version: Number(row.version ?? 1),
  };
}

export function builtinTemplate(noticeType: NoticeType): NoticeTemplate {
  const def = DEFAULT_TEMPLATES[noticeType];
  if (!def) throw new Error(`No template found for notice type: ${noticeType}`);
  const now = new Date().toISOString();
  return { ...def, created_at: now, updated_at: now, version: 1 };
}

let bootstrapState: 'unknown' | 'done' | 'unavailable' = 'unknown';

/** Seed built-in defaults into notice_templates (only rows that do not exist). */
async function ensureBootstrapped(): Promise<boolean> {
  if (bootstrapState === 'done') return true;
  if (bootstrapState === 'unavailable') return false;
  const supabase = getSupabaseAdminClient();
  try {
    const now = new Date().toISOString();
    const rows = Object.values(DEFAULT_TEMPLATES).map((t) => ({
      ...t,
      created_at: now,
      updated_at: now,
      version: 1,
    }));
    const { error } = await supabase
      .from('notice_templates')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) {
      if (isMissingTable(error)) {
        bootstrapState = 'unavailable';
        return false;
      }
      throw new Error(error.message);
    }
    bootstrapState = 'done';
    return true;
  } catch (error) {
    if (error instanceof Error && isMissingTable({ message: error.message })) {
      bootstrapState = 'unavailable';
      return false;
    }
    return false;
  }
}

/**
 * Resolve the authoritative template for a notice type (or explicit template id).
 * Database rows win; built-in defaults are used only when the table is
 * unavailable or the type was never bootstrapped.
 */
export async function resolveTemplate(
  noticeType: NoticeType,
  templateId?: string,
): Promise<ResolvedTemplate> {
  try {
    const supabase = getSupabaseAdminClient();

    if (templateId) {
      const { data, error } = await supabase
        .from('notice_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle();
      if (error && !isMissingTable(error)) throw new Error(error.message);
      if (data) return { ...rowToTemplate(data), source: 'database' };
    }

    const ready = await ensureBootstrapped();
    if (!ready) return { ...builtinTemplate(noticeType), source: 'builtin-fallback' };

    const { data, error } = await supabase
      .from('notice_templates')
      .select('*')
      .eq('notice_type', noticeType)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return { ...rowToTemplate(data), source: 'database' };
    return { ...builtinTemplate(noticeType), source: 'builtin-fallback' };
  } catch {
    return { ...builtinTemplate(noticeType), source: 'builtin-fallback' };
  }
}

/** List templates from the database with built-in fallback when unavailable. */
export async function listTemplatesDb(
  channel?: NoticeTemplate['channel'],
  enabledOnly = true,
): Promise<NoticeTemplate[]> {
  try {
    const ready = await ensureBootstrapped();
    if (!ready) return builtinList(channel, enabledOnly);

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('notice_templates')
      .select('*')
      .order('notice_type', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    const all = (data ?? []).map(rowToTemplate);
    return all.filter((t) => {
      if (enabledOnly && !t.enabled) return false;
      if (channel && t.channel !== channel) return false;
      return true;
    });
  } catch {
    return builtinList(channel, enabledOnly);
  }
}

function builtinList(channel?: NoticeTemplate['channel'], enabledOnly = true): NoticeTemplate[] {
  const all = Object.values(DEFAULT_TEMPLATES).map((t) => builtinTemplate(t.notice_type));
  return all.filter((t) => {
    if (enabledOnly && !t.enabled) return false;
    if (channel && t.channel !== channel) return false;
    return true;
  });
}

export interface TemplateUpdate {
  name?: string;
  subject?: string;
  body_text?: string;
  body_html?: string | null;
  channel?: NoticeTemplate['channel'];
  enabled?: boolean;
}

/**
 * Update a template with optimistic concurrency: version increments by exactly
 * one per successful edit, and concurrent edits are rejected for retry.
 */
export async function updateTemplate(
  templateId: string,
  changes: TemplateUpdate,
): Promise<NoticeTemplate> {
  const supabase = getSupabaseAdminClient();
  const { data: current, error: readErr } = await supabase
    .from('notice_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!current) throw new Error('Template not found');

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (changes.name !== undefined) patch.name = changes.name;
  if (changes.subject !== undefined) patch.subject = changes.subject;
  if (changes.body_text !== undefined) patch.body_text = changes.body_text;
  if (changes.body_html !== undefined) patch.body_html = changes.body_html;
  if (changes.channel !== undefined) patch.channel = changes.channel;
  if (changes.enabled !== undefined) patch.enabled = changes.enabled;
  patch.version = (Number(current.version) || 1) + 1;

  const { data: updated, error } = await supabase
    .from('notice_templates')
    .update(patch)
    .eq('id', templateId)
    .eq('version', Number(current.version) || 1)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error('Template was modified concurrently. Reload and retry.');
  return rowToTemplate(updated);
}

/** Create a new custom template row. */
export async function createTemplate(input: {
  notice_type: NoticeType;
  name: string;
  subject: string;
  body_text: string;
  body_html?: string;
  channel?: NoticeTemplate['channel'];
  createdBy?: string;
}): Promise<NoticeTemplate> {
  if (!DEFAULT_TEMPLATES[input.notice_type]) {
    throw new Error(`Unknown notice type: ${input.notice_type}`);
  }
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const id = `tpl-${input.notice_type}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('notice_templates')
    .insert({
      id,
      notice_type: input.notice_type,
      name: input.name,
      subject: input.subject,
      body_text: input.body_text,
      body_html: input.body_html ?? null,
      channel: input.channel ?? 'email',
      locale: 'en',
      enabled: true,
      variables: DEFAULT_TEMPLATES[input.notice_type].variables,
      version: 1,
      created_at: now,
      updated_at: now,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create template: ${error.message}`);
  return rowToTemplate(data);
}
