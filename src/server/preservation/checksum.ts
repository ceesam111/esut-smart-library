import { createHash } from 'crypto';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function verifyFileChecksum(fileUrl: string, expectedChecksum: string): Promise<{ status: 'passed' | 'failed' | 'error'; actual?: string; error?: string }> {
  try {
    const res = await fetch(fileUrl, { method: 'GET' });
    if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` };
    const buffer = Buffer.from(await res.arrayBuffer());
    const actual = computeChecksum(buffer);
    return { status: actual === expectedChecksum ? 'passed' : 'failed', actual };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function recordFixityCheck(input: {
  item_id: string;
  file_url: string;
  expected_checksum: string;
  actual_checksum?: string;
  status: 'passed' | 'failed' | 'error';
  error_message?: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase.from('fixity_checks').insert({
    item_id: input.item_id,
    file_url: input.file_url,
    expected_checksum: input.expected_checksum,
    actual_checksum: input.actual_checksum ?? null,
    status: input.status,
    error_message: input.error_message ?? null,
    checked_at: new Date().toISOString(),
  });
}

export async function runFixityCheck(itemId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: item } = await supabase
    .from('repository_items')
    .select('id, file_url, checksum')
    .eq('id', itemId)
    .maybeSingle();
  if (!item || !item.file_url || !item.checksum) return;
  const result = await verifyFileChecksum(item.file_url, item.checksum);
  await recordFixityCheck({
    item_id: itemId,
    file_url: item.file_url,
    expected_checksum: item.checksum,
    actual_checksum: result.actual,
    status: result.status,
    error_message: result.error,
  });
}
