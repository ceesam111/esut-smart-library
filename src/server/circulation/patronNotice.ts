import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface PatronNoticeProfile {
  patronId: string;
  userId: string | null;
  email: string | null;
  fullName: string;
  status: string | null;
}

interface PatronRow {
  id: string;
  user_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  surname?: string | null;
  other_names?: string | null;
  status?: string | null;
}

export function patronDisplayName(row: Pick<PatronRow, 'full_name' | 'surname' | 'other_names'>): string {
  const full = (row.full_name ?? '').trim();
  if (full) return full;
  const parts = `${row.surname ?? ''} ${row.other_names ?? ''}`.trim();
  if (parts) return parts;
  return 'Patron';
}

function toProfile(row: PatronRow): PatronNoticeProfile {
  return {
    patronId: row.id,
    userId: row.user_id ?? null,
    email: row.email ?? null,
    fullName: patronDisplayName(row),
    status: row.status ?? null,
  };
}

/**
 * Resolve a patron notice profile by patron id, auth user id, or email using
 * the real `patrons` schema (full_name/surname/other_names).
 */
export async function getPatronNoticeProfile(keys: {
  patronId?: string;
  userId?: string;
  email?: string;
}): Promise<PatronNoticeProfile | null> {
  const { patronId, userId, email } = keys;
  if (!patronId && !userId && !email) return null;

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('patrons')
    .select('id, user_id, email, full_name, surname, other_names, status');
  if (patronId) query = query.eq('id', patronId);
  else if (userId) query = query.eq('user_id', userId);
  else query = query.eq('email', email!);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return toProfile(data as PatronRow);
}
