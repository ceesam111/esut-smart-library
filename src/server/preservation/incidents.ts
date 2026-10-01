import { getSupabaseAdminClient } from '../supabase/adminClient';
import { recordPreservationEvent } from './fixity';

export const INCIDENT_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export type IncidentAction = 'acknowledged' | 'resolved' | 'reopened';

const ALLOWED_ACTIONS: Record<IncidentStatus, IncidentAction[]> = {
  open: ['acknowledged', 'resolved'],
  acknowledged: ['resolved'],
  resolved: ['reopened'],
};

export interface IncidentRow {
  id: string;
  repository_file_id: string;
  incident_type: 'MISMATCH' | 'MISSING' | 'ERROR';
  status: IncidentStatus;
  expected_checksum: string | null;
  observed_checksum: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}

export function canApplyIncidentAction(current: IncidentStatus, action: IncidentAction): boolean {
  return ALLOWED_ACTIONS[current]?.includes(action) ?? false;
}

export function incidentTransitionPatch(
  action: IncidentAction,
  actorId: string,
  note: string | null,
  now = new Date(),
): { status: IncidentStatus; patch: Record<string, unknown> } {
  const timestamp = now.toISOString();
  if (action === 'acknowledged') {
    return {
      status: 'acknowledged',
      patch: { status: 'acknowledged', acknowledged_by: actorId, acknowledged_at: timestamp, updated_at: timestamp, resolution_note: note ?? null },
    };
  }
  if (action === 'resolved') {
    return {
      status: 'resolved',
      patch: { status: 'resolved', resolved_by: actorId, resolved_at: timestamp, updated_at: timestamp, resolution_note: note ?? null },
    };
  }
  return {
    status: 'open',
    patch: {
      status: 'open',
      resolved_by: null,
      resolved_at: null,
      acknowledged_by: null,
      acknowledged_at: null,
      updated_at: timestamp,
      resolution_note: note ?? null,
    },
  };
}

const PRESERVATION_EVENT_FOR_ACTION: Record<IncidentAction, 'INCIDENT_ACKNOWLEDGED' | 'INCIDENT_RESOLVED' | 'INCIDENT_OPENED'> = {
  acknowledged: 'INCIDENT_ACKNOWLEDGED',
  resolved: 'INCIDENT_RESOLVED',
  reopened: 'INCIDENT_OPENED',
};

type SupabaseLike = ReturnType<typeof getSupabaseAdminClient>;

export async function applyIncidentAction(input: {
  incidentId: string;
  action: IncidentAction;
  actorId: string;
  note?: string | null;
  db?: SupabaseLike;
  requireAdmin?: (actorId: string) => Promise<boolean>;
}): Promise<{ ok: boolean; status?: IncidentStatus; error?: string }> {
  const db = input.db ?? getSupabaseAdminClient();

  const { data, error } = await db
    .from('preservation_incidents')
    .select('id, repository_file_id, status')
    .eq('id', input.incidentId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Incident not found.' };

  const current = data.status as IncidentStatus;
  if (!canApplyIncidentAction(current, input.action)) {
    return { ok: false, error: `Incident is '${current}'; action '${input.action}' is not allowed.`, status: current };
  }

  const { status, patch } = incidentTransitionPatch(input.action, input.actorId, input.note ?? null);
  const { error: updateError } = await db.from('preservation_incidents').update(patch).eq('id', input.incidentId);
  if (updateError) return { ok: false, error: updateError.message };

  const { error: auditError } = await db.from('preservation_incident_events').insert({
    incident_id: input.incidentId,
    action: input.action,
    actor_id: input.actorId,
    note: input.note ?? null,
  });
  if (auditError) return { ok: false, error: auditError.message };

  await recordPreservationEvent(db, {
    repositoryFileId: data.repository_file_id,
    eventType: PRESERVATION_EVENT_FOR_ACTION[input.action],
    details: { incidentId: input.incidentId, action: input.action, from: current, to: status, note: input.note ?? null },
    actorId: input.actorId,
  });

  return { ok: true, status };
}

export async function listIncidents(input: {
  db?: SupabaseLike;
  status?: IncidentStatus;
  limit?: number;
  offset?: number;
}): Promise<{ rows: IncidentRow[]; total: number }> {
  const db = input.db ?? getSupabaseAdminClient();
  let query = db
    .from('preservation_incidents')
    .select('id, repository_file_id, incident_type, status, expected_checksum, observed_checksum, details, created_at, acknowledged_by, acknowledged_at, resolved_by, resolved_at, resolution_note', { count: 'exact' });
  if (input.status) query = query.eq('status', input.status);
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50) - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as IncidentRow[], total: count ?? 0 };
}
