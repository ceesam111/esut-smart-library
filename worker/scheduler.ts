import type { WorkerConfig } from './config';

interface AgentSchedule {
  id: string;
  tenant_id: string;
  label: string;
  agent_name: string;
  job_type: string;
  payload: Record<string, unknown>;
  priority: number;
  interval_minutes: number;
}

export async function enqueueDueSchedules(supabase: any, config: WorkerConfig) {
  if (!config.schedulerEnabled) return 0;
  const { data, error } = await supabase
    .from('agent_schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .limit(20);
  if (error) {
    if (/Could not find the table|schema cache|does not exist|PGRST20|42P01/i.test(error.message)) return 0;
    throw new Error(error.message);
  }

  let queued = 0;
  for (const schedule of (data ?? []) as AgentSchedule[]) {
    const nextRun = new Date(Date.now() + Math.max(1, schedule.interval_minutes) * 60 * 1000).toISOString();
    const payload = { ...(schedule.payload ?? {}), scheduleId: schedule.id, scheduleLabel: schedule.label, scheduledBy: config.workerId };
    const { error: insertError } = await supabase.from('agent_jobs').insert({
      tenant_id: schedule.tenant_id,
      job_type: schedule.job_type,
      agent_name: schedule.agent_name,
      payload,
      priority: schedule.priority,
      run_after: new Date().toISOString(),
    });
    if (!insertError) queued += 1;
    await supabase.from('agent_schedules').update({ last_run_at: new Date().toISOString(), next_run_at: nextRun }).eq('id', schedule.id);
  }
  return queued;
}
