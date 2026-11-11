import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult } from './utils';
import { produceFixityJobs, verifyDueFiles } from '../../src/server/preservation/fixity';
import { checkBackupBuckets } from '../../src/server/preservation/backups';
import { reviewRetention } from '../../src/server/preservation/retention';

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

export const backupMonitor: AgentJobHandler = async (job) => {
  requireTenant(job);
  const result = await checkBackupBuckets({ payload: job.payload ?? {} });
  if (!result.ok) throw new Error(result.error ?? 'Backup monitoring failed.');
  return safeResult('Backup monitoring completed.', {
    recorded: result.recorded,
    checks: result.results.map((check) => ({
      bucket: check.bucket,
      prefix: check.prefix,
      status: check.status,
      objectCount: check.objectCount,
      totalBytes: check.totalBytes,
      latestObjectAt: check.latestObjectAt,
      error: check.error ?? null,
    })),
  });
};

export const retentionReview: AgentJobHandler = async (job) => {
  requireTenant(job);
  const result = await reviewRetention({ payload: job.payload ?? {} });
  if (!result.ok) throw new Error(result.error ?? 'Retention review failed.');
  return safeResult('Retention review completed.', {
    policiesReviewed: result.policiesReviewed,
    candidates: result.candidates,
    flagged: result.flagged,
    eventsWritten: result.eventsWritten,
  });
};
