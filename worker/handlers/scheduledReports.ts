import { executeScheduledReport } from '@/server/reports/reportScheduler';
import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult } from './utils';

export const scheduledReportWorker: AgentJobHandler = async (job) => {
  requireTenant(job);
  const reportId = typeof job.payload?.reportId === 'string' ? job.payload.reportId : undefined;
  const runId = typeof job.payload?.runId === 'string' ? job.payload.runId : undefined;
  if (!runId) throw new Error('runId is required for reports.scheduledRun.');

  const result = await executeScheduledReport({ reportId, runId });
  if (!result.ok) throw new Error(result.detail);
  return safeResult(result.detail, { rowCount: result.rowCount ?? 0 });
};
