import { setTimeout as sleep } from 'node:timers/promises';
import { loadWorkerConfig } from './config';
import { createWorkerSupabase } from './supabase';
import { startHealthServer, type WorkerHealthState } from './health';
import { WorkerRunner } from './runner';
import { enqueueDueSchedules } from './scheduler';

const config = loadWorkerConfig();
const controller = new AbortController();
const state: WorkerHealthState = { startedAt: new Date().toISOString(), workerId: config.workerId, processed: 0, failed: 0, active: 0, lastPollAt: null, shuttingDown: false };
const server = startHealthServer(config.healthPort, state);
const supabase = createWorkerSupabase(config);
const runner = new WorkerRunner(supabase, config, controller.signal, (event, value) => {
  if (event === 'processed') state.processed += value;
  if (event === 'failed') state.failed += value;
  if (event === 'active') state.active = value;
});
let lastSchedulerAt = 0;

function shutdown(signal: string) {
  console.log(`[worker] ${signal} received; shutting down after active jobs finish.`);
  state.shuttingDown = true;
  controller.abort();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log(`[worker] started ${config.workerId}; concurrency=${config.concurrency}; poll=${config.pollIntervalMs}ms; health=:${config.healthPort}/health`);

while (!state.shuttingDown) {
  state.lastPollAt = new Date().toISOString();
  try {
    if (Date.now() - lastSchedulerAt >= config.schedulerIntervalMs) {
      lastSchedulerAt = Date.now();
      await enqueueDueSchedules(supabase, config);
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
console.log('[worker] stopped');
