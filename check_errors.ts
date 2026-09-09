import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import fs from 'fs';

const envFile = fs.readFileSync('.env.development', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].trim();
  }
}

async function main() {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.from('resource_discovery_logs').select('error').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
