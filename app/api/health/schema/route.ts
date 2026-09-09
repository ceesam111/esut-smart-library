import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

export const dynamic = 'force-dynamic';

const requiredTables = ['catalogue_items', 'patrons', 'resource_harvest_runs', 'resource_candidates', 'resource_discovery_logs'];

export async function GET() {
  const supabase = getSupabaseAdminClient();
  const checks = await Promise.all(requiredTables.map(async (table) => {
    const { error } = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1);
    return {
      table,
      ok: !error,
      missing: error ? isMissingSchemaError(error) : false,
      error: error ? error.message : null,
    };
  }));
  const ok = checks.every((check) => check.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
