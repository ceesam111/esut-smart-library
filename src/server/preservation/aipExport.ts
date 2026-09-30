import { createHash } from 'crypto';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface AIPExportResult {
  success: boolean;
  aipPath?: string;
  manifest?: string;
  error?: string;
}

function sha256File(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function exportItemAIP(itemId: string, userId: string): Promise<AIPExportResult> {
  const supabase = getSupabaseAdminClient();

  const { data: item, error: itemError } = await supabase
    .from('repository_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (itemError || !item) return { success: false, error: 'Item not found' };

  const { data: files, error: filesError } = await supabase
    .from('repository_files')
    .select('*')
    .eq('repository_item_id', itemId)
    .order('display_order');
  if (filesError) return { success: false, error: 'Failed to fetch files' };

  const aipId = `item-${itemId}`;
  const entries: string[] = [];
  const manifestLines: string[] = [];

  for (const file of (files ?? [])) {
    try {
      const { data: objectData, error: downloadError } = await supabase.storage
        .from(file.storage_bucket)
        .download(file.storage_key);
      if (downloadError || !objectData) continue;

      const bytes = Buffer.from(await objectData.arrayBuffer());
      const checksum = sha256File(bytes);
      const safeName = file.original_filename.replace(/[^a-zA-Z0-9._-]+/g, '-');
      const dataPath = `data/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('aip-exports')
        .upload(`${aipId}/${dataPath}`, bytes, { contentType: file.mime_type || 'application/octet-stream', upsert: true });
      if (uploadError) continue;

      manifestLines.push(`${checksum}  ${dataPath}`);
      entries.push(dataPath);
    } catch {
      continue;
    }
  }

  const descriptiveMetadata = {
    id: item.id,
    title: item.title,
    authors: item.authors,
    abstract: item.abstract,
    keywords: item.keywords,
    year: item.year,
    item_type: item.item_type,
    doi: item.doi,
    license: item.license,
    visibility: item.visibility,
    status: item.status,
  };

  const administrativeMetadata = {
    created_at: item.created_at,
    updated_at: item.updated_at,
    submitter_id: item.submitter_id,
  };

  const rightsMetadata = {
    visibility: item.visibility,
    access_level: 'PUBLIC',
    embargo_until: item.embargo_until,
  };

  const provenance = {
    source: 'ESUT Smart Library',
    exported_at: new Date().toISOString(),
    exported_by: userId,
  };

  const metadataJson = JSON.stringify(descriptiveMetadata, null, 2);
  const adminJson = JSON.stringify(administrativeMetadata, null, 2);
  const rightsJson = JSON.stringify(rightsMetadata, null, 2);
  const provenanceJson = JSON.stringify(provenance, null, 2);
  const manifestContent = manifestLines.join('\n') + '\n';

  const { error: manifestError } = await supabase.storage
    .from('aip-exports')
    .upload(`${aipId}/manifest-sha256.txt`, manifestContent, { contentType: 'text/plain', upsert: true });
  if (manifestError) return { success: false, error: 'Failed to write manifest' };

  await supabase.storage.from('aip-exports').upload(`${aipId}/metadata/descriptive.json`, metadataJson, { contentType: 'application/json', upsert: true });
  await supabase.storage.from('aip-exports').upload(`${aipId}/metadata/administrative.json`, adminJson, { contentType: 'application/json', upsert: true });
  await supabase.storage.from('aip-exports').upload(`${aipId}/metadata/rights.json`, rightsJson, { contentType: 'application/json', upsert: true });
  await supabase.storage.from('aip-exports').upload(`${aipId}/metadata/provenance.json`, provenanceJson, { contentType: 'application/json', upsert: true });

  await supabase.from('preservation_events').insert({
    repository_item_id: itemId,
    event_type: 'AIP_EXPORTED',
    details: { aipId, fileCount: entries.length },
    actor_id: userId,
  });

  return { success: true, aipPath: aipId, manifest: manifestContent };
}

export function validateAIP(manifest: string, files: Array<{ path: string; checksum: string }>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const manifestLines = manifest.trim().split('\n');
  const manifestMap = new Map<string, string>();
  for (const line of manifestLines) {
    const [checksum, path] = line.split('  ');
    if (checksum && path) manifestMap.set(path, checksum);
  }
  for (const file of files) {
    if (!manifestMap.has(file.path)) {
      errors.push(`Missing from manifest: ${file.path}`);
    } else if (manifestMap.get(file.path) !== file.checksum) {
      errors.push(`Checksum mismatch: ${file.path}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
