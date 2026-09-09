import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.development', 'utf-8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    process.env[key] = val;
  }
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('URL:', url?.substring(0, 20), '...');
  console.log('KEY:', key?.substring(0, 10), '...');
  
  if (!url || !key) return console.error('Missing URL or KEY');

  const supabase = createClient(url, key);
  
  for (const bucket of ['repository', 'theses', 'avatars', 'profiles']) {
    const { data, error } = await supabase.storage.createBucket(bucket, { public: true });
    console.log(`Created ${bucket}:`, data, error?.message);
  }
}

main().catch(console.error);
