import { createHash } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult, textPayload } from './utils';
import { runExternalResourceDiscovery } from '../../src/server/resources/discovery';

function canDownload(rights: unknown) {
  return rights === 'open' || rights === 'public_domain';
}

function safePath(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'resource';
}

export const harvestResources: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const query = textPayload(job, 'query');
  if (!query) throw new Error('resources.harvest requires payload.query.');
  const sourceTypes = Array.isArray(job.payload.sourceTypes) ? job.payload.sourceTypes.map(String) : undefined;
  const limitPerSource = Number.isFinite(Number(job.payload.limitPerSource)) ? Number(job.payload.limitPerSource) : 5;
  const result = await runExternalResourceDiscovery({
    tenantId: job.tenant_id,
    query,
    userId: job.created_by,
    triggerType: 'scheduled',
    sourceTypes,
    limitPerSource,
  });
  return safeResult('Resource harvest completed and candidates staged for review.', { query, ...result });
};

export const downloadResourceToB2: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  if (job.payload?.seeded) return safeResult('Skipped seeded demo job', { skipped: true });
  const candidateId = textPayload(job, 'candidateId');
  if (!candidateId) throw new Error('resources.downloadToB2 requires payload.candidateId.');
  const { data: candidate, error } = await supabase.from('resource_candidates').select('*').eq('tenant_id', job.tenant_id).eq('id', candidateId).single();
  if (error) throw new Error(error.message);
  if (!canDownload(candidate.rights_status)) return safeResult('Rights are not clear; download skipped.', { candidateId, rightsStatus: candidate.rights_status, skipped: true });
  if (!candidate.download_url) return safeResult('No download URL supplied; download skipped.', { candidateId, skipped: true });

  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;
  const bucket = process.env.B2_BUCKET_LIBRARY_FILES;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) throw new Error('Missing B2 environment variables.');

  const response = await fetch(candidate.download_url);
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const body = Buffer.from(await response.arrayBuffer());
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);
  const filename = `${safePath(candidate.source_record_id || candidate.id)}-${hash}.pdf`;
  const key = `tenants/${job.tenant_id}/resources/${safePath(candidate.source_name)}/${candidate.year || new Date().getFullYear()}/${safePath(candidate.source_record_id || candidate.id)}/${filename}`;
  const client = new S3Client({ endpoint, region, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, Metadata: { candidate_id: candidate.id, source_name: candidate.source_name } }));
  const { error: updateError } = await supabase.from('resource_candidates').update({ b2_object_key: key }).eq('id', candidate.id);
  if (updateError) throw new Error(updateError.message);
  return safeResult('Legal resource file stored in B2.', { candidateId, b2ObjectKey: key, bytes: body.length });
};
