import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult } from './utils';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { noticeDeliveryService, type Channel } from '@/server/circulation/deliveryService';
import { patronDisplayName } from '@/server/circulation/patronNotice';

interface OverdueLoanRow {
  id: string;
  patron_id: string;
  catalogue_item_id: string | null;
  due_date: string;
  status: string;
}

interface PatronRow {
  id: string;
  user_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  surname?: string | null;
  other_names?: string | null;
}

async function deliverToPatron(
  loan: OverdueLoanRow,
  patron: PatronRow,
  noticeType: 'overdue' | 'overdue_escalation' | 'due_soon',
  bucket: string,
  itemTitle: string,
): Promise<Record<string, string>> {
  const outcomes: Record<string, string> = {};
  const patronName = patronDisplayName(patron);
  const context = {
    patron_name: patronName,
    item_title: itemTitle,
    due_date: loan.due_date,
  };

  const channels: Channel[] = [];
  if (patron.email) channels.push('email');
  if (patron.user_id) channels.push('in-app');
  if (channels.length === 0) return { skipped: 'no_email_or_user' };

  for (const channel of channels) {
    try {
      const result = await noticeDeliveryService.send({
        noticeType,
        channel,
        email: patron.email ?? '',
        userId: patron.user_id ?? undefined,
        context,
        entityType: 'loan',
        entityId: loan.id,
        idempotencyKey: `${noticeType}:${loan.id}:${bucket}:${channel}`,
      });
      outcomes[channel] = result.status;
    } catch {
      outcomes[channel] = 'failed';
    }
  }
  return outcomes;
}

export const overdueNoticeWorker: AgentJobHandler = async (job, _ctx) => {
  requireTenant(job);
  const admin = getSupabaseAdminClient();

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const { data: overdueLoans, error } = await admin
    .from('loans')
    .select('id, patron_id, catalogue_item_id, due_date, status')
    .eq('status', 'active')
    .lte('due_date', today)
    .limit(500);

  if (error) throw new Error(`Failed to fetch overdue loans: ${error.message}`);

  const results: Array<Record<string, unknown>> = [];

  for (const loan of (overdueLoans ?? []) as OverdueLoanRow[]) {
    const dueDate = new Date(`${loan.due_date}T00:00:00Z`);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysOverdue < 1) continue;

    let bucket: 'd1' | 'd7' | 'd30';
    let noticeType: 'overdue' | 'overdue_escalation';
    if (daysOverdue >= 30) {
      bucket = 'd30';
      noticeType = 'overdue_escalation';
    } else if (daysOverdue >= 7) {
      bucket = 'd7';
      noticeType = 'overdue_escalation';
    } else {
      bucket = 'd1';
      noticeType = 'overdue';
    }

    const { data: patron } = await admin
      .from('patrons')
      .select('id, user_id, email, full_name, surname, other_names')
      .eq('id', loan.patron_id)
      .maybeSingle();
    if (!patron) {
      results.push({ loanId: loan.id, bucket, status: 'skipped_no_patron' });
      continue;
    }

    const { data: item } = loan.catalogue_item_id
      ? await admin.from('catalogue_items').select('title').eq('id', loan.catalogue_item_id).maybeSingle()
      : { data: null };

    const outcomes = await deliverToPatron(
      loan,
      patron as PatronRow,
      noticeType,
      bucket,
      item?.title ?? 'Library item',
    );
    results.push({ loanId: loan.id, bucket, daysOverdue, ...outcomes });
  }

  return safeResult(`Processed ${results.length} overdue loans`, { results });
};

export const dueSoonNoticeWorker: AgentJobHandler = async (job, _ctx) => {
  requireTenant(job);
  const admin = getSupabaseAdminClient();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: dueSoonLoans, error } = await admin
    .from('loans')
    .select('id, patron_id, catalogue_item_id, due_date, status')
    .eq('status', 'active')
    .gte('due_date', today)
    .lte('due_date', threeDaysFromNow)
    .limit(500);

  if (error) throw new Error(`Failed to fetch due-soon loans: ${error.message}`);

  const results: Array<Record<string, unknown>> = [];

  for (const loan of (dueSoonLoans ?? []) as OverdueLoanRow[]) {
    const { data: patron } = await admin
      .from('patrons')
      .select('id, user_id, email, full_name, surname, other_names')
      .eq('id', loan.patron_id)
      .maybeSingle();
    if (!patron) {
      results.push({ loanId: loan.id, status: 'skipped_no_patron' });
      continue;
    }

    const { data: item } = loan.catalogue_item_id
      ? await admin.from('catalogue_items').select('title').eq('id', loan.catalogue_item_id).maybeSingle()
      : { data: null };

    const outcomes = await deliverToPatron(
      loan,
      patron as PatronRow,
      'due_soon',
      loan.due_date,
      item?.title ?? 'Library item',
    );
    results.push({ loanId: loan.id, dueDate: loan.due_date, ...outcomes });
  }

  return safeResult(`Processed ${results.length} due-soon loans`, { results });
};
