import fs from 'fs';

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
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
  console.log('Starting worker test run...');
  import('./worker/index');
}

main().catch(console.error);
