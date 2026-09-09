import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import {
  DEFAULT_REGISTRATION_POLICY,
  REGISTRATION_POLICY_KEY,
  parseRegistrationPolicy,
  type RegistrationAccessPolicy,
} from '@/lib/registrationPolicy';

export async function getRegistrationPolicy(): Promise<RegistrationAccessPolicy> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', REGISTRATION_POLICY_KEY)
    .maybeSingle();

  if (error) return DEFAULT_REGISTRATION_POLICY;
  return parseRegistrationPolicy(data?.value);
}

export async function setRegistrationPolicy(policy: RegistrationAccessPolicy) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('app_settings')
    .upsert({
      key: REGISTRATION_POLICY_KEY,
      value: { mode: policy },
      description: 'Controls whether new patron registrations require email verification, branch approval, or direct access.',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    .select('value')
    .single();

  if (error) throw new Error(error.message);
  return parseRegistrationPolicy(data.value);
}
