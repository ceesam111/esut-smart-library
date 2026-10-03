import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { createImportBatch, stageMarcRecord, getImportBatch, getStagedRecords } from '@/server/catalogue/marcImport';
import type { MarcRecord } from '@/server/catalogue/marcValidation';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();

    if (!body.source || !body.records || !Array.isArray(body.records)) {
      return NextResponse.json({ error: 'source and records array are required' }, { status: 400 });
    }

    const batch = await createImportBatch({
      source: body.source,
      filename: body.filename,
      createdBy: ctx.user.id,
    });

    const results = [];
    for (let i = 0; i < body.records.length; i++) {
      const rec = body.records[i];
      try {
        const staged = await stageMarcRecord({
          batchId: batch.id,
          position: i + 1,
          rawMarcxml: rec.rawMarcxml ?? null,
          parsedMarc: rec.parsedMarc as MarcRecord,
          frameworkCode: body.frameworkCode,
        });
        results.push(staged);
      } catch (err) {
        results.push({ position: i + 1, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({ batch, records: results }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }
    const batch = await getImportBatch(batchId);
    const records = await getStagedRecords(batchId);
    return NextResponse.json({ batch, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
