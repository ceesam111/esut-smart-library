import { createClient } from '@supabase/supabase-js';
import { loadDotEnv, tenants } from './demo-seed-lib';

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  loadDotEnv();
  const email = argValue('email')?.trim().toLowerCase();
  const level = (argValue('level') ?? 'ceo').trim().toLowerCase();
  const fullName = argValue('name')?.trim() || email;

  if (!email) throw new Error('Usage: npm run bootstrap:super-admin -- --email=user@example.edu.ng --level=ceo|aceo --name="Full Name"');
  if (level !== 'ceo' && level !== 'aceo') throw new Error('--level must be ceo or aceo.');

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(listError.message);
  const user = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) throw new Error(`No auth user found for ${email}. Ask the user to register or create the auth user first.`);

  const tenantId = tenants.ESUT.id;
  const { data: existingPatron, error: patronLookupError } = await supabase
    .from('patrons')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (patronLookupError) throw new Error(patronLookupError.message);

  if (existingPatron?.id) {
    const { error } = await supabase
      .from('patrons')
      .update({ status: 'active', approved_at: new Date().toISOString(), tenant_id: tenantId })
      .eq('id', existingPatron.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('patrons').insert({
      user_id: user.id,
      tenant_id: tenantId,
      patron_id: `ESUT-SA-${Math.floor(100000 + Math.random() * 900000)}`,
      full_name: fullName,
      email,
      patron_category: 'Library Administration',
      account_role: 'super_admin',
      status: 'active',
      approved_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  const { error: roleError } = await supabase.from('user_roles').upsert({
    user_id: user.id,
    role: 'super_admin',
    tenant_id: tenantId,
    super_admin_level: level,
  }, { onConflict: 'user_id,role' });
  if (roleError) throw new Error(roleError.message);

  console.log(`Granted ${level.toUpperCase()} super administrator to ${email}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
