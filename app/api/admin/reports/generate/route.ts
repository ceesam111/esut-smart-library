import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { generateReport, reportToCsv } from '@/server/reports/reportWriter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { type, startDate, endDate, format } = body as {
      type?: 'circulation' | 'acquisitions' | 'repository' | 'serials' | 'fines';
      startDate?: string;
      endDate?: string;
      format?: 'csv' | 'json';
    };

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'type, startDate, and endDate required' }, { status: 400 });
    }

    const report = await generateReport({ type, startDate, endDate, format: format || 'json' });

    if (format === 'csv') {
      const csv = reportToCsv(report.data);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}_report_${startDate}_${endDate}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
