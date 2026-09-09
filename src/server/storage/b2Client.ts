import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  CopyObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type B2BucketKind = 'libraryFiles' | 'backups' | 'exports';

export interface B2ObjectInput {
  bucket?: string;
  bucketKind?: B2BucketKind;
  key: string;
}

let cachedClient: S3Client | null = null;
let clientOverride: S3Client | null = null;

function getB2Client() {
  if (clientOverride) return clientOverride;
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing Backblaze B2 S3-compatible environment variables.');
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  return cachedClient;
}

export function __setB2ClientForTests(client: S3Client | null) {
  clientOverride = client;
  cachedClient = null;
}

function getBucket(input?: { bucket?: string; bucketKind?: B2BucketKind }) {
  if (input?.bucket) return input.bucket;
  if (input?.bucketKind === 'backups') return process.env.B2_BUCKET_BACKUPS;
  if (input?.bucketKind === 'exports') return process.env.B2_BUCKET_EXPORTS;
  return process.env.B2_BUCKET_LIBRARY_FILES;
}

function requireBucket(input?: { bucket?: string; bucketKind?: B2BucketKind }) {
  const bucket = getBucket(input);
  if (!bucket) throw new Error('Missing B2 bucket configuration.');
  return bucket;
}

export async function uploadObject(input: B2ObjectInput & {
  body: PutObjectCommandInput['Body'];
  contentType?: string;
  metadata?: Record<string, string>;
}) {
  const bucket = requireBucket(input);
  await getB2Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    Metadata: input.metadata,
  }));
  return { bucket, key: input.key, publicUrl: getPublicObjectUrl(bucket, input.key) };
}

export async function getSignedUploadUrl(input: B2ObjectInput & { contentType?: string; expiresIn?: number }) {
  const bucket = requireBucket(input);
  const command = new PutObjectCommand({ Bucket: bucket, Key: input.key, ContentType: input.contentType });
  return getSignedUrl(getB2Client(), command, { expiresIn: input.expiresIn ?? 900 });
}

export async function getSignedDownloadUrl(input: B2ObjectInput & { expiresIn?: number }) {
  const bucket = requireBucket(input);
  const command = new GetObjectCommand({ Bucket: bucket, Key: input.key });
  return getSignedUrl(getB2Client(), command, { expiresIn: input.expiresIn ?? 900 });
}

export async function deleteObject(input: B2ObjectInput) {
  const bucket = requireBucket(input);
  await getB2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: input.key }));
  return { bucket, key: input.key, deleted: true };
}

export async function objectExists(input: B2ObjectInput) {
  const bucket = requireBucket(input);
  try {
    await getB2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: input.key }));
    return true;
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotFound' || name === 'NoSuchKey' || name === 'Forbidden') return false;
    throw error;
  }
}

export async function listObjectsByPrefix(input: { bucket?: string; bucketKind?: B2BucketKind; prefix: string; maxKeys?: number }) {
  const bucket = requireBucket(input);
  const { Contents } = await getB2Client().send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: input.prefix,
    MaxKeys: input.maxKeys ?? 1000,
  }));
  return (Contents ?? []).map((item) => ({ key: item.Key, size: item.Size, lastModified: item.LastModified }));
}

export async function copyObject(input: B2ObjectInput & { sourceBucket?: string; sourceKey: string; destinationBucket?: string }) {
  const destinationBucket = input.destinationBucket || requireBucket(input);
  const sourceBucket = input.sourceBucket || destinationBucket;
  await getB2Client().send(new CopyObjectCommand({
    Bucket: destinationBucket,
    Key: input.key,
    CopySource: `${sourceBucket}/${encodeURIComponent(input.sourceKey).replace(/%2F/g, '/')}`,
  }));
  return { bucket: destinationBucket, key: input.key };
}

export function getPublicObjectUrl(bucket: string, key: string) {
  const base = process.env.B2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function safeFilename(filename: string) {
  return filename.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

export function tenantRepositoryKey(input: { tenantId: string; year: number | string; recordId: string; filename: string }) {
  return `tenants/${input.tenantId}/repository/${input.year}/${input.recordId}/${safeFilename(input.filename)}`;
}

export function tenantCatalogueKey(input: { tenantId: string; resourceId: string; filename: string }) {
  return `tenants/${input.tenantId}/catalogue/${input.resourceId}/${safeFilename(input.filename)}`;
}

export function tenantExportKey(input: { tenantId: string; date: string; filename: string }) {
  return `tenants/${input.tenantId}/exports/${input.date}/${safeFilename(input.filename)}`;
}

export function supabaseBackupKey(input: { date: string; filename: string }) {
  return `backups/supabase/${input.date}/${safeFilename(input.filename)}`;
}

export function appBackupKey(input: { date: string; filename: string }) {
  return `backups/app/${input.date}/${safeFilename(input.filename)}`;
}

export function resolveBucketName(kind: B2BucketKind) {
  return requireBucket({ bucketKind: kind });
}
