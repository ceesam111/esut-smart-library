import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface MarcFramework {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarcFrameworkField {
  id: string;
  framework_id: string;
  tag: string;
  subfield_code: string;
  label: string;
  is_visible: boolean;
  is_required: boolean;
  is_repeatable: boolean;
  default_value: string | null;
  validation_rules: Record<string, unknown>;
  help_text: string | null;
  sort_order: number;
  is_protected: boolean;
}

export async function listFrameworks(): Promise<MarcFramework[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('marc_frameworks').select('*').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getFramework(code: string): Promise<MarcFramework | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('marc_frameworks').select('*').eq('code', code).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getFrameworkFields(frameworkId: string): Promise<MarcFrameworkField[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('marc_framework_fields')
    .select('*')
    .eq('framework_id', frameworkId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFramework(input: { code: string; name: string; description?: string }): Promise<MarcFramework> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('marc_frameworks').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFramework(id: string, input: Partial<{ name: string; description: string; is_active: boolean }>): Promise<MarcFramework> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('marc_frameworks')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFrameworkField(id: string, input: Partial<{
  label: string;
  is_visible: boolean;
  is_required: boolean;
  is_repeatable: boolean;
  default_value: string;
  validation_rules: Record<string, unknown>;
  help_text: string;
  sort_order: number;
  is_protected: boolean;
}>): Promise<MarcFrameworkField> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('marc_framework_fields')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
