import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const department = searchParams.get('department')?.trim();
  const limit = Math.min(Number(searchParams.get('limit') || 25), 100);
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  let query = supabase
    .from('repository_items')
    .select('id,title,authors,item_type,type,abstract,keywords,department,faculty_code,year,doi,handle,license,embargo_until,status,visibility', { count: 'exact' })
    .eq('status', 'published')
    .eq('visibility', 'global')
    .or(`embargo_until.is.null,embargo_until.lt.${now}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (q) query = query.textSearch('search_vector', q, { type: 'websearch' });
  if (department) query = query.eq('department', department);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const itemIds = (data ?? []).map((item: any) => item.id);
  const { data: files } = await supabase
    .from('repository_files')
    .select('id,repository_item_id,original_filename,display_filename,mime_type,file_size,role,access_level,embargo_until,display_order')
    .in('repository_item_id', itemIds)
    .order('display_order');

  const filesByItem = new Map<string, any[]>();
  for (const file of (files ?? [])) {
    const list = filesByItem.get(file.repository_item_id) ?? [];
    list.push({
      id: file.id,
      filename: file.display_filename || file.original_filename,
      mimeType: file.mime_type,
      size: file.file_size,
      role: file.role,
      accessLevel: file.access_level,
      embargoUntil: file.embargo_until,
    });
    filesByItem.set(file.repository_item_id, list);
  }

  const enriched = (data ?? []).map((item: any) => ({
    ...item,
    files: filesByItem.get(item.id) ?? [],
  }));

  return NextResponse.json({ data: enriched, count, module: 'repository' });
}
