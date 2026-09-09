import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await getSupabaseAdminClient()
    .from('repository_items')
    .select('id,handle')
    .or(`legacy_catalog_id.eq.${params.id},id.eq.${params.id}`)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({ found: true, repositoryUrl: `/repository/${encodeURIComponent(data.handle ?? data.id)}`, handle: data.handle ?? data.id });
}
