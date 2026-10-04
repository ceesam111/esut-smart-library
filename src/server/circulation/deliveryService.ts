import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { sendEmail } from '@/server/email/emailService';
import { renderNotice, type NoticeType, type NoticeContext } from '@/server/circulation/notices';
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
  provider_message_id?: string;
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

export class NoticeDeliveryService {
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

    const { data: logEntry, error: insertErr } = await supabase
      .from('notice_delivery_log')
      .insert({
        notice_type: input.noticeType,
        template_id: input.templateId,
        template_version: input.templateVersion ?? 1,
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

    try {
      if (input.channel === 'email') {
        if (!input.email) throw new Error('Email required for email channel');
        const template = input.templateId
          ? (await import('@/server/circulation/notices')).getTemplate(input.noticeType)
          : (await import('@/server/circulation/notices')).getTemplate(input.noticeType);
        const rendered = renderNotice(template, input.context);
        const result = await sendEmail({
          to: input.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          toName: input.context.patron_name,
        });
        await supabase
          .from('notice_delivery_log')
          .update({ status: 'SENT', provider: result.provider, provider_message_id: result.messageId, sent_at: new Date().toISOString() })
          .eq('id', logEntry.id);
        return { ...logEntry, status: 'SENT' as DeliveryStatus, provider_message_id: result.messageId ?? undefined };
      }

      if (input.channel === 'in-app') {
        if (!input.userId) throw new Error('userId required for in-app channel');
        const template = (await import('@/server/circulation/notices')).getTemplate(input.noticeType);
        const rendered = renderNotice(template, input.context);
        await createInAppNotice({
          user_id: input.userId,
          notice_type: input.noticeType,
          title: rendered.subject,
          message: rendered.text,
        });
        await supabase
          .from('notice_delivery_log')
          .update({ status: 'SENT', sent_at: new Date().toISOString() })
          .eq('id', logEntry.id);
        return { ...logEntry, status: 'SENT' as DeliveryStatus };
      }

      if (input.channel === 'print') {
        await supabase
          .from('notice_delivery_log')
          .update({ status: 'SENT', sent_at: new Date().toISOString() })
          .eq('id', logEntry.id);
        return { ...logEntry, status: 'SENT' as DeliveryStatus };
      }

      if (input.channel === 'sms') {
        const sms = getSmsProvider();
        const status = sms.status();
        if (!status.configured) {
          await supabase
            .from('notice_delivery_log')
            .update({ status: 'SUPPRESSED', suppression_reason: 'SMS provider not configured', failed_at: new Date().toISOString() })
            .eq('id', logEntry.id);
          return { ...logEntry, status: 'SUPPRESSED' as DeliveryStatus };
        }
        const template = (await import('@/server/circulation/notices')).getTemplate(input.noticeType);
        const rendered = renderNotice(template, input.context);
        const result = await sms.send(input.email ?? '', rendered.text);
        if (result.success) {
          await supabase
            .from('notice_delivery_log')
            .update({ status: 'SENT', provider: 'sms', provider_message_id: result.messageId ?? null, sent_at: new Date().toISOString() })
            .eq('id', logEntry.id);
          return { ...logEntry, status: 'SENT' as DeliveryStatus };
        }
        throw new Error('SMS send failed');
      }

      throw new Error(`Unknown channel: ${input.channel}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const category = message.includes('not configured') ? 'configuration' : 'send_failed';
      await supabase
        .from('notice_delivery_log')
        .update({ status: 'FAILED', error_category: category, error_detail: message, failed_at: new Date().toISOString() })
        .eq('id', logEntry.id);
      return { ...logEntry, status: 'FAILED' as DeliveryStatus, error_category: category, error_detail: message };
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

  async retry(id: string): Promise<DeliveryRecord> {
    const supabase = getSupabaseAdminClient();
    const { data: logEntry } = await supabase.from('notice_delivery_log').select('*').eq('id', id).single();
    if (!logEntry) throw new Error('Delivery log entry not found');
    if (logEntry.retry_count >= logEntry.max_retries) {
      await supabase.from('notice_delivery_log').update({ status: 'FAILED', error_detail: 'Max retries exceeded' }).eq('id', id);
      return { ...logEntry, status: 'FAILED' as DeliveryStatus, error_detail: 'Max retries exceeded' };
    }
    const context = (logEntry.context_json ?? {}) as unknown as NoticeContext;
    return this.send({
      noticeType: logEntry.notice_type as NoticeType,
      templateId: logEntry.template_id ?? undefined,
      templateVersion: logEntry.template_version ?? undefined,
      userId: logEntry.recipient_user_id ?? undefined,
      email: logEntry.recipient_email ?? undefined,
      channel: logEntry.channel as Channel,
      context,
      entityType: logEntry.entity_type ?? undefined,
      entityId: logEntry.entity_id ?? undefined,
      idempotencyKey: logEntry.idempotency_key,
    });
  }
}

export const noticeDeliveryService = new NoticeDeliveryService();
