import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface SerialClaim {
  id: string;
  serial_id: string;
  issue_number: string;
  volume: string;
  status: 'pending' | 'notified' | 'resolved' | 'cancelled';
  notes: string;
  created_at: string;
}

export async function createClaim(input: {
  serial_id: string;
  issue_number: string;
  volume?: string;
  notes?: string;
}): Promise<SerialClaim> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('serials_claims')
    .insert({
      serial_id: input.serial_id,
      issue_number: input.issue_number,
      volume: input.volume || null,
      notes: input.notes || null,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getClaims(serialId: string): Promise<SerialClaim[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('serials_claims')
    .select('*')
    .eq('serial_id', serialId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateClaimStatus(claimId: string, status: SerialClaim['status']): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('serials_claims')
    .update({ status })
    .eq('id', claimId);
  if (error) throw new Error(error.message);
}

export async function getPendingClaims(): Promise<SerialClaim[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('serials_claims')
    .select('*, serials_subscriptions(title, supplier_id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
