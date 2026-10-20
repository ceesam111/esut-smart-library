import { requestMemo } from '@/server/util/requestMemo';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isPubliclyIndexable, type ScholarlyItem } from '@/server/seo/scholarlyMetadata';

const PUBLIC_ITEM_COLUMNS =
  'id,handle,title,authors,abstract,keywords,type,item_type,doi,license,year,department,faculty_code,language,file_url,orcid_ids,created_at,embargo_until,status,visibility';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RawItem = ScholarlyItem & { status: string | null; visibility: string | null; embargo_until: string | null };

export const getPublicRepositoryItem = requestMemo(async (ref: string): Promise<ScholarlyItem | null> => {
  const trimmed = ref.trim();
  if (!trimmed || trimmed.length > 200) return null;

  try {
    const db = getSupabaseAdminClient();
    let query = db.from('repository_items').select(PUBLIC_ITEM_COLUMNS);
    if (UUID_PATTERN.test(trimmed)) {
      query = query.or(`handle.eq.${trimmed},id.eq.${trimmed}`);
    } else {
      query = query.eq('handle', trimmed);
    }
    const { data } = await query.maybeSingle();
    if (!data) return null;
    const item = data as RawItem;
    if (!isPubliclyIndexable(item)) return null;
    const { status: _status, visibility: _visibility, embargo_until: _embargo, ...publicItem } = item;
    return publicItem;
  } catch {
    return null;
  }
});
