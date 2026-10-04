import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { sendEmail } from '@/server/email/emailService';
import { EmailDeliveryError } from '@/server/email/types';
import { renderNotice, type NoticeType, type NoticeContext, type NoticeTemplate } from '@/server/circulation/notices';
import { resolveTemplate } from '@/server/circulation/templateRepository';
import { createInAppNotice } from './inAppNotice';
import { getSmsProvider } from '@/server/sms/adapter';

export type DeliveryStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED' | 'SUPPRESSED';
export type Channel = 'email' | 'in-app' | 'print' | 'sms';

export interface SendNoticeInput {
  noticeType: NoticeType;
  templateId?: string;
  templateVersion?: number;
  userId?: string;
  email?: string;
  channel: Channel;
  context: NoticeContext;
  entityType?: string;
  entityId?: string;
  idempotencyKey: string;
  isTest?: boolean;
}

export interface DeliveryRecord {
  id: string;
  notice_type: NoticeType;
  status: DeliveryStatus;
  idempotency_key: string;
  channel: Channel;
  error_category?: string;
  error_detail?: string;
  retry_count: number;
  max_retries?: number;
  provider_message_id?: string;
}

interface AttemptOutcome {
  status: DeliveryStatus;
  provider?: string;
  messageId?: string | null;
  errorCategory?: string;
  errorDetail?: string;
  suppressionReason?: string;
}

function buildIdempotencyKey(input: Omit<SendNoticeInput, 'idempotencyKey'>): string {
  if (input.noticeType === 'custom_notice') {
    return `custom:${input.userId ?? input.email ?? 'unknown'}:${Date.now()}`;
  }
  const parts = [
    input.noticeType,
    input.entityType ?? '',
    input.entityId ?? '',
    input.channel,
  ];
  return parts.join(':');
}

/**
 * Classifies provider failures:
 * - not_configured / configuration absence -> SUPPRESSED (BLOCKED_EXTERNAL)
 * - rejected (validation/recipient)        -> FAILED permanent (no endless retries)
 * - anything else                          -> FAILED transient (retryable)
 */
