import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface PatronEventContext {
  userId?: string;
  faculty?: string;
  department?: string;
  patronRole?: string;
}

export async function loadPatronContext(userId?: string | null): Promise<PatronEventContext> {
  if (!userId) return {};
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from('patrons')
      .select('faculty_name, faculty_code, department, account_role')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return { userId };
    return {
      userId,
      faculty: data.faculty_name ?? data.faculty_code ?? undefined,
      department: data.department ?? undefined,
      patronRole: data.account_role ?? undefined,
    };
  } catch {
    return { userId };
  }
}
