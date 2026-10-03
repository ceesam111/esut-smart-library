import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { parseMarcXml, serializeMarcXml, type MarcRecord } from '@/server/catalogue/marcXmlParser';
import { validateMarcRecord } from '@/server/catalogue/marcValidation';
import { createImportBatch, stageMarcRecord } from '@/server/catalogue/marcImport';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();

    if (!body.action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    if (body.action === 'export') {
      if (!body.record) {
        return NextResponse.json({ error: 'record is required' }, { status: 400 });
      }
      const xml = serializeMarcXml(body.record as MarcRecord);
      return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
    }

    if (body.action === 'import') {
      if (!body.xml) {
        return NextResponse.json({ error: 'xml is required' }, { status: 400 });
      }
      const record = parseMarcXml(body.xml);
      const validation = validateMarcRecord(record);

      const batch = await createImportBatch({
        source: body.source ?? 'MARCXML',
        filename: body.filename,
        createdBy: ctx.user.id,
      });

      const staged = await stageMarcRecord({
        batchId: batch.id,
        position: 1,
        rawMarcxml: body.xml,
        parsedMarc: record,
        frameworkCode: body.frameworkCode,
      });

      return NextResponse.json({ batch, record: staged, validation }, { status: 201 });
    }

    if (body.action === 'validate') {
      if (!body.xml) {
        return NextResponse.json({ error: 'xml is required' }, { status: 400 });
      }
      const record = parseMarcXml(body.xml);
      const validation = validateMarcRecord(record);
      return NextResponse.json({ validation });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
