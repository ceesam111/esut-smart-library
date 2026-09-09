import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

const IR_TYPES = ['Thesis','Dissertation','Journal Article','Conference Paper','Staff Publication','Technical Report','Dataset','Research Paper','Final Year Project','Undergraduate Long Essay','Book Chapter'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const limit = Math.min(Number(searchParams.get('limit') || 25), 100);
  let query = getSupabaseAdminClient()
    .from('catalogue_items')
    .select('id,title,authors,isbn,issn,call_number,total_copies,available_copies,library_code,shelf_code,location_notes,format,year', { count: 'exact' })
    .not('format', 'in', `(${IR_TYPES.map((type) => `"${type}"`).join(',')})`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (q) query = query.or(`title.ilike.%${q}%,isbn.ilike.%${q}%,issn.ilike.%${q}%,call_number.ilike.%${q}%`);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, module: 'catalog' });
}
