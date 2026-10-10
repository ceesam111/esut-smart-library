import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { generateStaticCredential, hashForStorage } from '@/server/slaas/qr';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { resolveTenant } from '@/server/tenant/resolveTenant';

const Body = z.object({ patronId: z.string().uuid() });
type BodyType = z.infer<typeof Body>;

const RevokeBody = z.object({
  identityId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
type RevokeBodyType = z.infer<typeof RevokeBody>;

export const PATCH = withHandler<RevokeBodyType>({
  bodySchema: RevokeBody,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    const { data: existing } = await supabase
      .from('library_access_identities')
      .select('id, status, patron_id')
      .eq('id', body.identityId)
      .maybeSingle();
    if (!existing) return { data: { ok: false, error: 'IDENTITY_NOT_FOUND' }, status: 404 };
    if (existing.status === 'revoked') return { data: { ok: true, alreadyRevoked: true, identityId: existing.id } };

    const { error } = await supabase
      .from('library_access_identities')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', body.identityId);
    if (error) throw new Error(error.message);

    await writeAuditLog({
      tenantId: tenant.tenantId,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: 'access.identity_revoked',
      entityType: 'library_access_identities',
      entityId: existing.id,
      beforeData: { status: existing.status },
      afterData: { status: 'revoked' },
      metadata: { reason: body.reason ?? null, patron_id: existing.patron_id },
    });

    return { data: { ok: true, identityId: existing.id }, status: 200 };
  },
});

export const POST = withHandler<BodyType>({
  bodySchema: Body,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    const { data: active } = await supabase
      .from('library_access_identities')
      .select('id')
      .eq('patron_id', body.patronId)
      .eq('status', 'active')
      .maybeSingle();

    let identityId: string;
    if (active) {
      identityId = active.id;
    } else {
      const { data: created, error } = await supabase
        .from('library_access_identities')
        .insert({
          tenant_id: tenant.tenantId,
          patron_id: body.patronId,
          secure_token_hash: 'pending',
          status: 'active',
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      identityId = created.id;
    }

    const credential = generateStaticCredential(identityId);
    const { error: updateError } = await supabase
      .from('library_access_identities')
      .update({ secure_token_hash: hashForStorage(credential), issued_at: new Date().toISOString() })
      .eq('id', identityId);
    if (updateError) throw new Error(updateError.message);

    await writeAuditLog({
      tenantId: tenant.tenantId,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: 'access.identity_issued',
      entityType: 'library_access_identities',
      entityId: identityId,
      afterData: { patron_id: body.patronId },
      metadata: { source: 'api' },
    });

    return { data: { identityId, credential }, status: 201 };
  },
});
