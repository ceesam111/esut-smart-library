import pkg from 'pg';
const { Client } = pkg;
const connectionString = 'postgres://postgres.zhlitczvzgexldyzptos:SmaLibAfued%4026%23%3F@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM agent_jobs ORDER BY created_at DESC LIMIT 5');
  console.log('Recent Agent Jobs:');
  for (const row of res.rows) {
    console.log(`ID: ${row.id}, Type: ${row.job_type}, Status: ${row.status}, Error: ${row.error}`);
  }
  
  // also check if Newspaper RSS exists
  const rssRes = await client.query('SELECT count(*) FROM newspaper_serials');
  console.log(`\nNewspaper serials count: ${rssRes.rows[0].count}`);
  
  await client.end();
}

run().catch(console.error);
