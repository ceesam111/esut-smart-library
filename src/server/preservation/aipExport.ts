import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { computeChecksum } from './checksum';

export interface AipExportResult {
  item_id: string;
  bag_path: string;
  manifest_checksum: string;
  file_count: number;
  created_at: string;
}

export async function exportItemToAip(itemId: string): Promise<AipExportResult | null> {
  const supabase = getSupabaseAdminClient();
  const { data: item } = await supabase
    .from('repository_items')
    .select('id,title,authors,abstract,keywords,item_type,year,doi,handle,license,department,file_url,file_size,status,visibility,created_at,updated_at')
    .eq('id', itemId)
    .maybeSingle();
  if (!item || !item.file_url) return null;

  const fileRes = await fetch(item.file_url);
  if (!fileRes.ok) return null;
  const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
  const fileChecksum = computeChecksum(fileBuffer);

  const metadata = {
    id: item.id,
    title: item.title,
    authors: item.authors,
    abstract: item.abstract,
    keywords: item.keywords,
    item_type: item.item_type,
    year: item.year,
    doi: item.doi,
    handle: item.handle,
    license: item.license,
    department: item.department,
    status: item.status,
    visibility: item.visibility,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };

  const manifest = [
    'BagIt-Version: 1.0',
    'Tag-File-Character-Encoding: UTF-8',
    '',
    `payload-oxum: ${fileBuffer.length}.${fileChecksum}`,
    '',
  ].join('\n');

  const bagName = `aip_${item.id}_${Date.now()}.txt`;
  const bagContent = [
    '=== BagIt Archive ===',
    manifest,
    '=== Metadata (JSON) ===',
    JSON.stringify(metadata, null, 2),
    '=== File ===',
    `filename: ${item.handle || item.id}.pdf`,
    `checksum: ${fileChecksum}`,
    `size: ${fileBuffer.length}`,
    '=== End ===',
  ].join('\n');

  const { error: uploadError } = await supabase.storage
    .from('aip-exports')
    .upload(bagName, bagContent, { contentType: 'text/plain' });

  if (uploadError) return null;

  const { data: urlData } = supabase.storage.from('aip-exports').getPublicUrl(bagName);

  return {
    item_id: itemId,
    bag_path: urlData.publicUrl,
    manifest_checksum: fileChecksum,
    file_count: 1,
    created_at: new Date().toISOString(),
  };
}

export async function getAipExports(itemId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from('aip-exports').list(`${itemId}_`);
  if (error) return [];
  return data ?? [];
}
