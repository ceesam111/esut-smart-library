import { supabase } from '@/lib/supabase';
import { institutionConfig as cfg } from '@config/institution.config';

// ── Brand tokens (single source of truth: institution.config) ─────────────────

const BRAND = {
  primary: cfg.primaryColour,        // header background + links
  accent: '#C9A84C',                 // gold eyebrow accent
  libraryName: cfg.libraryName,      // e.g. "ESUT Library"
  institution: cfg.name,             // full institution name
  location: cfg.state ? `${cfg.state} State, Nigeria` : 'Nigeria',
  supportEmail: cfg.supportEmail,    // contact email in footer
  domainLabel: cfg.primaryDomain,    // bare domain for display
  domainUrl: cfg.domain,             // absolute site url
};

// ── Transport ─────────────────────────────────────────────────────────────────

async function send(to: string, toName: string, subject: string, html: string) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, to_name: toName, subject, html },
  });

  if (error) {
    throw new Error(error.message || 'Email function failed.');
  }

  if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
    const message = 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Email provider rejected the message.';
    throw new Error(message);
  }
}

// ── HTML template ─────────────────────────────────────────────────────────────

function template(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND.libraryName}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <!-- Header -->
  <tr>
    <td style="background:${BRAND.primary};border-radius:12px 12px 0 0;padding:28px 32px">
      <p style="margin:0;color:${BRAND.accent};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${BRAND.libraryName}</p>
      <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700">${BRAND.institution}</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">${BRAND.location}</p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
        ${BRAND.libraryName} &middot; ${BRAND.location}<br>
        <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary}">${BRAND.supportEmail}</a>
        &nbsp;&middot;&nbsp;
        <a href="${BRAND.domainUrl}" style="color:${BRAND.primary}">${BRAND.domainLabel}</a>
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── 1. Welcome email ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(patron: {
  email: string; full_name: string; patron_id: string; faculty_name?: string;
}) {
  const html = template(`
    <h2 style="color:#1A4731;margin-top:0">Welcome to ESUT Library!</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>,</p>
    <p style="color:#374151">Your library account has been created. Here are your details:</p>
    <table style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 12px;color:#64748b;font-size:14px">Patron ID</td><td style="padding:6px 12px;font-weight:700;font-family:monospace;color:#1A4731;font-size:15px">${patron.patron_id}</td></tr>
      ${patron.faculty_name ? `<tr><td style="padding:6px 12px;color:#64748b;font-size:14px">Faculty</td><td style="padding:6px 12px;color:#1e293b;font-size:14px">${patron.faculty_name}</td></tr>` : ''}
    </table>
    <a href="https://esutlibrary.edu.ng/dashboard/library-card" style="display:inline-block;background:#1A4731;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin:8px 0">View Your Library Card</a>
    <p style="color:#374151;margin-top:20px"><strong>Getting started:</strong></p>
    <ul style="color:#374151;line-height:1.8">
      <li>Browse the <a href="https://esutlibrary.edu.ng/catalogue" style="color:#1A4731">online catalogue</a></li>
      <li>Check your <a href="https://esutlibrary.edu.ng/dashboard/reading-lists" style="color:#1A4731">course reading lists</a></li>
      <li>Search <a href="https://esutlibrary.edu.ng/search/global" style="color:#1A4731">250M+ academic works</a> from global databases</li>
      <li>Submit your research to the <a href="https://esutlibrary.edu.ng/repository/submit" style="color:#1A4731">institutional repository</a></li>
    </ul>
  `);
  await send(patron.email, patron.full_name, 'Welcome to ESUT Library', html);
}

