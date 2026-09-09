import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

const DEFAULT_MANUAL = {
  title: 'ESUT Library Manual',
  body: 'Library manual content will appear here once it is published by the library administrator.',
  updatedAt: null as string | null,
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'library_manual').maybeSingle();
  if (error) return NextResponse.json({ manual: DEFAULT_MANUAL });
  return NextResponse.json({ manual: data?.value ?? DEFAULT_MANUAL });
}
