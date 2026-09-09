import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __setB2ClientForTests,
  appBackupKey,
  copyObject,
  deleteObject,
  listObjectsByPrefix,
  objectExists,
  supabaseBackupKey,
  tenantCatalogueKey,
  tenantExportKey,
  tenantRepositoryKey,
  uploadObject,
} from './b2Client';

class MockS3Client {
  calls: string[] = [];
  async send(command: { constructor: { name: string } }) {
    this.calls.push(command.constructor.name);
    if (command.constructor.name === 'ListObjectsV2Command') return { Contents: [{ Key: 'a', Size: 1 }] };
    return {};
  }
}

describe('b2Client', () => {
  afterEach(() => __setB2ClientForTests(null));

  it('builds tenant and backup object keys safely', () => {
    expect(tenantRepositoryKey({ tenantId: 't1', year: 2026, recordId: 'r1', filename: 'My File.pdf' })).toBe('tenants/t1/repository/2026/r1/My-File.pdf');
    expect(tenantCatalogueKey({ tenantId: 't1', resourceId: 'c1', filename: '../cover image.jpg' })).toBe('tenants/t1/catalogue/c1/..-cover-image.jpg');
    expect(tenantExportKey({ tenantId: 't1', date: '2026-06-26', filename: 'report.csv' })).toBe('tenants/t1/exports/2026-06-26/report.csv');
    expect(supabaseBackupKey({ date: '2026-06-26', filename: 'dump.sql.gz' })).toBe('backups/supabase/2026-06-26/dump.sql.gz');
    expect(appBackupKey({ date: '2026-06-26', filename: 'env.enc' })).toBe('backups/app/2026-06-26/env.enc');
  });

  it('dispatches S3-compatible commands', async () => {
    const mock = new MockS3Client();
    __setB2ClientForTests(mock as any);
    await uploadObject({ bucket: 'files', key: 'k', body: 'x' });
    await deleteObject({ bucket: 'files', key: 'k' });
    await objectExists({ bucket: 'files', key: 'k' });
    await listObjectsByPrefix({ bucket: 'files', prefix: 'tenants/t1' });
    await copyObject({ bucket: 'files', sourceKey: 'a', key: 'b' });
    expect(mock.calls).toEqual([
      'PutObjectCommand',
      'DeleteObjectCommand',
      'HeadObjectCommand',
      'ListObjectsV2Command',
      'CopyObjectCommand',
    ]);
  });

  it('treats missing objects as non-existent', async () => {
    const mock = { send: vi.fn(async () => { const error = new Error('missing'); error.name = 'NotFound'; throw error; }) };
    __setB2ClientForTests(mock as any);
    await expect(objectExists({ bucket: 'files', key: 'missing' })).resolves.toBe(false);
  });
});
