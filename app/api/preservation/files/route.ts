import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { ensureVerifyJobQueued, markFileDue } from '@/server/preservation/fixity';
import { preservationErrorResponse } from '@/server/preservation/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('repository_files')
      .select(
        'id, repository_item_id, original_filename, storage_provider, storage_bucket, storage_key, checksum, checksum_algorithm, checksum_calculated_at, last_verified_at, next_verification_at, last_verification_result, observed_checksum, preservation_status, updated_at',
      )
      .order('next_verification_at', { ascending: true, nullsFirst: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    return preservationErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';
    if (action !== 'recheck') {
      return NextResponse.json({ success: false, error: 'action must be "recheck".' }, { status: 400 });
    }
    const fileId = typeof body.fileId === 'string' ? body.fileId : '';
    if (!fileId) return NextResponse.json({ success: false, error: 'fileId is required.' }, { status: 400 });

    const supabase = getSupabaseAdminClient();
    const { data: file, error } = await supabase
      .from('repository_files')
      .select('id, original_filename')
      .eq('id', fileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file) return NextResponse.json({ success: false, error: 'File not found.' }, { status: 404 });

    await markFileDue(fileId);
    const queued = await ensureVerifyJobQueued({ payload: { scheduledBy: 'manual_recheck', requestedBy: ctx.user.id, fileId } });

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        queued: queued.queued,
        jobId: queued.jobId,
        deduped: queued.deduped,
        reason: queued.reason ?? null,
        note: 'Checksum verification runs in the worker queue; no hashing happens in this request.',
      },
      error: queued.error ?? null,
    });
  } catch (error) {
    return preservationErrorResponse(error);
  }
}
