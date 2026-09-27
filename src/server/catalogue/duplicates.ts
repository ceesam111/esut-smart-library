import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface DuplicateGroup {
  id: string;
  title: string;
  isbn: string | null;
  items: { id: string; title: string; isbn: string | null; created_at: string; status: string }[];
}

export async function findPotentialDuplicates(threshold = 0.85): Promise<DuplicateGroup[]> {
  const supabase = getSupabaseAdminClient();
  const { data: items, error } = await supabase
    .from('catalogue_items')
    .select('id,title,isbn,created_at,status')
    .not('isbn', 'is', null)
    .limit(500);
  if (error) throw new Error(error.message);

  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (const item of items ?? []) {
    if (seen.has(item.id)) continue;
    const duplicates = (items ?? []).filter((other) => {
      if (other.id === item.id || seen.has(other.id)) return false;
      return normalizeIsbn(item.isbn) === normalizeIsbn(other.isbn);
    });
    if (duplicates.length > 0) {
      const group: DuplicateGroup = {
        id: item.id,
        title: item.title,
        isbn: item.isbn,
        items: [item, ...duplicates],
      };
      groups.push(group);
      seen.add(item.id);
      duplicates.forEach((d) => seen.add(d.id));
    }
  }
  return groups;
}

export async function findTitleDuplicates(): Promise<DuplicateGroup[]> {
  const supabase = getSupabaseAdminClient();
  const { data: items, error } = await supabase
    .from('catalogue_items')
    .select('id,title,isbn,created_at,status')
    .limit(500);
  if (error) throw new Error(error.message);

  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (const item of items ?? []) {
    if (seen.has(item.id)) continue;
    const key = normalizeTitle(item.title);
    const duplicates = (items ?? []).filter((other) => {
      if (other.id === item.id || seen.has(other.id)) return false;
      return normalizeTitle(other.title) === key;
    });
    if (duplicates.length > 0) {
      groups.push({ id: item.id, title: item.title, isbn: item.isbn, items: [item, ...duplicates] });
      seen.add(item.id);
      duplicates.forEach((d) => seen.add(d.id));
    }
  }
  return groups;
}

function normalizeIsbn(isbn: string | null): string {
  if (!isbn) return '';
  return isbn.replace(/[^0-9X]/gi, '').toUpperCase();
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}
