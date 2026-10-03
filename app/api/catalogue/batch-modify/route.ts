import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { previewBatchModification, applyBatchModification, type BatchOperation } from '@/server/catalogue/batchModification';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type { MarcRecord } from '@/server/catalogue/marcValidation';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();

    if (!body.action || !body.recordIds || !body.operations) {
      return NextResponse.json({ error: 'action, recordIds, and operations are required' }, { status: 400 });
    }

    if (!Array.isArray(body.recordIds) || !Array.isArray(body.operations)) {
      return NextResponse.json({ error: 'recordIds and operations must be arrays' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    if (body.action === 'preview') {
      const preview = [];
      for (const recordId of body.recordIds) {
        const { data: record, error } = await supabase
          .from('catalogue_items')
          .select('id, title, marc21_fields')
          .eq('id', recordId)
          .single();
        if (error || !record) continue;
        const marc = record.marc21_fields as MarcRecord | null;
        if (!marc) continue;
        const ops = previewBatchModification(marc, body.operations as BatchOperation[]);
        preview.push({ recordId, title: record.title, operations: ops });
      }
      return NextResponse.json({ preview });
    }

    if (body.action === 'apply') {
      const results = await applyBatchModification(body.recordIds as string[], body.operations as BatchOperation[], ctx.user.id);

      const success = results.filter(r => r.success).length;
      const failure = results.filter(r => !r.success).length;

      const { data: actor } = await supabase.from('users').select('email').eq('id', ctx.user.id).single();

      await supabase.from('marc_batch_modification_audit').insert({
        actor_id: ctx.user.id,
        actor_email: actor?.email ?? null,
        operation: body.operations[0]?.type ?? 'UNKNOWN',
        rule_config: body.operations,
        affected_record_ids: body.recordIds,
        success_count: success,
        failure_count: failure,
        change_data: results.map(r => ({ recordId: r.recordId, changes: r.changes, errors: r.errors })),
      });

      return NextResponse.json({ success, failure, results });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
