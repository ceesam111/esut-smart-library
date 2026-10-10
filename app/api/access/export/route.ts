import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { escapeCsvValue } from '@/server/analytics/csv';
import { buildXlsx } from '@/server/reports/xlsx';

const Query = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(['csv', 'xlsx']).default('csv'),
});
type QueryType = z.infer<typeof Query>;

const MAX_EXPORT_ROWS = 5000;

const COLUMNS = ['visit_id', 'branch', 'status', 'entry_method', 'exit_method', 'checked_in_at', 'checked_out_at', 'duration_minutes', 'academic_session', 'semester', 'observed', 'correction_reason'];
const LABELS = ['Visit ID', 'Branch', 'Status', 'Entry Method', 'Exit Method', 'Checked In At', 'Checked Out At', 'Duration (min)', 'Academic Session', 'Semester', 'Observed', 'Correction Reason'];

export const GET = withHandler<unknown, QueryType>({
  querySchema: Query,
  async handler({ query, request }) {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    let q = supabase
      .from('access_visits')
      .select('id, branch_id, status, entry_method, exit_method, checked_in_at, checked_out_at, duration_minutes, academic_session, semester, is_observed, correction_reason, library_branches(name)')
      .eq('tenant_id', tenant.tenantId);
    if (query.branchId) q = q.eq('branch_id', query.branchId);
    if (query.from) q = q.gte('checked_in_at', query.from);
    if (query.to) q = q.lte('checked_in_at', query.to);
    q = q.order('checked_in_at', { ascending: false }).limit(MAX_EXPORT_ROWS);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((r) => {
      const branch = Array.isArray(r.library_branches) ? r.library_branches[0] : r.library_branches;
      return {
      visit_id: r.id,
      branch: branch?.name ?? r.branch_id,
      status: r.status,
      entry_method: r.entry_method,
      exit_method: r.exit_method ?? '',
      checked_in_at: r.checked_in_at,
      checked_out_at: r.checked_out_at ?? '',
      duration_minutes: r.duration_minutes ?? '',
      academic_session: r.academic_session ?? '',
      semester: r.semester ?? '',
      observed: r.is_observed ? 'yes' : 'no',
      correction_reason: r.correction_reason ?? '',
      };
    });

    await writeAuditLog({
      tenantId: tenant.tenantId,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: 'access.export',
      entityType: 'access_visits',
      entityId: null,
      metadata: {
        format: query.format,
        rowCount: rows.length,
        filters: { branchId: query.branchId ?? null, from: query.from ?? null, to: query.to ?? null },
      },
    });

    const stamp = new Date().toISOString().slice(0, 10);

    if (query.format === 'xlsx') {
      const buffer = await buildXlsx(rows, COLUMNS, { reportName: 'SLAAS Attendance', columnLabels: LABELS });
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="slaas-attendance-${stamp}.xlsx"`,
        },
      });
    }

    const header = COLUMNS.map(escapeCsvValue).join(',');
    const lines = rows.map((row) => COLUMNS.map((col) => escapeCsvValue(row[col as keyof typeof row])).join(','));
    const csv = [header, ...lines].join('\n') + '\n';
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="slaas-attendance-${stamp}.csv"`,
      },
    });
  },
});
