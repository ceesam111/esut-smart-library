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
    .select('id,title,authors,item_type,type,abstract,keywords,department,faculty_code,year,doi,handle,license,embargo_until,file_url,status,visibility', { count: 'exact' })
    .eq('status', 'published')
    .eq('visibility', 'global')
    .or(`embargo_until.is.null,embargo_until.lt.${now}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (q) query = query.textSearch('search_vector', q, { type: 'websearch' });
  if (department) query = query.eq('department', department);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, module: 'repository' });
}
