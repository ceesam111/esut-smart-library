export interface AgentJob {
  id: string;
  tenant_id: string;
  job_type: string;
  agent_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_at: string | null;
  locked_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HandlerContext {
  supabase: any;
  workerId: string;
  signal: AbortSignal;
}

export interface HandlerResult {
  ok: true;
  data: Record<string, unknown>;
}

export type AgentJobHandler = (job: AgentJob, context: HandlerContext) => Promise<HandlerResult>;
