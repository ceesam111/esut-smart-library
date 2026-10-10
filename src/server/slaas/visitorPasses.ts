import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { DEFAULT_TENANT_ID } from '@/server/tenant/resolveTenant';
import { hashForStorage, signVisitorPass } from './qr';

export interface VisitorPassResult {
  ok: boolean;
  error: string | null;
  pass: {
    id: string;
    visitorId: string;
    visitorName: string;
    branchId: string;
    validFrom: string;
    validUntil: string;
    status: string;
  } | null;
  credential: string | null;
}

export interface IssuePassInput {
  visitorId: string;
  branchId: string;
  validForMinutes: number;
  issuedBy: string;
  actorRole: string | null;
  tenantId: string;
}

export async function issueVisitorPass(input: IssuePassInput): Promise<VisitorPassResult> {
  const supabase = getSupabaseAdminClient();
  const { data: visitor, error: visitorError } = await supabase
    .from('access_visitors')
    .select('id, full_name, tenant_id')
    .eq('id', input.visitorId)
    .maybeSingle();
  if (visitorError || !visitor) {
    return { ok: false, error: 'VISITOR_NOT_FOUND', pass: null, credential: null };
  }

  const validFrom = new Date();
  const validUntil = new Date(validFrom.getTime() + input.validForMinutes * 60000);
  const credential = signVisitorPass(visitor.id, validFrom, validUntil);
  const { data: pass, error: passError } = await supabase
    .from('access_visitor_passes')
    .insert({
      tenant_id: input.tenantId || visitor.tenant_id || DEFAULT_TENANT_ID,
      visitor_id: visitor.id,
      branch_id: input.branchId,
      secure_token_hash: hashForStorage(credential),
      valid_from: validFrom.toISOString(),
      valid_until: validUntil.toISOString(),
      status: 'active',
      issued_by: input.issuedBy,
    })
    .select('id, visitor_id, branch_id, valid_from, valid_until, status')
    .single();

  if (passError) {
    return { ok: false, error: 'ISSUE_FAILED', pass: null, credential: null };
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: input.issuedBy,
    actorRole: input.actorRole,
    action: 'visitor.pass_issued',
    entityType: 'access_visitor_passes',
    entityId: pass.id,
    afterData: { visitor_id: visitor.id, branch_id: input.branchId, valid_until: validUntil.toISOString() },
    metadata: { source: 'api' },
  });

  return {
    ok: true,
    error: null,
    pass: {
      id: pass.id,
      visitorId: visitor.id,
      visitorName: visitor.full_name,
      branchId: pass.branch_id,
      validFrom: pass.valid_from,
      validUntil: pass.valid_until,
      status: pass.status,
    },
    credential,
  };
}
