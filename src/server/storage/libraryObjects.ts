import { z } from 'zod';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { getUserRoles } from '@/server/auth/requireRole';
import { hasAnyRole, LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import {
  getSignedDownloadUrl,
  getSignedUploadUrl,
  resolveBucketName,
  tenantCatalogueKey,
  tenantExportKey,
  tenantRepositoryKey,
  type B2BucketKind,
} from './b2Client';

const signedUploadSchema = z.object({
  area: z.enum(['repository', 'catalogue', 'exports']),
  filename: z.string().min(1),
  contentType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  checksum: z.string().nullable().optional(),
  visibility: z.enum(['private', 'tenant', 'public']).default('private'),
  linkedEntityType: z.string().nullable().optional(),
  linkedEntityId: z.string().uuid().nullable().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  recordId: z.string().optional(),
});

function bucketKindForArea(area: 'repository' | 'catalogue' | 'exports'): B2BucketKind {
  return area === 'exports' ? 'exports' : 'libraryFiles';
}

function keyForArea(input: z.infer<typeof signedUploadSchema> & { tenantId: string }) {
  if (input.area === 'repository') {
    return tenantRepositoryKey({ tenantId: input.tenantId, year: input.year ?? new Date().getFullYear(), recordId: input.recordId || input.linkedEntityId || crypto.randomUUID(), filename: input.filename });
  }
  if (input.area === 'catalogue') {
    return tenantCatalogueKey({ tenantId: input.tenantId, resourceId: input.recordId || input.linkedEntityId || crypto.randomUUID(), filename: input.filename });
  }
  return tenantExportKey({ tenantId: input.tenantId, date: new Date().toISOString().slice(0, 10), filename: input.filename });
}

export async function createSignedLibraryUpload(input: unknown, actorUserId: string) {
  const roles = await getUserRoles(actorUserId);
  if (!hasAnyRole(roles, LIBRARY_ADMIN_ROLES)) throw new Error('Forbidden.');

  const parsed = signedUploadSchema.parse(input);
  const tenant = await resolveTenant(actorUserId);
  const bucketKind = bucketKindForArea(parsed.area);
  const bucket = resolveBucketName(bucketKind);
  const objectKey = keyForArea({ ...parsed, tenantId: tenant.tenantId });
  const uploadUrl = await getSignedUploadUrl({ bucket, key: objectKey, contentType: parsed.contentType, expiresIn: 900 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('library_objects')
    .insert({
      tenant_id: tenant.tenantId,
      bucket,
      object_key: objectKey,
      original_filename: parsed.filename,
      content_type: parsed.contentType ?? null,
      size_bytes: parsed.sizeBytes ?? null,
      checksum: parsed.checksum ?? null,
      visibility: parsed.visibility,
      linked_entity_type: parsed.linkedEntityType ?? null,
      linked_entity_id: parsed.linkedEntityId ?? null,
      uploaded_by: actorUserId,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: tenant.tenantId,
    actorUserId,
    actorRole: roles[0] ?? null,
    action: 'b2_signed_upload_created',
    entityType: 'library_objects',
    entityId: data.id,
    afterData: data,
    metadata: { area: parsed.area, bucket, objectKey },
  });

  return { uploadUrl, object: data };
}

export async function createSignedLibraryDownload(objectId: string, actorUserId: string) {
  const tenant = await resolveTenant(actorUserId);
  const roles = await getUserRoles(actorUserId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('library_objects').select('*').eq('id', objectId).single();
  if (error) throw new Error(error.message);
  if (data.tenant_id !== tenant.tenantId) throw new Error('Forbidden.');
  if (data.visibility === 'private' && data.uploaded_by !== actorUserId && !hasAnyRole(roles, LIBRARY_ADMIN_ROLES)) throw new Error('Forbidden.');

  const downloadUrl = await getSignedDownloadUrl({ bucket: data.bucket, key: data.object_key, expiresIn: 900 });
  await writeAuditLog({
    tenantId: tenant.tenantId,
    actorUserId,
    actorRole: roles[0] ?? null,
    action: 'b2_signed_download_created',
    entityType: 'library_objects',
    entityId: data.id,
    metadata: { bucket: data.bucket, objectKey: data.object_key },
  });
  return { downloadUrl, object: data };
}
