import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult } from './utils';
import { produceFixityJobs, verifyDueFiles } from '../../src/server/preservation/fixity';

export const produceFixity: AgentJobHandler = async (job) => {
  requireTenant(job);
  const result = await produceFixityJobs({ payload: job.payload ?? {} });
  if (!result.ok) throw new Error(result.error ?? 'Fixity producer failed.');
  return safeResult(result.queued ? 'Fixity verification queued.' : 'Fixity scheduling completed without queueing work.', {
    candidates: result.candidates,
    queued: result.queued,
    deduped: result.deduped,
    jobId: result.jobId,
    reason: result.reason ?? null,
  });
};

export const verifyFixity: AgentJobHandler = async (job) => {
  requireTenant(job);
  const summary = await verifyDueFiles({ payload: job.payload ?? {} });
  if (!summary.ok) throw new Error(summary.error ?? 'Fixity verification failed.');
  return safeResult('Fixity verification completed.', {
    scanned: summary.scanned,
    valid: summary.valid,
    mismatch: summary.mismatch,
    missing: summary.missing,
    errored: summary.errored,
    incidentsOpened: summary.incidentsOpened,
    scheduledFailures: summary.scheduledFailures,
    results: summary.results,
  });
};