export async function sendRegistrationVerificationEmail(patron: {
  email: string;
  full_name: string;
  verificationLink: string;
  expiresAt: string;
}) {
  const html = template(`
    <h2 style="color:#1A4731;margin-top:0">Verify Your ESUT Library Email</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>,</p>
    <p style="color:#374151">Please confirm that this email address belongs to you before your library account is activated.</p>
    <a href="${patron.verificationLink}" style="display:inline-block;background:#1A4731;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin:16px 0">Verify Email Address</a>
    <p style="color:#374151">This verification link expires on <strong>${new Date(patron.expiresAt).toLocaleString('en-GB')}</strong>.</p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6">If the button does not work, copy and paste this link into your browser:<br><a href="${patron.verificationLink}" style="color:#1A4731;word-break:break-all">${patron.verificationLink}</a></p>
  `);
  await send(patron.email, patron.full_name, 'Verify your ESUT Library email', html);
}

// ── 2. Password reset ─────────────────────────────────────────────────────────

export async function sendPasswordReset(email: string, resetLink: string) {
  const html = template(`
    <h2 style="color:#1A4731;margin-top:0">Reset Your Password</h2>
    <p style="color:#374151">We received a request to reset your ESUT Library account password.</p>
    <a href="${resetLink}" style="display:inline-block;background:#1A4731;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin:16px 0">Reset Password</a>
    <p style="color:#374151">This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
    <p style="color:#94a3b8;font-size:13px">If the button doesn't work, copy this link: <a href="${resetLink}" style="color:#1A4731">${resetLink}</a></p>
  `);
  await send(email, email, 'Reset Your ESUT Library Password', html);
}

// ── 3. Loan due reminder ──────────────────────────────────────────────────────

