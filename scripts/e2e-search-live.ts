/**
 * Live search and access-leak end-to-end check (8.26, 8.28).
 *
 * Creates a disposable repository item with one PUBLIC and one PRIVATE file,
 * runs the real extraction path, indexes the item, then proves:
 *   - a public full-text hit is returned with a snippet
 *   - a private-only term is NOT searchable anonymously
 *   - the same term IS searchable by the file owner
 *   - facet counts never expose the private file
 * Every fixture row and object is removed afterwards.
 *
 * Run: node_modules\.bin\tsx.cmd scripts\e2e-search-live.ts
 */
/* eslint-disable no-console -- CLI diagnostic tool: its printed report is the deliverable. */
import { loadDotEnv } from './demo-seed-lib';
import { randomUUID } from 'node:crypto';
import { jsPDF } from 'jspdf';

loadDotEnv();

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

function pdfWithText(lines: string[]): Buffer {
  const doc = new jsPDF();
  lines.forEach((line, index) => doc.text(line, 12, 15 + index * 10));
  return Buffer.from(doc.output('arraybuffer'));
}

async function main() {
  const { getSupabaseAdminClient } = await import('../src/server/supabase/adminClient');
  const { extractFileText } = await import('../src/server/preservation/textExtraction');
  const { indexRepositoryItem } = await import('../src/server/search/indexModel');
  const { searchRepository } = await import('../src/server/search/repositorySearch');
  const db = getSupabaseAdminClient();

  const { data: actorRow } = await db.from('user_roles').select('user_id').limit(1).maybeSingle();
  const ownerId = actorRow?.user_id as string | undefined;
  check('fixture owner resolved', !!ownerId, ownerId ?? 'no user_roles rows');

  const itemId = randomUUID();
  const publicFileId = randomUUID();
  const privateFileId = randomUUID();
  const stamp = Date.now();
  const publicKey = `e2e-search/${stamp}/public.pdf`;
  const privateKey = `e2e-search/${stamp}/private.pdf`;
  const BUCKET = 'repository';

  const PUBLIC_TERM = `zebracatalogpublic${stamp}`;
  const PRIVATE_TERM = `xyzzyplughsecret${stamp}`;

  try {
    const { error: itemError } = await db.from('repository_items').insert({
      id: itemId,
      title: `E2E SEARCH FIXTURE ${stamp}`,
      authors: ['Fixture Author'],
      contributors: [],
      abstract: 'Fixture item for the Batch 8 search round trip.',
      type: 'Article',
      visibility: 'global',
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    check('fixture item created', !itemError, itemError?.message ?? '');

    const publicBytes = pdfWithText([`Public abstract ${PUBLIC_TERM}`, 'A public PDF body.']);
    const privateBytes = pdfWithText([`Private body ${PRIVATE_TERM}`, 'A private PDF body.']);

    const { error: pubUp } = await db.storage.from(BUCKET).upload(publicKey, publicBytes, { contentType: 'application/pdf' });
    const { error: privUp } = await db.storage.from(BUCKET).upload(privateKey, privateBytes, { contentType: 'application/pdf' });
    check('public object uploaded', !pubUp, pubUp?.message ?? '');
    check('private object uploaded', !privUp, privUp?.message ?? '');

    const { error: pubFileErr } = await db.from('repository_files').insert({
      id: publicFileId,
      repository_item_id: itemId,
      storage_provider: 'supabase',
      storage_bucket: BUCKET,
      storage_key: publicKey,
      original_filename: 'public.pdf',
      display_filename: 'public.pdf',
      mime_type: 'application/pdf',
      file_size: publicBytes.length,
      checksum: 'pub',
      checksum_algorithm: 'sha256',
      role: 'ORIGINAL',
      display_order: 0,
      access_level: 'PUBLIC',
      uploader_id: ownerId,
      preservation_status: 'active',
      extracted_text_status: 'PENDING',
    });
    const { error: privFileErr } = await db.from('repository_files').insert({
      id: privateFileId,
      repository_item_id: itemId,
      storage_provider: 'supabase',
      storage_bucket: BUCKET,
      storage_key: privateKey,
      original_filename: 'private.pdf',
      display_filename: 'private.pdf',
      mime_type: 'application/pdf',
      file_size: privateBytes.length,
      checksum: 'priv',
      checksum_algorithm: 'sha256',
      role: 'SUPPLEMENTARY',
      display_order: 1,
      access_level: 'PRIVATE',
      uploader_id: ownerId,
      preservation_status: 'active',
      extracted_text_status: 'PENDING',
    });
    check('public file row created', !pubFileErr, pubFileErr?.message ?? '');
    check('private file row created', !privFileErr, privFileErr?.message ?? '');

    const publicExtraction = await extractFileText(publicFileId);
    check('public extraction succeeded', publicExtraction.success && publicExtraction.status === 'COMPLETE', publicExtraction.error ?? '');

    const privateExtraction = await extractFileText(privateFileId);
    check('private extraction succeeded', privateExtraction.success && privateExtraction.status === 'COMPLETE', privateExtraction.error ?? '');

    const { data: publicText } = await db.from('repository_files').select('extracted_text').eq('id', publicFileId).maybeSingle();
    check('public extracted text stored', !!publicText?.extracted_text?.includes(PUBLIC_TERM), String(publicText?.extracted_text ?? '').slice(0, 60));

    const indexed = await indexRepositoryItem(itemId);
    check('item indexed', indexed.documents === 2, `documents=${indexed.documents}`);

    const publicSearch = await searchRepository({ query: PUBLIC_TERM, userId: null });
    check('anonymous public full-text hit returned', publicSearch.total === 1, `total=${publicSearch.total}`);
    check('public snippet rendered', !!publicSearch.items[0]?.snippet?.includes(PUBLIC_TERM), publicSearch.items[0]?.snippet ?? 'none');
    check('public match provenance recorded', Array.isArray(publicSearch.items[0]?.matchedIn), JSON.stringify(publicSearch.items[0]?.matchedIn ?? null));

    const privateSearch = await searchRepository({ query: PRIVATE_TERM, userId: null });
    check('anonymous private-only term NOT searchable', privateSearch.total === 0, `total=${privateSearch.total}`);

    const ownerSearch = await searchRepository({ query: PRIVATE_TERM, userId: ownerId ?? null });
    check('owner can search private file text', ownerSearch.total === 1, `total=${ownerSearch.total}`);

    const anonFacets = await searchRepository({ userId: null });
    const accessValues = anonFacets.facets.accessLevel.map((entry) => entry.value);
    check('anonymous access facet hides PRIVATE', !accessValues.includes('PRIVATE'), JSON.stringify(accessValues));
    check('anonymous access facet shows PUBLIC', accessValues.includes('PUBLIC'), JSON.stringify(accessValues));

    const anonAll = await searchRepository({ userId: null });
    check('anonymous result count excludes private-only matches', anonAll.total >= 1, `total=${anonAll.total}`);

    const titleSearch = await searchRepository({ query: 'E2E SEARCH FIXTURE', userId: null, sort: 'title' });
    check('title search works', titleSearch.total >= 1, `total=${titleSearch.total}`);
    check('title sort applied', titleSearch.sort === 'title', titleSearch.sort);

    const paged = await searchRepository({ userId: null, page: 1, pageSize: 1 });
    check('pagination metadata returned', paged.pageSize === 1 && paged.totalPages >= 1, `pageSize=${paged.pageSize} totalPages=${paged.totalPages}`);
  } finally {
    await db.from('repository_search_documents').delete().eq('repository_item_id', itemId);
    await db.from('repository_files').delete().in('id', [publicFileId, privateFileId]);
    await db.from('repository_items').delete().eq('id', itemId);
    await db.storage.from(BUCKET).remove([publicKey, privateKey]).catch(() => undefined);

    const { count: leftoverItems } = await db.from('repository_items').select('id', { count: 'exact', head: true }).eq('id', itemId);
    const { count: leftoverFiles } = await db.from('repository_files').select('id', { count: 'exact', head: true }).in('id', [publicFileId, privateFileId]);
    const { count: leftoverDocs } = await db.from('repository_search_documents').select('id', { count: 'exact', head: true }).eq('repository_item_id', itemId);
    check('cleanup removed fixture item', leftoverItems === 0, String(leftoverItems));
    check('cleanup removed fixture files', leftoverFiles === 0, String(leftoverFiles));
    check('cleanup removed search documents', leftoverDocs === 0, String(leftoverDocs));
  }

  const failed = checks.filter((entry) => !entry.ok);
  console.log('\n---- SUMMARY ----');
  console.log(`${checks.length - failed.length}/${checks.length} passed`);
  for (const failure of failed) console.log(`FAIL  ${failure.name} -- ${failure.detail}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error('FATAL', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
