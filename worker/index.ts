import { setTimeout as sleep } from 'node:timers/promises';
import { loadWorkerConfig } from './config';
import { createWorkerSupabase } from './supabase';
import { startHealthServer, type WorkerHealthState } from './health';
import { WorkerRunner } from './runner';
import { enqueueDueSchedules } from './scheduler';
import { enqueueDueScheduledReports } from '@/server/reports/reportScheduler';

const config = loadWorkerConfig();
const controller = new AbortController();
const state: WorkerHealthState = { startedAt: new Date().toISOString(), workerId: config.workerId, processed: 0, failed: 0, active: 0, lastPollAt: null, shuttingDown: false, byType: {}, preservation: { pendingJobs: 0, lastProducerRunAt: null, lastVerifyRunAt: null }, extraction: { pending: 0, processing: 0, complete: 0, failed: 0, notSupported: 0, noTextLayer: 0, blockedExternal: 0, lastRunAt: null }, searchIndex: { pendingReindexJobs: 0, documents: 0, lastReindexAt: null } };
const server = startHealthServer(config.healthPort, state);
const supabase = createWorkerSupabase(config);
const runner = new WorkerRunner(supabase, config, controller.signal, (event, value) => {
  if (event === 'processed') state.processed += value;
  if (event === 'failed') state.failed += value;
  if (event === 'active') state.active = value;
}, (jobType, outcome) => {
  const bucket = state.byType[jobType] ?? { processed: 0, failed: 0, lastRunAt: null };
  if (outcome === 'processed') bucket.processed += 1;
  else bucket.failed += 1;
  bucket.lastRunAt = new Date().toISOString();
  state.byType[jobType] = bucket;
  if (jobType.startsWith('preservation.')) {
    state.preservation.lastVerifyRunAt = new Date().toISOString();
    if (jobType === 'preservation.fixityProducer') state.preservation.lastProducerRunAt = bucket.lastRunAt;
  }
  if (jobType === 'repository.extractText') {
    state.extraction.lastRunAt = new Date().toISOString();
  }
  if (jobType === 'search.reindex') {
    state.searchIndex.lastReindexAt = new Date().toISOString();
  }
});

async function refreshPreservationStats() {
  try {
    const { count, error } = await supabase
      .from('agent_jobs')
      .select('id', { count: 'exact', head: true })
      .like('job_type', 'preservation.%')
      .in('status', ['pending', 'running']);
    if (!error) state.preservation.pendingJobs = count ?? 0;
  } catch {
    // Health reporting must never take the worker down.
  }
}

async function refreshExtractionStats() {
  try {
    const { data, error } = await supabase
      .from('repository_files')
      .select('extracted_text_status')
      .limit(10000);
    if (error) return;
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const status = row.extracted_text_status ?? 'pending';
      counts[status] = (counts[status] ?? 0) + 1;
    }
    state.extraction.pending = counts['PENDING'] ?? 0;
    state.extraction.processing = counts['PROCESSING'] ?? 0;
    state.extraction.complete = counts['COMPLETE'] ?? 0;
    state.extraction.failed = counts['FAILED'] ?? 0;
    state.extraction.notSupported = counts['NOT_SUPPORTED'] ?? 0;
    state.extraction.noTextLayer = counts['NO_TEXT_LAYER'] ?? 0;
    state.extraction.blockedExternal = counts['BLOCKED_EXTERNAL'] ?? 0;
  } catch {
    // Health reporting must never take the worker down.
  }
}

async function refreshSearchIndexStats() {
  try {
    const { count, error } = await supabase
      .from('agent_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('job_type', 'search.reindex')
      .eq('status', 'pending');
    if (!error) state.searchIndex.pendingReindexJobs = count ?? 0;

    const { count: documents, error: docError } = await supabase
      .from('repository_search_documents')
      .select('id', { count: 'exact', head: true });
    if (!docError) state.searchIndex.documents = documents ?? 0;
  } catch {
    // Health reporting must never take the worker down.
  }
}
let lastSchedulerAt = 0;

function shutdown(signal: string) {
  console.warn(`[worker] ${signal} received; shutting down after active jobs finish.`);
  state.shuttingDown = true;
  controller.abort();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.warn(`[worker] started ${config.workerId}; concurrency=${config.concurrency}; poll=${config.pollIntervalMs}ms; health=:${config.healthPort}/health`);

while (!state.shuttingDown) {
  state.lastPollAt = new Date().toISOString();
  try {
    if (Date.now() - lastSchedulerAt >= config.schedulerIntervalMs) {
      lastSchedulerAt = Date.now();
      await enqueueDueSchedules(supabase, config);
      await enqueueDueScheduledReports(supabase);
      await refreshPreservationStats();
      await refreshExtractionStats();
      await refreshSearchIndexStats();
    }
    await runner.pollOnce();
  } catch (error) {
    console.error('[worker] poll failed', error instanceof Error ? error.message : error);
  }
  await sleep(config.pollIntervalMs, undefined, { signal: controller.signal }).catch(() => undefined);
}

while (runner.activeCount > 0) {
  await sleep(250).catch(() => undefined);
}

server.close();
console.warn('[worker] stopped');
