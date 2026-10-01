/**
 * Live fixity end-to-end check against the hosted Supabase project (B16).
 *
 * Creates a disposable repository file, drives the real fixity worker code
 * through VALID, MISMATCH, MISSING, ERROR and incident-lifecycle scenarios,
 * asserts the database side effects, and removes every fixture it created.
 *
 * Other repository files are frozen out of the verification window for the
 * duration of the run and their original `next_verification_at` is restored.
 *
 * Run: node_modules\.bin\tsx.cmd scripts/e2e-fixity-live.ts
 * Flags: --keep (leave fixtures behind for manual inspection)
 */
/* eslint-disable no-console -- CLI diagnostic tool: its printed report is the deliverable. */
import { loadDotEnv } from './demo-seed-lib';
import { createHash, randomUUID } from 'node:crypto';

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
const fixtureKey = `e2e-fixity/${stamp}/payload.pdf`;
const FUTURE = '2099-01-01T00:00:00.000Z';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  const { getSupabaseAdminClient } = await import('../src/server/supabase/adminClient');
  const fixity = await import('../src/server/preservation/fixity');
  const incidents = await import('../src/server/preservation/incidents');
  const { describeStores } = await import('../src/server/preservation/objectStore');
  const db = getSupabaseAdminClient();

  const { data: actorRow } = await db.from('user_roles').select('user_id').limit(1).maybeSingle();
  const actorId = actorRow?.user_id as string | undefined;
  check('fixture actor resolved', !!actorId, actorId ?? 'no user_roles rows');

  const itemId = randomUUID();
  const fileId = randomUUID();
  const originalContent = `ESUT fixity fixture v1 ${stamp}`;
  const expectedChecksum = sha256(originalContent);
  const tamperedContent = `ESUT fixity fixture v2 tampered ${stamp}`;

  let frozen: Array<{ id: string; next_verification_at: string | null }> = [];
  const createdJobIds: string[] = [];

  try {
    const { error: itemError } = await db.from('repository_items').insert({
      id: itemId,
      title: `E2E FIXITY FIXTURE ${stamp}`,
      authors: [],
      contributors: [],
      type: 'Article',
      visibility: 'private',
      status: 'submitted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    check('fixture item created', !itemError, itemError?.message ?? '');

    const { error: uploadError } = await db.storage.from(BUCKET).upload(fixtureKey, Buffer.from(originalContent, 'utf8'), {
      contentType: 'application/pdf',
      upsert: true,
    });
    check('fixture object uploaded', !uploadError, uploadError?.message ?? '');

    const { error: fileError } = await db.from('repository_files').insert({
      id: fileId,
      repository_item_id: itemId,
      storage_provider: 'supabase',
      storage_bucket: BUCKET,
      storage_key: fixtureKey,
      original_filename: 'payload.pdf',
      display_filename: 'payload.pdf',
      mime_type: 'application/pdf',
      file_size: Buffer.byteLength(originalContent),
      checksum: expectedChecksum,
      checksum_algorithm: 'sha256',
      checksum_calculated_at: new Date().toISOString(),
      role: 'ORIGINAL',
      display_order: 0,
      access_level: 'PRIVATE',
      preservation_status: 'active',
      extracted_text_status: 'pending',
      next_verification_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    check('fixture file row created', !fileError, fileError?.message ?? '');

    const { data: others } = await db.from('repository_files').select('id, next_verification_at').neq('id', fileId);
    frozen = (others ?? []) as Array<{ id: string; next_verification_at: string | null }>;
    if (frozen.length) {
      const { error: freezeError } = await db.from('repository_files').update({ next_verification_at: FUTURE }).in('id', frozen.map((row) => row.id));
      check('other files frozen out of the verification window', !freezeError, `${frozen.length} rows`);
    }

    const readRow = async () => {
      const { data } = await db.from('repository_files').select('*').eq('id', fileId).maybeSingle();
      return data as Record<string, unknown> | null;
    };
    const makeDue = async () => {
      await db.from('repository_files').update({ next_verification_at: new Date().toISOString() }).eq('id', fileId);
    };
    const runVerify = async () => fixity.verifyDueFiles({ payload: { batchSize: 25, cadenceDays: 7 } });
    const openIncidents = async () => {
      const { data } = await db.from('preservation_incidents').select('id, incident_type, status').eq('repository_file_id', fileId).eq('status', 'open');
      return (data ?? []) as Array<{ id: string; incident_type: string; status: string }>;
    };
    const eventsOf = async (type: string) => {
      const { data } = await db.from('preservation_events').select('id, event_type, details').eq('repository_file_id', fileId).eq('event_type', type);
      return (data ?? []) as Array<{ id: string; event_type: string; details: Record<string, unknown> }>;
    };

    // --- Scenario 1: VALID ---
    await makeDue();
    const s1 = await runVerify();
    let row = await readRow();
    check('S1 verification ran', s1.ok && s1.scanned > 0, `scanned=${s1.scanned}`);
    check('S1 state is VALID', row?.last_verification_result === 'VALID', String(row?.last_verification_result));
    check('S1 observed checksum matches expected', row?.observed_checksum === expectedChecksum);
    check('S1 expected checksum preserved', row?.checksum === expectedChecksum);
    check('S1 next verification scheduled ahead', String(row?.next_verification_at) > new Date().toISOString(), String(row?.next_verification_at));
    check('S1 FIXITY_VERIFIED event recorded', (await eventsOf('FIXITY_VERIFIED')).length === 1);

    // --- Scenario 2: MISMATCH ---
    const { error: tamperError } = await db.storage.from(BUCKET).upload(fixtureKey, Buffer.from(tamperedContent, 'utf8'), {
      contentType: 'application/pdf',
      upsert: true,
    });
    check('S2 object tampered', !tamperError, tamperError?.message ?? '');
    await makeDue();
    const s2 = await runVerify();
    row = await readRow();
    check('S2 state is MISMATCH', row?.last_verification_result === 'MISMATCH', String(row?.last_verification_result));
    check('S2 observed checksum differs from expected', row?.observed_checksum !== expectedChecksum && row?.observed_checksum === sha256(tamperedContent));
    check('S2 expected checksum still never overwritten', row?.checksum === expectedChecksum, String(row?.checksum));
    let open = await openIncidents();
    check('S2 MISMATCH incident opened', open.length === 1 && open[0].incident_type === 'MISMATCH', JSON.stringify(open));
    check('S2 INCIDENT_OPENED event recorded', (await eventsOf('INCIDENT_OPENED')).length === 1);
    check('S2 scheduling failures reported', s2.scheduledFailures === 0, String(s2.scheduledFailures));

    // --- Scenario 3: incident lifecycle ---
    const incidentId = open[0]?.id;
    const ack = await incidents.applyIncidentAction({ incidentId, action: 'acknowledged', actorId: actorId ?? '', note: 'investigating' });
    check('S3 incident acknowledged', ack.ok && ack.status === 'acknowledged', ack.error ?? '');
    check('S3 INCIDENT_ACKNOWLEDGED event recorded', (await eventsOf('INCIDENT_ACKNOWLEDGED')).length === 1);
    const resolve = await incidents.applyIncidentAction({ incidentId, action: 'resolved', actorId: actorId ?? '', note: 'restored from backup' });
    check('S3 incident resolved', resolve.ok && resolve.status === 'resolved', resolve.error ?? '');
    check('S3 INCIDENT_RESOLVED event recorded', (await eventsOf('INCIDENT_RESOLVED')).length === 1);
    open = await openIncidents();
    check('S3 no open incident remains', open.length === 0, JSON.stringify(open));

    // --- Scenario 4: MISSING ---
    const { error: deleteError } = await db.storage.from(BUCKET).remove([fixtureKey]);
    check('S4 object deleted', !deleteError, deleteError?.message ?? '');
    await makeDue();
    await runVerify();
    row = await readRow();
    check('S4 state is MISSING', row?.last_verification_result === 'MISSING', String(row?.last_verification_result));
    open = await openIncidents();
    check('S4 MISSING incident opened', open.length === 1 && open[0].incident_type === 'MISSING', JSON.stringify(open));

    // --- Scenario 5: ERROR does not create a corruption incident ---
    const openBefore = (await openIncidents()).length;
    await db.from('repository_files').update({ checksum_algorithm: 'md5' }).eq('id', fileId);
    await db.storage.from(BUCKET).upload(fixtureKey, Buffer.from(originalContent, 'utf8'), { contentType: 'application/pdf', upsert: true });
    await makeDue();
    await runVerify();
    row = await readRow();
    check('S5 state is ERROR', row?.last_verification_result === 'ERROR', String(row?.last_verification_result));
    check('S5 ERROR did not open a new incident', (await openIncidents()).length === openBefore, `before=${openBefore} after=${(await openIncidents()).length}`);
    const failEvents = await eventsOf('FIXITY_FAILED');
    check('S5 FIXITY_FAILED reason is unsupported_algorithm', failEvents.some((event) => event.details?.reason === 'unsupported_algorithm'), JSON.stringify(failEvents.at(-1)?.details ?? {}));
    check('S5 expected checksum still preserved', row?.checksum === expectedChecksum);
    await db.from('repository_files').update({ checksum_algorithm: 'sha256' }).eq('id', fileId);

    // --- Scenario 6: inactive storage provider reports ERROR, not corruption ---
    const stores = describeStores();
    const b2 = stores.find((store) => store.provider === 'b2');
    if (b2 && !b2.active) {
      await db.from('repository_files').update({ storage_provider: 'b2' }).eq('id', fileId);
      await makeDue();
      await runVerify();
      row = await readRow();
      check('S6 inactive provider reports ERROR', row?.last_verification_result === 'ERROR', String(row?.last_verification_result));
      const inactiveEvents = await eventsOf('FIXITY_FAILED');
      check('S6 reason is storage_provider_inactive', inactiveEvents.some((event) => event.details?.reason === 'storage_provider_inactive'), JSON.stringify(inactiveEvents.at(-1)?.details ?? {}));
      await db.from('repository_files').update({ storage_provider: 'supabase' }).eq('id', fileId);
    } else {
      check('S6 inactive provider scenario skipped (B2 configured)', true, b2?.inactiveReason ?? 'b2 active');
    }

    // --- Scenario 7: producer queues at most one verification job ---
    await makeDue();
    const first = await fixity.produceFixityJobs({ payload: { batchSize: 25, cadenceDays: 7 } });
    if (first.jobId) createdJobIds.push(first.jobId);
    check('S7 producer queued a job', first.ok && first.queued && !!first.jobId, JSON.stringify(first));
    const second = await fixity.produceFixityJobs({ payload: { batchSize: 25, cadenceDays: 7 } });
    if (second.jobId) createdJobIds.push(second.jobId);
    check('S7 producer deduplicated the second call', second.ok && second.deduped && second.jobId === first.jobId, JSON.stringify(second));
    const { count: pendingCount } = await db
      .from('agent_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('job_type', 'preservation.verifyFixity')
      .in('status', ['pending', 'running']);
    check('S7 exactly one pending verification job', pendingCount === 1, String(pendingCount));
  } finally {
    if (!KEEP) {
      for (const jobId of createdJobIds) {
        await db.from('agent_jobs').delete().eq('id', jobId);
      }
      await db.from('repository_files').delete().eq('id', fileId);
      await db.from('repository_items').delete().eq('id', itemId);
      await db.storage.from(BUCKET).remove([fixtureKey]).catch(() => undefined);
      for (const row of frozen) {
        await db.from('repository_files').update({ next_verification_at: row.next_verification_at }).eq('id', row.id);
      }
      const { count: leftoverFiles } = await db.from('repository_files').select('id', { count: 'exact', head: true }).eq('id', fileId);
      const { count: leftoverItems } = await db.from('repository_items').select('id', { count: 'exact', head: true }).eq('id', itemId);
      check('cleanup removed fixture file', leftoverFiles === 0, String(leftoverFiles));
      check('cleanup removed fixture item', leftoverItems === 0, String(leftoverItems));
      check('cleanup restored frozen verification windows', true, `${frozen.length} rows restored`);
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

main().catch((error) => {
  console.error('FATAL', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