function classifyEmailFailure(err: unknown): AttemptOutcome {
  if (err instanceof EmailDeliveryError) {
    if (err.code === 'not_configured') {
      return {
        status: 'SUPPRESSED',
        errorCategory: 'BLOCKED_EXTERNAL',
        errorDetail: err.message,
        suppressionReason: 'Email provider not configured',
      };
    }
    if (err.category === 'rejected') {
      return { status: 'FAILED', errorCategory: 'permanent', errorDetail: err.message };
    }
    return { status: 'FAILED', errorCategory: 'transient', errorDetail: err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/not configured/i.test(message)) {
    return {
      status: 'SUPPRESSED',
      errorCategory: 'BLOCKED_EXTERNAL',
      errorDetail: message,
      suppressionReason: 'Email provider not configured',
    };
  }
  return { status: 'FAILED', errorCategory: 'transient', errorDetail: message };
}

export class NoticeDeliveryService {
  private async attempt(
    input: SendNoticeInput,
    rendered: { subject: string; text: string; html: string; printHtml: string },
  ): Promise<AttemptOutcome> {
    if (input.channel === 'email') {
      if (!input.email) {
        return { status: 'FAILED', errorCategory: 'permanent', errorDetail: 'Email address required for email channel' };
      }
      try {
        const result = await sendEmail({
          to: input.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          toName: input.context.patron_name,
        });
        return { status: 'SENT', provider: result.provider, messageId: result.messageId };
      } catch (err) {
        return classifyEmailFailure(err);
      }
    }

    if (input.channel === 'in-app') {
      if (!input.userId) {
        return { status: 'FAILED', errorCategory: 'permanent', errorDetail: 'userId required for in-app channel' };
      }
      await createInAppNotice({
        user_id: input.userId,
        notice_type: input.noticeType,
        title: rendered.subject,
        message: rendered.text,
        action_url: typeof input.context.action_url === 'string' ? input.context.action_url : undefined,
      });
      return { status: 'SENT', provider: 'in-app' };
    }

    if (input.channel === 'print') {
      return { status: 'SENT', provider: 'print' };
    }

    if (input.channel === 'sms') {
      const sms = getSmsProvider();
      const status = sms.status();
      if (!status.configured) {
        return {
          status: 'SUPPRESSED',
          errorCategory: 'BLOCKED_EXTERNAL',
          suppressionReason: 'SMS provider not configured',
          errorDetail: 'SMS provider not configured',
        };
      }
      const result = await sms.send(input.email ?? '', rendered.text);
      if (result.success) {
        return { status: 'SENT', provider: 'sms', messageId: result.messageId ?? null };
      }
      return { status: 'FAILED', errorCategory: 'transient', errorDetail: 'SMS send failed' };
    }

    return { status: 'FAILED', errorCategory: 'permanent', errorDetail: `Unknown channel: ${input.channel}` };
  }

  private async persistOutcome(logId: string, outcome: AttemptOutcome): Promise<void> {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: outcome.status,
      provider: outcome.provider ?? null,
      provider_message_id: outcome.messageId ?? null,
      error_category: outcome.errorCategory ?? null,
      error_detail: outcome.errorDetail ?? null,
      suppression_reason: outcome.suppressionReason ?? null,
      updated_at: now,
    };
    if (outcome.status === 'SENT') patch.sent_at = now;
    if (outcome.status === 'FAILED') patch.failed_at = now;
    if (outcome.status === 'SUPPRESSED') patch.failed_at = now;
    await supabase.from('notice_delivery_log').update(patch).eq('id', logId);
  }

  async send(input: SendNoticeInput): Promise<DeliveryRecord> {
    const supabase = getSupabaseAdminClient();
    const idem = input.idempotencyKey || buildIdempotencyKey(input);

    const { data: existing } = await supabase
      .from('notice_delivery_log')
      .select('*')
      .eq('idempotency_key', idem)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const resolved = await resolveTemplate(input.noticeType, input.templateId);

    const { data: logEntry, error: insertErr } = await supabase
      .from('notice_delivery_log')
      .insert({
        notice_type: input.noticeType,
        template_id: resolved.id,
        template_version: resolved.version,
        recipient_user_id: input.userId,
        recipient_email: input.email,
        channel: input.channel,
        entity_type: input.entityType,
        entity_id: input.entityId,
        idempotency_key: idem,
        status: 'QUEUED',
        context_json: input.context as unknown as Record<string, unknown>,
        queued_at: new Date().toISOString(),
        max_retries: 3,
      })
      .select()
      .single();

    if (insertErr || !logEntry) {
      throw new Error(`Failed to create delivery log: ${insertErr?.message ?? 'unknown'}`);
    }

    if (!resolved.enabled) {
      const outcome: AttemptOutcome = {
        status: 'SUPPRESSED',
        errorCategory: 'BLOCKED_EXTERNAL',
        suppressionReason: 'Template disabled',
        errorDetail: `Template ${resolved.id} is disabled`,
      };
      await this.persistOutcome(logEntry.id, outcome);
      return { ...logEntry, ...outcome, idempotency_key: idem } as DeliveryRecord;
    }

    try {
      const rendered = renderNotice(resolved as NoticeTemplate, input.context);
      const outcome = await this.attempt(input, rendered);
      await this.persistOutcome(logEntry.id, outcome);
      return {
        ...logEntry,
        status: outcome.status,
        error_category: outcome.errorCategory,
        error_detail: outcome.errorDetail,
        provider_message_id: outcome.messageId ?? undefined,
      } as DeliveryRecord;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const outcome: AttemptOutcome = { status: 'FAILED', errorCategory: 'transient', errorDetail: message };
      await this.persistOutcome(logEntry.id, outcome);
      return { ...logEntry, status: 'FAILED', error_category: 'transient', error_detail: message } as DeliveryRecord;
    }
  }

  async listHistory(filters: {
    userId?: string;
    noticeType?: NoticeType;
    channel?: Channel;
    status?: DeliveryStatus;
    limit?: number;
    offset?: number;
  }): Promise<DeliveryRecord[]> {
    const supabase = getSupabaseAdminClient();
    let query = supabase.from('notice_delivery_log').select('*');
    if (filters.userId) query = query.eq('recipient_user_id', filters.userId);
    if (filters.noticeType) query = query.eq('notice_type', filters.noticeType);
    if (filters.channel) query = query.eq('channel', filters.channel);
    if (filters.status) query = query.eq('status', filters.status);
    query = query.order('created_at', { ascending: false });
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list history: ${error.message}`);
    return (data ?? []) as DeliveryRecord[];
  }

  /**
   * Retry a failed/suppressed delivery. Increments retry_count, refuses
   * permanent failures and exhausted budgets (no endless retries), and
   * re-attempts the channel with the authoritative template.
   */
  async retry(id: string): Promise<DeliveryRecord> {
    const supabase = getSupabaseAdminClient();
    const { data: logEntry } = await supabase.from('notice_delivery_log').select('*').eq('id', id).maybeSingle();
    if (!logEntry) throw new Error('Delivery log entry not found');

    if (logEntry.status === 'SENT' || logEntry.status === 'DELIVERED') {
      return logEntry as DeliveryRecord;
    }

    if (logEntry.error_category === 'permanent') {
      return logEntry as DeliveryRecord;
    }

    const maxRetries = Number(logEntry.max_retries ?? 3);
    if (Number(logEntry.retry_count ?? 0) >= maxRetries) {
      await supabase
        .from('notice_delivery_log')
        .update({ status: 'FAILED', error_detail: 'Max retries exceeded', failed_at: new Date().toISOString() })
        .eq('id', id);
      return { ...logEntry, status: 'FAILED', error_detail: 'Max retries exceeded' } as DeliveryRecord;
    }

    const nextRetry = Number(logEntry.retry_count ?? 0) + 1;
    await supabase
      .from('notice_delivery_log')
      .update({ status: 'QUEUED', retry_count: nextRetry, updated_at: new Date().toISOString() })
      .eq('id', id);

    const context = (logEntry.context_json ?? {}) as unknown as NoticeContext;
    const resolved = await resolveTemplate(logEntry.notice_type as NoticeType, logEntry.template_id ?? undefined);

    const input: SendNoticeInput = {
      noticeType: logEntry.notice_type as NoticeType,
      templateId: resolved.id,
      userId: logEntry.recipient_user_id ?? undefined,
      email: logEntry.recipient_email ?? undefined,
      channel: logEntry.channel as Channel,
      context,
      entityType: logEntry.entity_type ?? undefined,
      entityId: logEntry.entity_id ?? undefined,
      idempotencyKey: logEntry.idempotency_key,
    };

    let outcome: AttemptOutcome;
    try {
      if (!resolved.enabled) {
        outcome = {
          status: 'SUPPRESSED',
          errorCategory: 'BLOCKED_EXTERNAL',
          suppressionReason: 'Template disabled',
          errorDetail: `Template ${resolved.id} is disabled`,
        };
      } else {
        const rendered = renderNotice(resolved, context);
        outcome = await this.attempt(input, rendered);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      outcome = { status: 'FAILED', errorCategory: 'transient', errorDetail: message };
    }

    await this.persistOutcome(id, outcome);
    return {
      ...logEntry,
      status: outcome.status,
      retry_count: nextRetry,
      error_category: outcome.errorCategory ?? null,
      error_detail: outcome.errorDetail ?? null,
    } as DeliveryRecord;
  }
}

export const noticeDeliveryService = new NoticeDeliveryService();
