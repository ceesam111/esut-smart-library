import { createClient } from '@supabase/supabase-js';

const IR_TYPES = ['Thesis','Dissertation','Journal Article','Conference Paper','Staff Publication','Technical Report','Dataset'];
const dryRun = process.argv.includes('--dry-run');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Missing Supabase URL/key environment variables.');

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase
    .from('catalogue_items')
    .select('*')
    .in('item_type', IR_TYPES);
  if (error) throw error;
  const rows = data ?? [];
  console.log(`${dryRun ? 'DRY RUN:' : 'RUN:'} ${rows.length} catalogue rows match IR migration types.`);
  if (dryRun) {
    console.table(rows.slice(0, 20).map((row: any) => ({ id: row.id, title: row.title, item_type: row.item_type, year: row.year })));
    return;
  }
  const payload = rows.map((row: any) => ({
    legacy_catalog_id: row.id,
    title: row.title,
    creators: Array.isArray(row.authors) ? row.authors : [row.authors].filter(Boolean),
    item_type: row.item_type || row.format || 'Research Paper',
    abstract: row.abstract || null,
    keywords: Array.isArray(row.subjects) ? row.subjects : [],
    department: row.department || null,
    faculty: row.faculty_code || null,
    date_issued: row.year ? String(row.year) : null,
    publisher: row.publisher || null,
    doi: row.doi || null,
    handle: `esutir/${row.year || new Date().getFullYear()}/${String(row.id).replace(/-/g, '').slice(0, 12)}`,
    license: row.license || 'Institutional Use Only',
    embargo_until: row.embargo_until || null,
    file_paths: [row.file_url, row.download_url].filter(Boolean),
    metadata_json: row,
    depositor_id: row.submitter_id || null,
    status: row.embargo_until ? 'embargoed' : 'published',
  }));
  const { error: insertError } = await supabase.from('ir_items').upsert(payload, { onConflict: 'legacy_catalog_id' });
  if (insertError) throw insertError;
  console.log(`Copied ${payload.length} IR rows into ir_items. Existing catalogue_items were not deleted.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
