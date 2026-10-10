import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { captureEvent } from '@/server/analytics/eventCapture';
import { DEFAULT_TENANT_ID } from '@/server/tenant/resolveTenant';
import { computeOccupancy, type OccupancySnapshot } from './occupancy';
import { decideScan, type ScanMode, type VisitState } from './visitState';
import { hashForStorage, verifyCredential, type QrClaims } from './qr';

export interface BranchRecord {
  id: string;
  code: string;
  name: string;
  capacity: number;
  capacity_mode: 'informational' | 'warning' | 'enforced';
  warn_threshold_pct: number;
  active: boolean;
  tenant_id: string;
}

export interface AccessIdentityRecord {
  id: string;
  patron_id: string;
  secure_token_hash: string;
  status: 'active' | 'revoked' | 'expired';
  tenant_id: string;
}

export interface PatronSummary {
  id: string;
  full_name: string;
  patron_category: string;
  faculty_code: string | null;
  department: string | null;
  status: string;
}

export type ScanErrorCode =
  | 'DUPLICATE'
  | 'INVALID_QR'
  | 'EXPIRED_QR'
  | 'REVOKED_QR'
  | 'USER_NOT_FOUND'
  | 'INACTIVE_ACCOUNT'
  | 'ACCESS_DENIED'
  | 'ALREADY_INSIDE'
  | 'NOT_CURRENTLY_INSIDE'
  | 'BRANCH_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'SYSTEM_ERROR';

export interface ScanResult {
  ok: boolean;
  event: 'CHECK_IN' | 'CHECK_OUT' | 'DUPLICATE' | 'DENIED' | null;
  errorCode: ScanErrorCode | null;
  visit: {
    id: string;
    status: string;
    checked_in_at: string;
    checked_out_at: string | null;
    duration_minutes: number | null;
  } | null;
  identity: {
    id: string;
    patronId: string;
    fullName: string;
    patronCategory: string;
    department: string | null;
    facultyCode: string | null;
  } | null;
  occupancy: OccupancySnapshot | null;
  timestamp: string;
}

export async function getActiveIdentityByToken(token: string): Promise<AccessIdentityRecord | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('library_access_identities')
    .select('id, patron_id, secure_token_hash, status, tenant_id')
    .eq('secure_token_hash', hashForStorage(token))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AccessIdentityRecord | null;
}

export async function getPatronSummary(patronId: string): Promise<PatronSummary | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('patrons')
    .select('id, full_name, patron_category, faculty_code, department, status')
    .eq('id', patronId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PatronSummary | null;
}

export async function getBranchById(branchId: string): Promise<BranchRecord | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('library_branches')
    .select('id, code, name, capacity, capacity_mode, warn_threshold_pct, active, tenant_id')
    .eq('id', branchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BranchRecord | null;
}

export async function getCurrentOccupancy(branchId: string): Promise<OccupancySnapshot> {
  const supabase = getSupabaseAdminClient();
  const [{ count, error: countError }, branch] = await Promise.all([
    supabase
      .from('access_visits')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('status', 'checked_in'),
    getBranchById(branchId),
  ]);
  if (countError) throw new Error(countError.message);
  return computeOccupancy(
    count ?? 0,
    branch?.capacity ?? 0,
    branch?.capacity_mode ?? 'informational',
    branch?.warn_threshold_pct ?? 80,
    branchId,
  );
}

export async function getOpenVisit(identityId: string): Promise<{ id: string; checked_in_at: string } | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('access_visits')
    .select('id, checked_in_at')
    .eq('access_identity_id', identityId)
    .eq('status', 'checked_in')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; checked_in_at: string } | null;
}

export async function getLastAccessEvent(identityId: string): Promise<{ created_at: string } | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('access_events')
    .select('created_at')
    .eq('access_identity_id', identityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { created_at: string } | null;
}

export interface ProcessScanInput {
  token: string;
  branchId: string;
  mode: ScanMode;
  idempotencyKey: string;
  operatorUserId: string;
  actorRole: string | null;
  workstationId?: string | null;
  nowMs?: number;
}

