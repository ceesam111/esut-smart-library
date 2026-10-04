import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult } from './utils';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { noticeDeliveryService } from '@/server/circulation/deliveryService';

export const overdueNoticeWorker: AgentJobHandler = async (job, _ctx) => {
  requireTenant(job);
  const admin = getSupabaseAdminClient();

  const now = new Date();

  const { data: overdueLoans, error } = await admin
    .from('loans')
    .select('id, patron_id, item_id, due_date, status')
    .eq('status', 'active')
    .lte('due_date', now.toISOString().split('T')[0])
    .limit(500);

  if (error) throw new Error(`Failed to fetch overdue loans: ${error.message}`);

  const results: Array<{ loanId: string; stage: string; status: string }> = [];

  for (const loan of overdueLoans ?? []) {
    const dueDate = new Date(loan.due_date);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

    let stage: 'overdue' | 'overdue_escalation' = 'overdue';
    if (daysOverdue >= 30) stage = 'overdue_escalation';
    else if (daysOverdue >= 7) stage = 'overdue_escalation';

    const { data: patron } = await admin
      .from('patrons')
      .select('email, first_name, last_name')
      .eq('user_id', loan.patron_id)
      .maybeSingle();

    if (!patron?.email) {
      results.push({ loanId: loan.id, stage, status: 'skipped_no_email' });
      continue;
    }

    const { data: item } = await admin
      .from('catalogue_items')
      .select('title')
      .eq('id', loan.item_id)
      .maybeSingle();

    const patronName = `${patron.first_name ?? ''} ${patron.last_name ?? ''}`.trim() || 'Patron';
    const idemKey = `overdue:${loan.id}:${stage}`;

    try {
      const result = await noticeDeliveryService.send({
        noticeType: stage,
        channel: 'email',
        email: patron.email,
        userId: loan.patron_id,
        context: {
          patron_name: patronName,
          item_title: item?.title ?? 'Library item',
          due_date: loan.due_date,
        },
        entityType: 'loan',
        entityId: loan.id,
        idempotencyKey: idemKey,
      });
      results.push({ loanId: loan.id, stage, status: result.status });
    } catch {
      results.push({ loanId: loan.id, stage, status: 'failed' });
    }
  }

  return safeResult(`Processed ${results.length} overdue loans`, { results });
};

export const dueSoonNoticeWorker: AgentJobHandler = async (job, _ctx) => {
  requireTenant(job);
  const admin = getSupabaseAdminClient();

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: dueSoonLoans, error } = await admin
    .from('loans')
    .select('id, patron_id, item_id, due_date, status')
    .eq('status', 'active')
    .gte('due_date', now.toISOString().split('T')[0])
    .lte('due_date', threeDaysFromNow.toISOString().split('T')[0])
    .limit(500);

  if (error) throw new Error(`Failed to fetch due-soon loans: ${error.message}`);

  const results: Array<{ loanId: string; status: string }> = [];

  for (const loan of dueSoonLoans ?? []) {
    const { data: patron } = await admin
      .from('patrons')
      .select('email, first_name, last_name')
      .eq('user_id', loan.patron_id)
      .maybeSingle();

    if (!patron?.email) {
      results.push({ loanId: loan.id, status: 'skipped_no_email' });
      continue;
    }

    const { data: item } = await admin
      .from('catalogue_items')
      .select('title')
      .eq('id', loan.item_id)
      .maybeSingle();

    const patronName = `${patron.first_name ?? ''} ${patron.last_name ?? ''}`.trim() || 'Patron';
    const idemKey = `due_soon:${loan.id}:${loan.due_date}`;

    try {
      const result = await noticeDeliveryService.send({
        noticeType: 'due_soon',
        channel: 'email',
        email: patron.email,
        userId: loan.patron_id,
        context: {
          patron_name: patronName,
          item_title: item?.title ?? 'Library item',
          due_date: loan.due_date,
        },
        entityType: 'loan',
        entityId: loan.id,
        idempotencyKey: idemKey,
      });
      results.push({ loanId: loan.id, status: result.status });
    } catch {
      results.push({ loanId: loan.id, status: 'failed' });
    }
  }

  return safeResult(`Processed ${results.length} due-soon loans`, { results });
};
