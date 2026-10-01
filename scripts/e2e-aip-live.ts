/**
 * Live AIP export and restore end-to-end check (B17).
 *
 * Builds a disposable repository item, exports it as a BagIt AIP, downloads
 * the AIP back out of storage, re-validates it, restores it into an isolated
 * target and then removes every fixture row and object it created.
 *
 * Run: node_modules\.bin\tsx.cmd scripts/e2e-aip-live.ts
 * Flags: --keep (leave fixtures behind for manual inspection)
 */
/* eslint-disable no-console -- CLI diagnostic tool: its printed report is the deliverable. */
import { loadDotEnv } from './demo-seed-lib';
import { createHash, randomUUID } from 'node:crypto';
import type { AIPBundle } from '../src/server/preservation/aipBundle';

loadDotEnv();

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

const KEEP = process.argv.includes('--keep');
const stamp = Date.now();
const BUCKET = 'repository';
const AIP_BUCKET = 'aip-exports';
const keyOne = `e2e-aip/${stamp}/chapter-one.pdf`;
const keyTwo = `e2e-aip/${stamp}/appendix.pdf`;
const contentOne = `Chapter one body ${stamp}\n`;
const contentTwo = `a,b\n1,2\n`;

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  const { getSupabaseAdminClient } = await import('../src/server/supabase/adminClient');
  const { exportItemAIP } = await import('../src/server/preservation/aipExport');
  const { listObjectsRecursive } = await import('../src/server/preservation/objectStore');
  const { validateAIP, parseManifest } = await import('../src/server/preservation/aipBundle');
  const { runRestore } = await import('../src/server/preservation/restore');
  const db = getSupabaseAdminClient();

  const { data: actorRow } = await db.from('user_roles').select('user_id').limit(1).maybeSingle();
  const actorId = actorRow?.user_id as string | undefined;
  check('fixture actor resolved', !!actorId, actorId ?? 'no user_roles rows');

  const itemId = randomUUID();
  const fileIds: string[] = [];
  const createdKeys: string[] = [];
  let aipPath: string | null = null;
  let restoredItemId: string | null = null;
  const restoredKeys: string[] = [];

  try {
    const { error: itemError } = await db.from('repository_items').insert({
      id: itemId,
      title: `E2E AIP FIXTURE ${stamp}`,
      authors: ['Fixture Author'],
      contributors: [],
      abstract: 'Fixture item used by the Batch 7 AIP round trip check.',
      type: 'Article',
      visibility: 'global',
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    check('fixture item created', !itemError, itemError?.message ?? '');

    const fixtures = [
      { key: keyOne, name: 'chapter-one.pdf', body: contentOne, role: 'ORIGINAL', order: 0 },
      { key: keyTwo, name: 'appendix.pdf', body: contentTwo, role: 'SUPPLEMENTARY', order: 1 },
    ];
    for (const fixture of fixtures) {
      const body = Buffer.from(fixture.body, 'utf8');
      const { error: uploadError } = await db.storage.from(BUCKET).upload(fixture.key, body, { contentType: 'application/pdf', upsert: true });
      if (!uploadError) createdKeys.push(fixture.key);
      check(`uploaded ${fixture.name}`, !uploadError, uploadError?.message ?? '');
      const { data: fileRow, error: fileError } = await db
        .from('repository_files')
        .insert({
          repository_item_id: itemId,
          storage_provider: 'supabase',
          storage_bucket: BUCKET,
          storage_key: fixture.key,
          original_filename: fixture.name,
          display_filename: fixture.name,
          mime_type: 'application/pdf',
          file_size: body.byteLength,
          checksum: sha256(body),
          checksum_algorithm: 'sha256',
          checksum_calculated_at: new Date().toISOString(),
          role: fixture.role,
          display_order: fixture.order,
          access_level: 'PUBLIC',
          preservation_status: 'active',
          extracted_text_status: 'pending',
          next_verification_at: FUTURE_ISO(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (fileRow?.id) fileIds.push(fileRow.id as string);
      check(`recorded ${fixture.name}`, !fileError && !!fileRow, fileError?.message ?? '');
    }

    // --- Export ---
    const exported = await exportItemAIP(itemId, actorId ?? '', {});
    aipPath = exported.aipPath ?? null;
    check('AIP export succeeded', exported.success, exported.error ?? '');
    check('AIP export reported valid BagIt structure', exported.validation?.valid === true, JSON.stringify(exported.validation?.errors ?? []));
    check('AIP export wrote a manifest checksum', /^[0-9a-f]{64}$/.test(exported.checksum ?? ''), exported.checksum ?? '');
    check('AIP export payload count is 2', exported.fileCount === 2, String(exported.fileCount));

    // --- Download and re-validate ---
    const bundle: AIPBundle = { bagName: aipPath ?? '', files: new Map() };
    if (aipPath) {
      const listing = await listObjectsRecursive(AIP_BUCKET, aipPath);
      check('AIP objects listed', listing.status === 'ok' && listing.keys.length > 0, `${listing.keys.length} objects`);
      const prefix = `${aipPath}/`;
      for (const key of listing.keys) {
        const { data, error } = await db.storage.from(AIP_BUCKET).download(key);
        if (error || !data) continue;
        bundle.files.set(key.slice(prefix.length), Buffer.from(await data.arrayBuffer()));
      }
      check('AIP bundle downloaded', bundle.files.size > 0, `${bundle.files.size} files`);
      check('AIP contains bagit.txt', bundle.files.has('bagit.txt'));
      check('AIP contains bag-info.txt', bundle.files.has('bag-info.txt'));
      check('AIP contains manifest-sha256.txt', bundle.files.has('manifest-sha256.txt'));
      check('AIP contains tagmanifest-sha256.txt', bundle.files.has('tagmanifest-sha256.txt'));
      check('AIP contains metadata/versions.json', bundle.files.has('metadata/versions.json'));
      check('AIP contains data/ payloads', [...bundle.files.keys()].filter((path) => path.startsWith('data/')).length === 2, JSON.stringify([...bundle.files.keys()].filter((path) => path.startsWith('data/'))));

      const revalidated = validateAIP(bundle);
      check('downloaded AIP re-validates', revalidated.valid, JSON.stringify(revalidated.errors));

      const manifestText = bundle.files.get('manifest-sha256.txt')?.toString('utf8') ?? '';
      const { entries, errors } = parseManifest(manifestText);
      check('manifest parses without errors', errors.length === 0, JSON.stringify(errors));
      check('manifest covers exactly the two payloads', entries.length === 2, JSON.stringify(entries));
      check('manifest paths stay inside data/', entries.every((entry) => entry.path.startsWith('data/') && !entry.path.includes('..')), JSON.stringify(entries.map((entry) => entry.path)));

      const provenanceText = bundle.files.get('metadata/provenance.json')?.toString('utf8') ?? '';
      check('metadata carries no signed URL', !/X-Amz-Signature|token=/.test(provenanceText));
    }

    // --- Restore ---
    if (aipPath) {
      const restore = await runRestore({ aipPath, target: 'isolated', actorId: actorId ?? '' });
      restoredItemId = restore.newItemId ?? null;
      check('restore completed', restore.ok && restore.status === 'complete', restore.error ?? JSON.stringify(restore.errors));
      check('restore created a new item', !!restore.newItemId && restore.newItemId !== itemId, restore.newItemId ?? '');
      check('restore restored both payloads', restore.fileCount === 2, String(restore.fileCount));
      check('restore passed preflight with no warnings', restore.warnings.length === 0, JSON.stringify(restore.warnings));

      const { data: restoredItem } = await db.from('repository_items').select('id, visibility, status, title').eq('id', restoredItemId ?? '').maybeSingle();
      check('restored item is isolated (private)', restoredItem?.visibility === 'private', String(restoredItem?.visibility));
      check('restored item is not published', restoredItem?.status !== 'published', String(restoredItem?.status));

      const { data: restoredFiles } = await db.from('repository_files').select('id, storage_key, checksum').eq('repository_item_id', restoredItemId ?? '');
      for (const file of restoredFiles ?? []) restoredKeys.push((file as { storage_key: string }).storage_key);
      check('restored file rows recorded', (restoredFiles ?? []).length === 2, String((restoredFiles ?? []).length));

      const { data: runRows } = await db.from('restore_runs').select('*').eq('aip_path', aipPath).order('created_at', { ascending: false });
      const latestRun = (runRows ?? [])[0] as { status: string; target: string; file_count: number; restored_document: Record<string, unknown> | null } | undefined;
      check('restore run recorded as complete', latestRun?.status === 'complete', String(latestRun?.status));
      check('restore run target is isolated', latestRun?.target === 'isolated', String(latestRun?.target));
      check('restore run tracked file count', latestRun?.file_count === 2, String(latestRun?.file_count));
      check('restore run recorded provenance', !!latestRun?.restored_document && typeof (latestRun.restored_document as Record<string, unknown>).provenance === 'object');

      const { data: startEvents } = await db.from('preservation_events').select('event_type').eq('repository_item_id', itemId).eq('event_type', 'RESTORE_STARTED');
      const { data: doneEvents } = await db.from('preservation_events').select('event_type').eq('repository_item_id', itemId).eq('event_type', 'RESTORED');
      check('RESTORE_STARTED event recorded', (startEvents ?? []).length >= 1, String((startEvents ?? []).length));
      check('RESTORED event recorded', (doneEvents ?? []).length >= 1, String((doneEvents ?? []).length));

      const { data: aipEvents } = await db.from('preservation_events').select('event_type').eq('repository_item_id', itemId).in('event_type', ['AIP_EXPORTED', 'AIP_VALIDATED']);
      const types = new Set((aipEvents ?? []).map((row) => row.event_type));
      check('AIP_EXPORTED event recorded', types.has('AIP_EXPORTED'), JSON.stringify([...types]));
      check('AIP_VALIDATED event recorded', types.has('AIP_VALIDATED'), JSON.stringify([...types]));
    }

    // --- Target guard ---
    const rejected = await runRestore({ aipPath: aipPath ?? 'missing', target: 'production', actorId: actorId ?? '' });
    check('production restore target rejected', !rejected.ok && rejected.errors.join(' ').match(/not allowed/i) !== null, rejected.errors.join(' | '));
  } finally {
    if (!KEEP) {
      if (restoredItemId) {
        await db.from('repository_files').delete().eq('repository_item_id', restoredItemId);
        await db.from('repository_items').delete().eq('id', restoredItemId);
      }
      if (restoredKeys.length) await db.storage.from(BUCKET).remove(restoredKeys).catch(() => undefined);
      if (aipPath) {
        await db.from('restore_runs').delete().eq('aip_path', aipPath);
        const listing = await listObjectsRecursive(AIP_BUCKET, aipPath);
        if (listing.status === 'ok' && listing.keys.length) {
          await db.storage.from(AIP_BUCKET).remove(listing.keys).catch(() => undefined);
        }
      }
      if (fileIds.length) await db.from('repository_files').delete().in('id', fileIds);
      await db.from('repository_items').delete().eq('id', itemId);
      if (createdKeys.length) await db.storage.from(BUCKET).remove(createdKeys).catch(() => undefined);

      const idsToCount = [itemId, ...(restoredItemId ? [restoredItemId] : [])];
      const { count: leftoverItems } = await db.from('repository_items').select('id', { count: 'exact', head: true }).in('id', idsToCount);
      const { count: leftoverRuns } = await db.from('restore_runs').select('id', { count: 'exact', head: true }).eq('aip_path', aipPath ?? 'none');
      check('cleanup removed fixture and restored items', leftoverItems === 0, String(leftoverItems));
      check('cleanup removed restore runs', leftoverRuns === 0, String(leftoverRuns));
    } else {
      check('cleanup skipped (--keep)', true, '');
    }
  }

  const failed = checks.filter((entry) => !entry.ok);
  console.log('\n---- SUMMARY ----');
  console.log(`${checks.length - failed.length}/${checks.length} passed`);
  for (const failure of failed) console.log(`FAIL  ${failure.name} -- ${failure.detail}`);
  process.exitCode = failed.length ? 1 : 0;
}

function FUTURE_ISO(): string {
  return '2099-01-01T00:00:00.000Z';
}

main().catch((error) => {
  console.error('FATAL', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
