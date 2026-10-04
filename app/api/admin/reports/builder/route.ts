import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import {
  runReport,
  runReportPaged,
  reportToCsv,
  reportToXlsx,
  saveReportDefinition,
  listSavedReports,
  getSavedReport,
  deleteSavedReport,
  listReportHistory,
  logReportRun,
  EXPORT_MAX_ROWS,
  type ReportQuery,
} from '@/server/reports/reportBuilder';
import { updateReportSchedule } from '@/server/reports/reportScheduler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const userId = user.id;
    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === 'run') {
      const { query, logRun } = body as { query: ReportQuery; logRun?: boolean };
      if (!query?.dataset) {
        return NextResponse.json({ success: false, error: 'dataset required' }, { status: 400 });
      }
      try {
        const result = await runReport(query);
        if (logRun) {
          await logReportRun(
            (query as unknown as { reportId?: string }).reportId ?? null,
            query.dataset,
            userId,
            'completed',
            { rowCount: result.data.length, filters: query.filters ?? [], columns: result.columns, outputFormat: 'table' },
          );
        }
        return NextResponse.json({ success: true, result });
      } catch (error) {
        if (logRun) {
          await logReportRun(
            (query as unknown as { reportId?: string }).reportId ?? null,
            query.dataset,
            userId,
            'failed',
            { errorMessage: error instanceof Error ? error.message : 'Report run failed', filters: query.filters ?? [] },
          ).catch(() => undefined);
        }
        throw error;
      }
    }

    if (action === 'export') {
      const { query, format, reportName } = body as { query: ReportQuery; format: 'csv' | 'xlsx'; reportName?: string };
      if (!query?.dataset || !format) {
        return NextResponse.json({ success: false, error: 'query and format required' }, { status: 400 });
      }
      try {
        const result = await runReportPaged(query, EXPORT_MAX_ROWS);
        const reportId = (query as unknown as { reportId?: string }).reportId ?? null;
        const stamp = Date.now();
        if (format === 'csv') {
          const csv = reportToCsv(result.data, result.columns);
          await logReportRun(reportId, query.dataset, userId, 'completed', {
            rowCount: result.data.length,
            filters: query.filters ?? [],
            columns: result.columns,
            outputFormat: 'csv',
          });
          return new NextResponse(csv, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="report_${query.dataset}_${stamp}.csv"`,
            },
          });
        }
        if (format === 'xlsx') {
          const xlsx = await reportToXlsx(result.data, result.columns, {
            reportName: reportName || `report_${query.dataset}`,
          });
          await logReportRun(reportId, query.dataset, userId, 'completed', {
            rowCount: result.data.length,
            filters: query.filters ?? [],
            columns: result.columns,
            outputFormat: 'xlsx',
          });
          return new NextResponse(new Uint8Array(xlsx), {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="report_${query.dataset}_${stamp}.xlsx"`,
            },
          });
        }
        return NextResponse.json({ success: false, error: 'Unsupported format' }, { status: 400 });
      } catch (error) {
        await logReportRun(
          (query as unknown as { reportId?: string }).reportId ?? null,
          query.dataset,
          userId,
          'failed',
          { errorMessage: error instanceof Error ? error.message : 'Export failed', filters: query.filters ?? [], outputFormat: format },
        ).catch(() => undefined);
        throw error;
      }
    }

    if (action === 'save') {
      const { definition } = body as { definition: Parameters<typeof saveReportDefinition>[1] };
      if (!definition?.name || !definition?.dataset) {
        return NextResponse.json({ success: false, error: 'name and dataset required' }, { status: 400 });
      }
      const id = await saveReportDefinition(userId, definition);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'list') {
      const reports = await listSavedReports(userId);
      return NextResponse.json({ success: true, reports });
    }

    if (action === 'get') {
      const { reportId } = body as { reportId: string };
      const report = await getSavedReport(reportId, userId);
      return NextResponse.json({ success: true, report });
    }

    if (action === 'delete') {
      const { reportId } = body as { reportId: string };
      await deleteSavedReport(reportId, userId);
      return NextResponse.json({ success: true });
    }

    if (action === 'history') {
      const { reportId } = body as { reportId?: string | null };
      const history = await listReportHistory(reportId ?? null, userId);
      return NextResponse.json({ success: true, history });
    }

    if (action === 'schedule') {
      const { reportId, schedule } = body as {
        reportId: string;
        schedule: { enabled: boolean; frequency?: string | null; time?: string | null; day?: number | null; delivery?: string | null } | null;
      };
      if (!reportId) {
        return NextResponse.json({ success: false, error: 'reportId required' }, { status: 400 });
      }
      const updated = await updateReportSchedule(reportId, userId, schedule ?? null);
      if (!updated) {
        return NextResponse.json({ success: false, error: 'Saved report not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, schedule: updated });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return routeError(error);
  }
}
