import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { extractFileText } from '@/server/preservation/textExtraction';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'File id is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: file, error } = await supabase
      .from('repository_files')
      .select('id, repository_item_id, original_filename, extracted_text_status')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!file) {
      return NextResponse.json({ success: false, error: 'File not found.' }, { status: 404 });
    }

    const result = await extractFileText(id);

    return NextResponse.json({
      success: result.success,
      data: {
        fileId: id,
        repositoryItemId: file.repository_item_id,
        filename: file.original_filename,
        status: result.status,
        textLength: result.text?.length ?? 0,
        pageCount: result.pageCount ?? null,
        durationMs: result.durationMs ?? null,
        requestedBy: ctx.user.id,
      },
      error: result.error ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed.';
    const status = message === 'Forbidden.' ? 403 : message === 'Authentication required.' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