export async function sendLoanDueReminder(
  patron: { email: string; full_name: string },
  items: { title: string; due_date: string }[]
) {
  const rows = items.map(i =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1e293b">${i.title}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#b45309;font-weight:600">${new Date(i.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td></tr>`
  ).join('');

  const html = template(`
    <h2 style="color:#1A4731;margin-top:0">Library Items Due Soon</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>, the following items are due for return within 3 days:</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0">
      <thead><tr style="background:#f8fafc"><th style="padding:10px 12px;text-align:left;color:#64748b;font-size:13px">Item</th><th style="padding:10px 12px;text-align:left;color:#64748b;font-size:13px">Due Date</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#374151">Please return items to the library circulation desk or <a href="https://esutlibrary.edu.ng/dashboard/loans" style="color:#1A4731">renew online</a> before the due date to avoid fines.</p>
  `);
  await send(patron.email, patron.full_name, 'Library Items Due Soon', html);
}

// ── 4. Overdue notice ─────────────────────────────────────────────────────────

export async function sendOverdueNotice(
  patron: { email: string; full_name: string },
  items: { title: string; due_date: string; days_overdue: number; fine: number }[],
  finesSuspended = false
) {
  const rows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #fecaca;color:#1e293b">${i.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fecaca;color:#dc2626">${i.days_overdue} day${i.days_overdue !== 1 ? 's' : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fecaca;color:#dc2626;font-weight:600">₦${i.fine.toFixed(2)}</td>
    </tr>`
  ).join('');

  const fineNote = finesSuspended
    ? `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin:16px 0"><p style="margin:0;color:#92400e;font-size:14px">Fine calculation is currently suspended during the exam period. Please return items at your earliest convenience.</p></div>`
    : '';

  const html = template(`
    <h2 style="color:#dc2626;margin-top:0">Overdue Library Items</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>, the following items are overdue:</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #fecaca;border-radius:8px;overflow:hidden;margin:16px 0;background:#fff5f5">
      <thead><tr style="background:#fef2f2"><th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:13px">Item</th><th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:13px">Days Overdue</th><th style="padding:10px 12px;text-align:left;color:#991b1b;font-size:13px">Fine</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${fineNote}
    <p style="color:#374151">Please return these items immediately to the library circulation desk.</p>
  `);
  await send(patron.email, patron.full_name, 'Overdue Library Items — Please Return', html);
}

// ── 5. Repository approved ────────────────────────────────────────────────────

export async function sendRepositoryApproved(
  submitter: { email: string; full_name: string },
  item: { title: string; doi?: string; id: string }
) {
  const doiBlock = item.doi
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:16px 0"><p style="margin:0;font-size:13px;color:#166534">Your DOI: <a href="https://doi.org/${item.doi}" style="color:#15803d;font-weight:700">https://doi.org/${item.doi}</a></p></div>`
    : '';

  const html = template(`
    <h2 style="color:#166534;margin-top:0">Your Submission Has Been Published!</h2>
    <p style="color:#374151">Dear <strong>${submitter.full_name}</strong>, congratulations! Your work has been approved and is now live in the ESUT Digital Repository.</p>
    <p style="color:#1e293b;font-weight:600;font-size:16px">${item.title}</p>
    ${doiBlock}
    <a href="https://esutlibrary.edu.ng/repository/${item.id}" style="display:inline-block;background:#166534;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin:8px 0">View in Repository</a>
    <p style="color:#374151;margin-top:16px">Share your work with colleagues and cite it using the DOI. Thank you for contributing to open academic knowledge at ESUT.</p>
  `);
  await send(submitter.email, submitter.full_name, 'Your Submission Has Been Published', html);
}

// ── 6. Repository returned ────────────────────────────────────────────────────

export async function sendRepositoryReturned(
  submitter: { email: string; full_name: string },
  item: { title: string },
  notes: string
) {
  const html = template(`
    <h2 style="color:#92400e;margin-top:0">Revision Requested — ${item.title}</h2>
    <p style="color:#374151">Dear <strong>${submitter.full_name}</strong>, your submission requires revisions before it can be published.</p>
    <p style="color:#1e293b;font-weight:600">${item.title}</p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px;font-weight:700;color:#92400e;font-size:13px">Revision Notes from Librarian</p>
      <p style="margin:0;color:#78350f">${notes}</p>
    </div>
    <a href="https://esutlibrary.edu.ng/repository/submit" style="display:inline-block;background:#1A4731;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin:8px 0">Resubmit</a>
  `);
  await send(submitter.email, submitter.full_name, `Revision Requested — ${item.title}`, html);
}

// ── 7. Thesis status update ───────────────────────────────────────────────────

const THESIS_STAGES: Record<string, { name: string; step: number; next: string }> = {
  submitted: { name: 'Submitted', step: 1, next: 'Awaiting supervisor review' },
  supervisor_review: { name: 'Supervisor Review', step: 2, next: 'Your supervisor will review and respond' },
  committee_review: { name: 'Library Committee Review', step: 3, next: 'The committee is reviewing your work' },
  published: { name: 'Published', step: 4, next: 'Your work is live in the repository' },
  returned_to_student: { name: 'Returned for Revision', step: 1, next: 'Please address the feedback and resubmit' },
};

export async function sendThesisStatusUpdate(
  student: { email: string; full_name: string },
  thesis: { title: string; reference_no: string },
  stage: string,
  notes?: string
) {
  const info = THESIS_STAGES[stage] ?? { name: stage, step: 1, next: '' };
  const progress = [1, 2, 3, 4].map(n =>
    `<span style="display:inline-block;width:32px;height:32px;border-radius:50%;text-align:center;line-height:32px;font-weight:700;font-size:14px;${n <= info.step ? 'background:#1A4731;color:#fff' : 'background:#e2e8f0;color:#94a3b8'}">${n}</span>`
  ).join('<span style="display:inline-block;width:20px;height:2px;background:#e2e8f0;vertical-align:middle;margin:0 4px"></span>');

  const notesBlock = notes
    ? `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin:16px 0"><p style="margin:0 0 4px;font-weight:700;color:#92400e;font-size:13px">Notes</p><p style="margin:0;color:#78350f">${notes}</p></div>`
    : '';

  const html = template(`
    <h2 style="color:#1A4731;margin-top:0">Thesis/Project Update — Stage ${info.step} of 4</h2>
    <p style="color:#374151">Dear <strong>${student.full_name}</strong>,</p>
    <p style="color:#374151">Your submission <strong>${thesis.title}</strong> <span style="font-family:monospace;color:#1A4731">(${thesis.reference_no})</span> has been updated.</p>
    <div style="text-align:center;margin:24px 0">${progress}</div>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 16px;margin:16px 0">
      <p style="margin:0 0 4px;font-weight:700;color:#0369a1;font-size:13px">Current Stage</p>
      <p style="margin:0;color:#0c4a6e;font-size:16px;font-weight:600">${info.name}</p>
      ${info.next ? `<p style="margin:6px 0 0;color:#0369a1;font-size:13px">${info.next}</p>` : ''}
    </div>
    ${notesBlock}
    <a href="https://esutlibrary.edu.ng/thesis/status" style="display:inline-block;background:#1A4731;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin:8px 0">Check Status</a>
  `);
  await send(student.email, student.full_name, `Thesis/Project Update — Stage ${info.step} of 4 — ${thesis.reference_no}`, html);
}

// ── 8. High demand alert ──────────────────────────────────────────────────────

export async function sendHighDemandAlert(
  librarian: { email: string; full_name: string },
  item: { title: string; id: string },
  count: number
) {
  const html = template(`
    <h2 style="color:#b45309;margin-top:0">High Demand Alert</h2>
    <p style="color:#374151">Dear <strong>${librarian.full_name}</strong>, a catalogue item is experiencing unusually high access volume.</p>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 4px;font-weight:700;color:#92400e">${item.title}</p>
      <p style="margin:6px 0 0;color:#b45309;font-size:22px;font-weight:700">${count} accesses in the last 24 hours</p>
    </div>
    <p style="color:#374151">Recommended actions:</p>
    <ul style="color:#374151;line-height:1.8">
      <li>Check physical copy availability and consider short-loan circulation</li>
      <li>Request additional copies via acquisitions</li>
      <li>Contact the lecturer to provide alternative online access</li>
    </ul>
    <a href="https://esutlibrary.edu.ng/admin/catalogue/${item.id}" style="display:inline-block;background:#1A4731;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin:8px 0">View in Admin Catalogue</a>
  `);
  await send(librarian.email, librarian.full_name, `High Demand Alert — ${item.title}`, html);
}

// ── 9. Event reminder ─────────────────────────────────────────────────────────

export async function sendEventReminder(
  patron: { email: string; full_name: string },
  event: { title: string; date: string; time?: string; location?: string; online_url?: string }
) {
  const when = new Date(event.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const accessBlock = event.online_url
    ? `<a href="${event.online_url}" style="display:inline-block;background:#166534;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;margin:8px 0">Join Online</a>`
    : event.location
    ? `<p style="color:#374151"><strong>Location:</strong> ${event.location}</p>`
    : '';

  const html = template(`
    <h2 style="color:#1A4731;margin-top:0">Reminder: ${event.title} — Tomorrow</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>, this is a reminder for an upcoming library event.</p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px;font-weight:700;color:#0369a1;font-size:18px">${event.title}</p>
      <p style="margin:4px 0;color:#1e293b"><strong>Date:</strong> ${when}</p>
      ${event.time ? `<p style="margin:4px 0;color:#1e293b"><strong>Time:</strong> ${event.time}</p>` : ''}
    </div>
    ${accessBlock}
    <p style="color:#374151;margin-top:16px">We look forward to seeing you. Contact the library for more information.</p>
  `);
  await send(patron.email, patron.full_name, `Reminder: ${event.title} Tomorrow`, html);
}

// ── 10. Catalogue circulation messages ────────────────────────────────────────

type CirculationPatron = { email?: string; full_name: string };
type CirculationItem = { title: string; authors?: string; call_number?: string | null };

function circulationItemBlock(item: CirculationItem) {
  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px;font-weight:700;color:#1A4731;font-size:16px">${item.title}</p>
      ${item.authors ? `<p style="margin:4px 0;color:#475569;font-size:14px"><strong>Author(s):</strong> ${item.authors}</p>` : ''}
      ${item.call_number ? `<p style="margin:4px 0;color:#475569;font-size:14px"><strong>Call number:</strong> <span style="font-family:monospace">${item.call_number}</span></p>` : ''}
    </div>`;
}

export function emailCatalogueReservationSubmitted(patron: CirculationPatron, item: CirculationItem, expiresAt: string): string {
  return template(`
    <h2 style="color:#1A4731;margin-top:0">Reservation Request Received</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>, your reservation request has been submitted for librarian confirmation.</p>
    ${circulationItemBlock(item)}
    <p style="color:#92400e"><strong>Collection deadline:</strong> ${new Date(expiresAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <p style="color:#374151">Please wait for library confirmation before visiting the shelf or circulation desk.</p>`);
}

export function emailCatalogueBorrowSubmitted(patron: CirculationPatron, item: CirculationItem, expectedDueDate: string, fineRatePerDay: number): string {
  return template(`
    <h2 style="color:#1A4731;margin-top:0">Borrow Request Received</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>, your borrow request has been sent to the circulation desk.</p>
    ${circulationItemBlock(item)}
    <p style="color:#374151"><strong>Expected due date if approved today:</strong> ${new Date(expectedDueDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <p style="color:#92400e">Late returns may attract a fine of <strong>₦${fineRatePerDay.toLocaleString()} per day</strong>, subject to current library rules.</p>
    <p style="color:#374151">The loan becomes active only after a librarian confirms physical checkout.</p>`);
}

export function emailCatalogueLoanConfirmed(patron: CirculationPatron, item: CirculationItem, dueDate: string, fineRatePerDay: number): string {
  return template(`
    <h2 style="color:#1A4731;margin-top:0">Library Loan Confirmed</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>, this item has been checked out to your library account.</p>
    ${circulationItemBlock(item)}
    <p style="color:#b45309"><strong>Due date:</strong> ${new Date(dueDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <p style="color:#374151">Return the item on or before the due date to avoid a late fine of ₦${fineRatePerDay.toLocaleString()} per day.</p>`);
}

export function emailCatalogueReturnSubmitted(patron: CirculationPatron, item: CirculationItem, returnDate: string, estimatedFine?: number): string {
  const fineLine = typeof estimatedFine === 'number'
    ? `<p style="color:#92400e"><strong>Estimated fine:</strong> ₦${estimatedFine.toLocaleString()}</p>`
    : `<p style="color:#64748b">The circulation desk will calculate any applicable fine after confirming the return.</p>`;
  return template(`
    <h2 style="color:#1A4731;margin-top:0">Return Request Received</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>, your return request has been sent to the circulation desk.</p>
    ${circulationItemBlock(item)}
    <p style="color:#374151"><strong>Return date:</strong> ${new Date(returnDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    ${fineLine}
    <p style="color:#374151">The loan remains open until a librarian confirms receipt of the physical item.</p>`);
}

// ── Legacy helpers (preserved for backward compatibility) ─────────────────────

export { send as sendEmail };

export function emailRequestConfirmation(refNo: string, requestText: string, neededBy: string | null): string {
  const deadline = neededBy ? `<p style="margin:8px 0"><strong>Needed by:</strong> ${new Date(neededBy).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : '';
  return template(`
    <h3 style="color:#1A4731;margin-top:0">Request Received — ${refNo}</h3>
    <p>Thank you for submitting a resource request. Your reference number is:</p>
    <p style="font-size:22px;font-weight:bold;color:#1A4731;letter-spacing:1px">${refNo}</p>
    <p><strong>You requested:</strong> ${requestText}</p>
    ${deadline}
    <p>The library will respond within <strong>2 working days</strong>.</p>`);
}

export function emailBeingSourced(refNo: string, requestText: string): string {
  return template(`
    <h3 style="color:#1A4731;margin-top:0">Update on Request ${refNo}</h3>
    <p>Your request is now being actively sourced by our library team.</p>
    <p><strong>Request:</strong> ${requestText}</p>
    <p>We will notify you as soon as the item is ready.</p>`);
}

export function emailReadyForCollection(refNo: string, requestText: string, location: string, collectByDate: string): string {
  const byDate = new Date(collectByDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return template(`
    <h3 style="color:#1A4731;margin-top:0">Ready for Collection — ${refNo}</h3>
    <p>Great news! The item you requested is ready for collection.</p>
    <p><strong>Request:</strong> ${requestText}</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px"><strong style="color:#166534">Collection Location</strong></p>
      <p style="margin:0">${location}</p>
    </div>
    <p style="color:#b45309"><strong>Please collect by ${byDate}.</strong></p>`);
}

export function emailRepositoryRejected(title: string, reason: string): string {
  return template(`
    <h3 style="color:#1A4731;margin-top:0">Update on Your Repository Submission</h3>
    <p>We are unable to approve the following submission at this time:</p>
    <p style="font-weight:bold;color:#1A4731">${title}</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 4px;font-weight:bold;color:#991b1b">Reason for Rejection</p>
      <p style="margin:0">${reason}</p>
    </div>
    <p>You may revise your submission and resubmit.</p>`);
}

export function emailRepositoryPublished(title: string, doi: string): string {
  const doiBlock = doi ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0 0 4px;font-weight:bold;color:#166534">Your DOI</p><p style="margin:0"><a href="https://doi.org/${doi}" style="color:#166534">https://doi.org/${doi}</a></p></div>` : '';
  return template(`
    <h3 style="color:#1A4731;margin-top:0">Your Work Has Been Published!</h3>
    <p>Congratulations! Your submission is now published in the ESUT Digital Repository.</p>
    <p style="font-weight:bold;color:#1A4731">${title}</p>
    ${doiBlock}
    <p>Your work is now accessible to researchers worldwide.</p>`);
}

export function emailThesisSupervisorNotification(title: string, refNo: string, supervisorName: string): string {
  return template(`
    <h3 style="color:#1A4731;margin-top:0">New Thesis Submitted for Your Supervision — ${refNo}</h3>
    <p>Dear ${supervisorName},</p>
    <p>A student has submitted an academic work for your supervision.</p>
    <p><strong>Title:</strong> ${title}</p>
    <p>Please log in to the supervisor portal to review this submission.</p>`);
}

export function emailThesisReturnedToStudent(title: string, refNo: string, revisionNotes: string): string {
  return template(`
    <h3 style="color:#1A4731;margin-top:0">Revision Required — ${refNo}</h3>
    <p>Your submission requires revisions before it can proceed.</p>
    <p><strong>Title:</strong> ${title}</p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 4px;font-weight:bold;color:#92400e">Revision Notes</p>
      <p style="margin:0">${revisionNotes}</p>
    </div>`);
}

export function emailThesisPublished(title: string, refNo: string, doi: string): string {
  const doiBlock = doi ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0 0 4px;font-weight:bold;color:#166534">DOI</p><p style="margin:0"><a href="https://doi.org/${doi}" style="color:#15803d">https://doi.org/${doi}</a></p></div>` : '';
  return template(`
    <h3 style="color:#1A4731;margin-top:0">Congratulations — Your Work is Published!</h3>
    <p>Your academic submission is now published in the ESUT institutional repository.</p>
    <p><strong>Title:</strong> ${title}</p>
    <p style="font-family:monospace;color:#1A4731">${refNo}</p>
    ${doiBlock}`);
}

export function emailHighDemandAlert(courseCode: string, courseTitle: string, itemTitles: string[]): string {
  const itemList = itemTitles.map(t => `<li>${t}</li>`).join('');
  return template(`
    <h3 style="color:#1A4731;margin-top:0">High-Demand Alert: ${courseCode} Reading List</h3>
    <p>The following items on your course reading list are experiencing high demand:</p>
    <p><strong>${courseCode} — ${courseTitle}</strong></p>
    <ul style="margin:12px 0;padding-left:20px">${itemList}</ul>`);
}

export function emailCannotFulfil(refNo: string, requestText: string, reason: string): string {
  return template(`
    <h3 style="color:#1A4731;margin-top:0">Update on Request ${refNo}</h3>
    <p>We regret that we are unable to fulfil your request at this time.</p>
    <p><strong>Request:</strong> ${requestText}</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 4px"><strong style="color:#991b1b">Reason</strong></p>
      <p style="margin:0">${reason}</p>
    </div>
    <p>Consider requesting via Inter-Library Loan or searching DOAJ for open-access versions.</p>`);
}
