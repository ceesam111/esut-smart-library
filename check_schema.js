import pkg from 'pg';
const { Client } = pkg;
const connectionString = 'postgres://postgres.zhlitczvzgexldyzptos:SmaLibAfued%4026%23%3F@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    UPDATE repository_items SET title = REPLACE(title, 'OGBL', 'ESUT'), department = REPLACE(department, 'OGBL', 'ESUT');
    UPDATE repository_collections SET name = REPLACE(name, 'OGBL', 'ESUT');
    UPDATE repository_communities SET name = REPLACE(name, 'OGBL', 'ESUT');
    UPDATE catalogue_items SET title = REPLACE(title, 'OGBL', 'ESUT');
  `);
  console.log('Replaced OGBL with ESUT');
  await client.end();
}

run().catch(console.error);
