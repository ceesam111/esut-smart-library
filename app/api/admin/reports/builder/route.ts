import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { runReport, reportToCsv, reportToXlsx, saveReportDefinition, listSavedReports, getSavedReport, deleteSavedReport, listReportHistory, type ReportQuery } from '@/server/reports/reportBuilder';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === 'run') {
      const query = body.query as ReportQuery;
      if (!query?.dataset) {
        return NextResponse.json({ success: false, error: 'dataset required' }, { status: 400 });
      }
      const result = await runReport(query);
      return NextResponse.json({ success: true, result });
    }

    if (action === 'export') {
      const { query, format } = body as { query: ReportQuery; format: 'csv' | 'xlsx' };
      if (!query?.dataset || !format) {
        return NextResponse.json({ success: false, error: 'query and format required' }, { status: 400 });
      }
      const result = await runReport(query);
      if (format === 'csv') {
        const csv = reportToCsv(result.data, result.columns);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="report_${query.dataset}_${Date.now()}.csv"`,
          },
        });
      }
      if (format === 'xlsx') {
        const xlsx = reportToXlsx(result.data, result.columns);
        return new NextResponse(new Uint8Array(xlsx), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="report_${query.dataset}_${Date.now()}.xlsx"`,
          },
        });
      }
      return NextResponse.json({ success: false, error: 'Unsupported format' }, { status: 400 });
    }

    if (action === 'save') {
      const { definition } = body as { definition: Parameters<typeof saveReportDefinition>[1] };
      const userId = (await requireRole(request, GLOBAL_ADMIN_ROLES)).user.id;
      if (!definition?.name || !definition?.dataset) {
        return NextResponse.json({ success: false, error: 'name and dataset required' }, { status: 400 });
      }
      const id = await saveReportDefinition(userId, definition);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'list') {
      const userId = (await requireRole(request, GLOBAL_ADMIN_ROLES)).user.id;
      const reports = await listSavedReports(userId);
      return NextResponse.json({ success: true, reports });
    }

    if (action === 'get') {
      const { reportId } = body as { reportId: string };
      const userId = (await requireRole(request, GLOBAL_ADMIN_ROLES)).user.id;
      const report = await getSavedReport(reportId, userId);
      return NextResponse.json({ success: true, report });
    }

    if (action === 'delete') {
      const { reportId } = body as { reportId: string };
      const userId = (await requireRole(request, GLOBAL_ADMIN_ROLES)).user.id;
      await deleteSavedReport(reportId, userId);
      return NextResponse.json({ success: true });
    }

    if (action === 'history') {
      const { reportId } = body as { reportId: string };
      const userId = (await requireRole(request, GLOBAL_ADMIN_ROLES)).user.id;
      const history = await listReportHistory(reportId, userId);
      return NextResponse.json({ success: true, history });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
