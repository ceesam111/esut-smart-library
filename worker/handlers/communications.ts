import type { AgentJobHandler } from '../types';
import { createApproval, requireTenant, safeResult, textPayload } from './utils';
import { workerJsonCompletion } from '../ai';

export const draftNewsletter: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const topic = textPayload(job, 'topic', 'Library update');
  const fallback = { subject: topic, headline: topic, body: job.payload.draft ?? `Library update: ${topic}`, callToAction: 'Visit the library website for details.', warnings: ['Review tone, dates, names, and links before sending.'] };
  const ai = await workerJsonCompletion({
    agentName: 'Penna',
    jobType: job.job_type,
    fallback,
    systemPrompt: 'Draft concise Nigerian university library communications. Keep it factual, warm, and approval-ready. Return subject, headline, body, callToAction, warnings.',
    userPrompt: JSON.stringify({ topic, audience: job.payload.audience ?? 'library users', notes: job.payload.notes ?? null, draft: job.payload.draft ?? null }),
  });
  const approvalId = await createApproval(supabase, job, 'newsletter_draft', `Newsletter draft: ${topic}`, { topic, audience: job.payload.audience ?? 'library users', draft: ai.data, source: 'Penna', requiresHumanReview: true, usedAi: ai.usedAi });
  return safeResult('Newsletter draft staged for approval.', { approvalId, draft: ai.data, usedAi: ai.usedAi });
};

export const overdueReminders: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const { count, error } = await supabase.from('loans').select('id', { count: 'exact', head: true }).lt('due_date', new Date().toISOString()).eq('status', 'active');
  if (error) throw new Error(error.message);
  const approvalId = await createApproval(supabase, job, 'overdue_reminder_summary', 'Overdue circulation reminder summary', { overdueCount: count ?? 0, source: 'Cizo', resendConfigured: Boolean(process.env.RESEND_API_KEY), recommendation: 'Review overdue accounts before sending reminders.' });
  return safeResult('Overdue reminder summary staged for staff review.', { overdueCount: count ?? 0, approvalId, resendConfigured: Boolean(process.env.RESEND_API_KEY) });
};

export const sendOverdueEmails: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);

  const { data: overdueLoans, error: loanErr } = await supabase
    .from('loans')
    .select('id, due_date, patron_id, catalogue_items(title)')
    .eq('status', 'active')
    .lt('due_date', new Date().toISOString());

  if (loanErr) throw new Error(loanErr.message);
  if (!overdueLoans?.length) return safeResult('No overdue loans found.', { sent: 0 });

  const patronIds = [...new Set(overdueLoans.map((l: any) => l.patron_id))];
  const { data: patrons, error: patronErr } = await supabase
    .from('patrons')
    .select('id, user_id, full_name')
    .in('id', patronIds);

  if (patronErr) throw new Error(patronErr.message);

  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) throw new Error(userErr.message);

  const userMap = new Map((users?.users ?? []).map((u: any) => [u.id, u.email]));
  let sent = 0;
  let failed = 0;

  for (const patron of (patrons ?? [])) {
    const email = userMap.get(patron.user_id);
    if (!email) { failed++; continue; }

    const patronLoans = overdueLoans
      .filter((l: any) => l.patron_id === patron.id)
      .map((l: any) => ({
        title: l.catalogue_items?.title ?? 'Unknown item',
        due_date: l.due_date,
        days_overdue: Math.ceil((Date.now() - new Date(l.due_date).getTime()) / 86400000),
        fine: Math.ceil((Date.now() - new Date(l.due_date).getTime()) / 86400000) * 50,
      }));

    try {
      const { error: sendErr } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          to_name: patron.full_name,
          subject: 'Overdue Library Items — Please Return',
          html: buildOverdueHtml(patron.full_name, patronLoans),
        },
      });
      if (!sendErr) sent++; else failed++;
    } catch {
      failed++;
    }
  }

  return safeResult('Overdue emails processed.', { sent, failed, total: overdueLoans.length });
};

