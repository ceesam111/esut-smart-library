import type { AgentJob, HandlerContext } from './types';
import type { WorkerConfig } from './config';
import { getHandler } from './handlers';
import { createAgentRun, finishAgentRun, writeWorkerAudit } from './logger';
import { nextRetryAt, shouldRetry } from './retry';

export class WorkerRunner {
  private active = 0;

  constructor(private supabase: any, private config: WorkerConfig, private signal: AbortSignal, private onStats?: (event: 'processed' | 'failed' | 'active', value: number) => void) {}

  get activeCount() {
    return this.active;
  }

  async pollOnce() {
    const available = Math.max(0, this.config.concurrency - this.active);
    if (available === 0) return 0;
    const { data, error } = await this.supabase.rpc('claim_agent_jobs', { _worker_id: this.config.workerId, _limit: available, _lock_timeout_minutes: this.config.lockTimeoutMinutes });
    if (error) throw new Error(error.message);
    const jobs = (data ?? []) as AgentJob[];
    await Promise.all(jobs.map((job) => this.runJob(job)));
    return jobs.length;
  }

  private async runJob(job: AgentJob) {
    this.active += 1;
    this.onStats?.('active', this.active);
    let agentRunId: string | null = null;
    try {
      if (!job.tenant_id) throw new Error('tenant_id is required.');
      const handler = getHandler(job.job_type);
      if (!handler) throw new Error(`No handler registered for ${job.job_type}.`);
      agentRunId = await createAgentRun(this.supabase, job);
      await writeWorkerAudit(this.supabase, job, 'agent_job_started', { jobType: job.job_type, agentName: job.agent_name, attempt: job.attempts });
      const result = await handler(job, this.context());
      await this.supabase.from('agent_jobs').update({ status: 'completed', result: result.data, error: null, finished_at: new Date().toISOString(), locked_at: null, locked_by: null }).eq('id', job.id).eq('locked_by', this.config.workerId);
      if (agentRunId) await finishAgentRun(this.supabase, agentRunId, 'completed', result.data);
      await writeWorkerAudit(this.supabase, job, 'agent_job_completed', { jobType: job.job_type, result: result.data });
      this.onStats?.('processed', 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected worker error';
      const retry = shouldRetry(job.attempts, job.max_attempts);
      await this.supabase.from('agent_jobs').update({
        status: retry ? 'pending' : 'failed',
        error: message,
        run_after: retry ? nextRetryAt(job.attempts) : job.run_after,
        finished_at: retry ? null : new Date().toISOString(),
        locked_at: null,
        locked_by: null,
      }).eq('id', job.id).eq('locked_by', this.config.workerId);
      if (agentRunId) await finishAgentRun(this.supabase, agentRunId, 'failed', {}, message);
      await writeWorkerAudit(this.supabase, job, retry ? 'agent_job_retry_scheduled' : 'agent_job_failed', { jobType: job.job_type, error: message, attempt: job.attempts, maxAttempts: job.max_attempts });
      this.onStats?.('failed', 1);
    } finally {
      this.active -= 1;
      this.onStats?.('active', this.active);
    }
  }

  private context(): HandlerContext {
    return { supabase: this.supabase, workerId: this.config.workerId, signal: this.signal };
  }
}
