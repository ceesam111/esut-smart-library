import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface VersionInfo {
  version_number: number;
  file_url: string | null;
  change_note: string | null;
  created_at: string;
}

export async function getVersions(itemId: string): Promise<VersionInfo[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('item_versions')
    .select('version_number, file_url, change_note, created_at')
    .eq('item_id', itemId)
    .order('version_number', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getNextVersionNumber(itemId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('item_versions')
    .select('version_number')
    .eq('item_id', itemId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.version_number ?? 0) + 1;
}

export async function createVersion(input: {
  item_id: string;
  file_url: string;
  change_note?: string;
}): Promise<VersionInfo> {
  const supabase = getSupabaseAdminClient();
  const versionNumber = await getNextVersionNumber(input.item_id);
  const { data, error } = await supabase
    .from('item_versions')
    .insert({
      item_id: input.item_id,
      version_number: versionNumber,
      file_url: input.file_url,
      change_note: input.change_note || null,
    })
    .select('version_number, file_url, change_note, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getLatestVersion(itemId: string): Promise<VersionInfo | null> {
  const versions = await getVersions(itemId);
  return versions[0] ?? null;
}
