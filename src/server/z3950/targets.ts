import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface Z3950TargetInput {
  name: string;
  host: string;
  port: number;
  database: string;
  description?: string;
  enabled?: boolean;
  trusted?: boolean;
  default_index?: string;
  use_attribute_overrides?: Record<string, number>;
}

export async function listTargets() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('z3950_targets').select('*').order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function createTarget(input: Z3950TargetInput) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('z3950_targets').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTarget(id: string, input: Partial<Z3950TargetInput>) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('z3950_targets')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTarget(id: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('z3950_targets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
