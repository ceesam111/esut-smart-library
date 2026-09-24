/* One-off: parse university_library_open_access_databases_catalog.md → TS data module */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mdPath = path.join(root, 'university_library_open_access_databases_catalog.md');
const outPath = path.join(root, 'src', 'config', 'openAccessDatabases.data.ts');

const raw = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');

// Split on "### N. Name" record headers (only after the catalog section)
const catalogStart = raw.indexOf('## Catalog');
const body = catalogStart >= 0 ? raw.slice(catalogStart) : raw;
const parts = body.split(/^### \d+\.\s+/m).slice(1);

function parseRecord(block, fallbackName) {
  const lines = block.split('\n');
  const nameLine = (lines.shift() || '').trim();
  const name = nameLine || fallbackName;
  const fields = {};
  for (const line of lines) {
    const m = line.match(/^-\s+\*\*([^*]+):\*\*\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    // strip wrapping backticks
    val = val.replace(/^`(.+)`$/, '$1');
    fields[key] = val;
  }
  return { name, fields };
}

const ACCESS_LABELS = {
  OA: 'Open Access',
  'OPEN-DATA': 'Open Data',
  DIRECTORY: 'Directory',
  'FREE-MIXED': 'Free Search',
  'FREE-REG': 'Free with Registration',
};

const records = [];
for (const part of parts) {
  const { name, fields } = parseRecord(part, '');
  if (!fields.id || !fields.url) continue;
  const subjectsRaw = fields.subjects || '';
  const subjects = subjectsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const accessCode = (fields.access_status || 'OA').toUpperCase();
  records.push({
    id: fields.id,
    name,
    description: fields.description || '',
    provider: fields.provider || '',
    subjects,
    resourceType: fields.content_types || fields.category || 'Open Access Resource',
    accessType: ACCESS_LABELS[accessCode] || accessCode,
    accessCode,
    category: fields.category || '',
    region: fields.region || '',
    registration: fields.registration || '',
    license: fields.license_and_reuse || '',
    priority: fields.integration_priority || '',
    notes: fields.implementation_notes || '',
    url: fields.url,
    imageUrl: fields.image_url || `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(fields.url)}`,
    isExternal: true,
    status: 'active',
    verifiedDate: fields.verified_date || '2026-09-23',
  });
}

if (records.length !== 117) {
  console.warn(`Expected 117 records, parsed ${records.length}`);
}

const ts = `/* AUTO-GENERATED from university_library_open_access_databases_catalog.md — do not hand-edit.
   Regenerate with: node scripts/parse-oa-catalog.mjs
   Source validated: 2026-09-23 (${records.length} resources) */

import type { LibraryResource } from '@/config/libraryResources.config';

export const OPEN_ACCESS_DATABASES: LibraryResource[] = ${JSON.stringify(records, null, 2)};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, ts, 'utf8');
console.log(`Wrote ${records.length} records → ${outPath}`);