export const sendDueSoonEmails: AgentJobHandler = async (job, { supabase }) => {
  require(job);
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);

  const { data: dueSoonLoans, error: loanErr } = await supabase
    .from('loans')
    .select('id, due_date, patron_id, catalogue_items(title)')
    .eq('status', 'active')
    .gte('due_date', now.toISOString())
    .lte('due_date', threeDaysFromNow.toISOString());

  if (loanErr) throw new Error(loanErr.message);
  if (!dueSoonLoans?.length) return safeResult('No due-soon loans found.', { sent: 0 });

  const patronIds = [...new Set(dueSoonLoans.map((l: any) => l.patron_id))];
  const { data: patrons, error: patronErr } = await supabase
    .from('patrons')
    .select('id, user_id, full_name')
    .in('id', patronIds);

  if (patronErr) throw new Error(patronErr.message);

  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) throw new Error(userErr.message);

  const userMap = new Map((users?.users ?? []).map((u: any) => [u.id, u.email]));
  let sent = 0;
  let failed = 0;

  for (const patron of (patrons ?? [])) {
    const email = userMap.get(patron.user_id);
    if (!email) { failed++; continue; }

    const patronLoans = dueSoonLoans
      .filter((l: any) => l.patron_id === patron.id)
      .map((l: any) => ({
        title: l.catalogue_items?.title ?? 'Unknown item',
        due_date: l.due_date,
      }));

    try {
      const { error: sendErr } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          to_name: patron.full_name,
          subject: 'Library Items Due Soon',
          html: buildDueSoonHtml(patron.full_name, patronLoans),
        },
      });
      if (!sendErr) sent++; else failed++;
    } catch {
      failed++;
    }
  }

  return safeResult('Due-soon emails processed.', { sent, failed, total: dueSoonLoans.length });
};

function require(job: any) {
  requireTenant(job);
}

function buildOverdueHtml(name: string, items: { title: string; days_overdue: number; fine: number }[]): string {
  const rows = items.map(i =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #fecaca;color:#1e293b">${i.title}</td><td style="padding:8px 12px;border-bottom:1px solid #fecaca;color:#dc2626">${i.days_overdue} day${i.days_overdue !== 1 ? 's' : ''}</td><td style="padding:8px 12px;border-bottom:1px solid #fecaca;color:#dc2626;font-weight:600">₦${i.fine.toFixed(2)}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:#6B1D2A;border-radius:12px 12px 0 0;padding:28px 32px"><p style="margin:0;color:#D4A017;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">ESUT Library</p><h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700">ESUT Smart Library</h1></td></tr>
<tr><td style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none">
<h2 style="color:#dc2626;margin-top:0">Overdue Library Items</h2>
<p style="color:#374151">Dear <strong>${name}</strong>, the following items are overdue:</p>
<table style="width:100%;border-collapse:collapse;border:1px solid #fecaca;border-radius:8px;overflow:hidden;margin:16px 0;background:#fff5f5">
<thead><tr style="background:#fef2f2"><th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:13px">Item</th><th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:13px">Days Overdue</th><th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:13px">Fine</th></tr></thead>
<tbody>${rows}</tbody></table>
<p style="color:#374151">Please return these items immediately to the library circulation desk to avoid additional fines.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function buildDueSoonHtml(name: string, items: { title: string; due_date: string }[]): string {
  const rows = items.map(i =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1e293b">${i.title}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#b45309;font-weight:600">${new Date(i.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:#6B1D2A;border-radius:12px 12px 0 0;padding:28px 32px"><p style="margin:0;color:#D4A017;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">ESUT Library</p><h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700">ESUT Smart Library</h1></td></tr>
<tr><td style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none">
<h2 style="color:#6B1D2A;margin-top:0">Library Items Due Soon</h2>
<p style="color:#374151">Dear <strong>${name}</strong>, the following items are due for return within 3 days:</p>
<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0">
<thead><tr style="background:#f8fafc"><th style="padding:10px 12px;text-align:left;color:#64748b;font-size:13px">Item</th><th style="padding:10px 12px;text-align:left;color:#64748b;font-size:13px">Due Date</th></tr></thead>
<tbody>${rows}</tbody></table>
<p style="color:#374151">Please return or renew these items before the due date to avoid fines. You can renew online from your library dashboard.</p>
</td></tr></table></td></tr></table></body></html>`;
}
