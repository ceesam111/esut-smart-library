import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { createImportBatch, stageMarcRecord } from '@/server/catalogue/marcImport';
import type { MarcRecord } from '@/server/catalogue/marcValidation';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();

    if (!body.parsedMarc || !body.targetId) {
      return NextResponse.json({ error: 'parsedMarc and targetId are required' }, { status: 400 });
    }

    const batch = await createImportBatch({
      source: 'Z39.50',
      filename: `Z39.50:${body.targetId}`,
      createdBy: ctx.user.id,
    });

    const staged = await stageMarcRecord({
      batchId: batch.id,
      position: 1,
      rawMarcxml: body.rawMarcxml ?? null,
      parsedMarc: body.parsedMarc as MarcRecord,
      frameworkCode: body.frameworkCode,
    });

    const { error: _updateError } = await supabase
      .from('marc_import_records')
      .update({
        error_detail: JSON.stringify({
          z3950TargetId: body.targetId,
          z3950TargetName: body.targetName,
          z3950ControlNumber: body.controlNumber,
          z3950ImportedBy: ctx.user.id,
          z3950ImportedAt: new Date().toISOString(),
        }),
      })
      .eq('id', staged.id);

    return NextResponse.json({ batch, record: staged }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}

import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
const supabase = getSupabaseAdminClient();