export async function processScan(input: ProcessScanInput): Promise<ScanResult> {
  const now = input.nowMs ?? Date.now();
  const nowIso = new Date(now).toISOString();

  const branch = await getBranchById(input.branchId);
  if (!branch || !branch.active) {
    return {
      ok: false, event: 'DENIED', errorCode: 'BRANCH_NOT_FOUND',
      visit: null, identity: null, occupancy: null, timestamp: nowIso,
    };
  }

  const verification = verifyCredential(input.token, Math.floor(now / 1000));
  if (!verification.ok) {
    const code: ScanErrorCode =
      verification.reason === 'expired' ? 'EXPIRED_QR'
      : verification.reason === 'bad_signature' || verification.reason === 'wrong_version' || verification.reason === 'wrong_audience' ? 'INVALID_QR'
      : 'INVALID_QR';
    return {
      ok: false, event: 'DENIED', errorCode: code,
      visit: null, identity: null, occupancy: null, timestamp: nowIso,
    };
  }

  const claims: QrClaims = verification.claims;
  const identity = await getActiveIdentityByToken(input.token);
  if (!identity || identity.id !== claims.sub) {
    return {
      ok: false, event: 'DENIED', errorCode: 'INVALID_QR',
      visit: null, identity: null, occupancy: null, timestamp: nowIso,
    };
  }
  if (identity.status === 'revoked') {
    return {
      ok: false, event: 'DENIED', errorCode: 'REVOKED_QR',
      visit: null, identity: null, occupancy: null, timestamp: nowIso,
    };
  }

  const patron = await getPatronSummary(identity.patron_id);
  if (!patron) {
    return {
      ok: false, event: 'DENIED', errorCode: 'USER_NOT_FOUND',
      visit: null, identity: null, occupancy: null, timestamp: nowIso,
    };
  }
  if (patron.status !== 'active') {
    return {
      ok: false, event: 'DENIED', errorCode: 'INACTIVE_ACCOUNT',
      visit: null, identity: null, occupancy: null, timestamp: nowIso,
    };
  }

  const openVisit = await getOpenVisit(identity.id);
  const currentState: VisitState = openVisit ? 'INSIDE' : 'OUTSIDE';
  const lastEvent = await getLastAccessEvent(identity.id);
  const lastEventAtMs = lastEvent ? new Date(lastEvent.created_at).getTime() : null;

  const decision = decideScan({
    currentState,
    mode: input.mode,
    debounceMs: 5000,
    lastEventAtMs,
    nowMs: now,
  });

  const supabase = getSupabaseAdminClient();

  if (decision.action === 'DUPLICATE') {
    await recordAccessEvent(supabase, {
      tenantId: branch.tenant_id, identityId: identity.id, visitId: openVisit?.id ?? null,
      patronId: identity.patron_id, branchId: branch.id, eventType: 'DUPLICATE_SCAN',
      eventSource: 'qr', metadata: { reason: decision.reason }, nowIso,
    });
    const occupancy = await getCurrentOccupancy(branch.id);
    return {
      ok: false, event: 'DUPLICATE', errorCode: 'DUPLICATE',
      visit: openVisit ? { id: openVisit.id, status: 'checked_in', checked_in_at: openVisit.checked_in_at, checked_out_at: null, duration_minutes: null } : null,
      identity: toIdentitySummary(identity, patron), occupancy, timestamp: nowIso,
    };
  }

  if (decision.action === 'DENIED') {
    await recordAccessEvent(supabase, {
      tenantId: branch.tenant_id, identityId: identity.id, visitId: null,
      patronId: identity.patron_id, branchId: branch.id, eventType: 'DENIED',
      eventSource: 'qr', metadata: { reason: decision.reason }, nowIso,
    });
    const occupancy = await getCurrentOccupancy(branch.id);
    const code: ScanErrorCode = decision.reason === 'not_currently_inside' ? 'NOT_CURRENTLY_INSIDE' : 'ACCESS_DENIED';
    return {
      ok: false, event: 'DENIED', errorCode: code,
      visit: null, identity: toIdentitySummary(identity, patron), occupancy, timestamp: nowIso,
    };
  }

  if (decision.action === 'CHECK_IN') {
    const { data: inserted, error: insertError } = await supabase
      .from('access_visits')
      .insert({
        tenant_id: branch.tenant_id, access_identity_id: identity.id, branch_id: branch.id,
        patron_id: identity.patron_id, status: 'checked_in', entry_method: 'qr',
        checked_in_at: nowIso, academic_session: null, semester: null, is_observed: true,
      })
      .select('id, status, checked_in_at, checked_out_at, duration_minutes')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const occ = await getCurrentOccupancy(branch.id);
        const currentOpen = await getOpenVisit(identity.id);
        return {
          ok: false, event: 'DUPLICATE', errorCode: 'DUPLICATE',
          visit: currentOpen ? { id: currentOpen.id, status: 'checked_in', checked_in_at: currentOpen.checked_in_at, checked_out_at: null, duration_minutes: null } : null,
          identity: toIdentitySummary(identity, patron), occupancy: occ, timestamp: nowIso,
        };
      }
      throw new Error(insertError.message);
    }

    await recordAccessEvent(supabase, {
      tenantId: branch.tenant_id, identityId: identity.id, visitId: inserted.id,
      patronId: identity.patron_id, branchId: branch.id, eventType: 'CHECK_IN',
      eventSource: 'qr', metadata: {}, nowIso,
    });
    await writeAuditLog({
      tenantId: branch.tenant_id, actorUserId: input.operatorUserId, actorRole: input.actorRole,
      action: 'access.check_in', entityType: 'access_visits', entityId: inserted.id,
      afterData: { branch_id: branch.id, checked_in_at: nowIso }, metadata: { source: 'qr' },
    });
    const occupancy = await getCurrentOccupancy(branch.id);
    await captureEvent({
      event_type: 'library_visit', user_id: identity.patron_id, event_category: 'ACCESS',
      entity_type: 'access_visit', entity_id: inserted.id, metadata: { branch_id: branch.id, action: 'check_in' },
    });
    return {
      ok: true, event: 'CHECK_IN', errorCode: null,
      visit: { id: inserted.id, status: inserted.status, checked_in_at: inserted.checked_in_at, checked_out_at: null, duration_minutes: null },
      identity: toIdentitySummary(identity, patron), occupancy, timestamp: nowIso,
    };
  }

  if (decision.action === 'CHECK_OUT') {
    if (!openVisit) {
      const occ = await getCurrentOccupancy(branch.id);
      return {
        ok: false, event: 'DENIED', errorCode: 'NOT_CURRENTLY_INSIDE',
        visit: null, identity: toIdentitySummary(identity, patron), occupancy: occ, timestamp: nowIso,
      };
    }
    const durationMinutes = Math.max(0, Math.round((now - new Date(openVisit.checked_in_at).getTime()) / 60000));
    const { data: updated, error: updateError } = await supabase
      .from('access_visits')
      .update({ status: 'checked_out', checked_out_at: nowIso, exit_method: 'qr', duration_minutes: durationMinutes })
      .eq('id', openVisit.id)
      .eq('status', 'checked_in')
      .select('id, status, checked_in_at, checked_out_at, duration_minutes')
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        const occ = await getCurrentOccupancy(branch.id);
        return {
          ok: false, event: 'DUPLICATE', errorCode: 'DUPLICATE',
          visit: null, identity: toIdentitySummary(identity, patron), occupancy: occ, timestamp: nowIso,
        };
      }
      throw new Error(updateError.message);
    }

    await recordAccessEvent(supabase, {
      tenantId: branch.tenant_id, identityId: identity.id, visitId: updated.id,
      patronId: identity.patron_id, branchId: branch.id, eventType: 'CHECK_OUT',
      eventSource: 'qr', metadata: { duration_minutes: durationMinutes }, nowIso,
    });
    await writeAuditLog({
      tenantId: branch.tenant_id, actorUserId: input.operatorUserId, actorRole: input.actorRole,
      action: 'access.check_out', entityType: 'access_visits', entityId: updated.id,
      afterData: { checked_out_at: nowIso, duration_minutes: durationMinutes }, metadata: { source: 'qr' },
    });
    const occupancy = await getCurrentOccupancy(branch.id);
    return {
      ok: true, event: 'CHECK_OUT', errorCode: null,
      visit: { id: updated.id, status: updated.status, checked_in_at: updated.checked_in_at, checked_out_at: updated.checked_out_at, duration_minutes: updated.duration_minutes },
      identity: toIdentitySummary(identity, patron), occupancy, timestamp: nowIso,
    };
  }

  return {
    ok: false, event: 'DENIED', errorCode: 'SYSTEM_ERROR',
    visit: null, identity: null, occupancy: null, timestamp: nowIso,
  };
}

function toIdentitySummary(identity: AccessIdentityRecord, patron: PatronSummary) {
  return {
    id: identity.id,
    patronId: identity.patron_id,
    fullName: patron.full_name,
    patronCategory: patron.patron_category,
    department: patron.department,
    facultyCode: patron.faculty_code,
  };
}

async function recordAccessEvent(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  e: {
    tenantId: string; identityId: string | null; visitId: string | null; patronId: string | null;
    visitorId?: string | null; branchId: string | null;
    eventType: string; eventSource: string; metadata: Record<string, unknown>; nowIso: string;
  },
): Promise<void> {
  await supabase.from('access_events').insert({
    tenant_id: e.tenantId || DEFAULT_TENANT_ID, access_identity_id: e.identityId, visit_id: e.visitId,
    patron_id: e.patronId, visitor_id: e.visitorId ?? null, branch_id: e.branchId,
    event_type: e.eventType, event_source: e.eventSource, metadata: e.metadata,
  });
}
