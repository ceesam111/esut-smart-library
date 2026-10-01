import { describe, it, expect } from 'vitest';
import { buildAIP, validateAIP, sha256Bytes, type AIPBundle } from './aipBundle';
import { preflightRestore } from './restore';
import { resolveVersionFiles, type FileRow } from './aipExport';

const ITEM_ID = '11111111-2222-3333-4444-555555555555';

function sampleBundle(): AIPBundle {
  return buildAIP({
    bagName: `item-${ITEM_ID}`,
    payload: [
      { path: 'files/thesis-final.pdf', bytes: Buffer.from('thesis body'), role: 'ORIGINAL' },
      { path: 'files/supplementary.csv', bytes: Buffer.from('a,b\n1,2\n'), role: 'SUPPLEMENTARY' },
    ],
    bagInfo: { 'ESUT-Item-Id': ITEM_ID, 'ESUT-Item-Version': 'current' },
    metadata: {
      descriptive: { id: ITEM_ID, title: 'Digital Repository Preservation', authors: ['A. Writer'], status: 'published' },
      administrative: { exportedAt: '2026-09-30T00:00:00.000Z', exportedBy: 'user-1', files: [] },
      rights: { visibility: 'global', accessLevel: 'PUBLIC' },
      provenance: { source: 'ESUT Smart Library', aipFormat: 'BagIt-1.0' },
      versions: { itemId: ITEM_ID, versionCount: 0, versions: [] },
    },
  });
}

function clone(bundle: AIPBundle): AIPBundle {
  return { bagName: bundle.bagName, files: new Map([...bundle.files].map(([key, value]) => [key, Buffer.from(value)])) };
}

function errorText(bundle: AIPBundle): string {
  return validateAIP(bundle).errors.join('\n');
}

describe('AIP round trip (B8, B9, B10, B15)', () => {
  it('builds a BagIt bag that validates and passes restore preflight', () => {
    const bundle = sampleBundle();

    expect(bundle.files.has('bagit.txt')).toBe(true);
    expect(bundle.files.has('bag-info.txt')).toBe(true);
    expect(bundle.files.has('manifest-sha256.txt')).toBe(true);
    expect(bundle.files.has('tagmanifest-sha256.txt')).toBe(true);
    expect(bundle.files.has('metadata/descriptive.json')).toBe(true);
    expect(bundle.files.has('metadata/administrative.json')).toBe(true);
    expect(bundle.files.has('metadata/rights.json')).toBe(true);
    expect(bundle.files.has('metadata/provenance.json')).toBe(true);
    expect(bundle.files.has('metadata/versions.json')).toBe(true);

    const validation = validateAIP(bundle);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);

    const preflight = preflightRestore(bundle);
    expect(preflight.errors).toEqual([]);
    expect(preflight.valid).toBe(true);
  });

  it('manifest checksums are computed from the actual payload bytes', () => {
    const bundle = sampleBundle();
    const manifest = bundle.files.get('manifest-sha256.txt')!.toString('utf8');
    const lines = manifest.trim().split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const [hash, path] = line.split('  ');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256Bytes(bundle.files.get(path)!)).toBe(hash);
    }
  });

  it('rejects a tampered payload', () => {
    const bundle = clone(sampleBundle());
    bundle.files.set('data/files/thesis-final.pdf', Buffer.from('tampered body'));
    expect(errorText(bundle)).toMatch(/Checksum mismatch for payload/);
    expect(validateAIP(bundle).valid).toBe(false);
    expect(preflightRestore(bundle).valid).toBe(false);
  });

  it('rejects a missing bagit.txt', () => {
    const bundle = clone(sampleBundle());
    bundle.files.delete('bagit.txt');
    expect(errorText(bundle)).toMatch(/Missing bagit\.txt/);
  });

  it('rejects a manifest entry with a path traversal', () => {
    const bundle = clone(sampleBundle());
    const evil = `${'0'.repeat(64)}  ../escape.txt`;
    bundle.files.set('manifest-sha256.txt', Buffer.from(`${bundle.files.get('manifest-sha256.txt')!.toString('utf8')}${evil}\n`));
    expect(errorText(bundle)).toMatch(/unsafe path/i);
    expect(preflightRestore(bundle).errors.join('\n')).toMatch(/Unsafe path|unsafe path/i);
  });

  it('rejects malformed metadata JSON', () => {
    const bundle = clone(sampleBundle());
    bundle.files.set('metadata/versions.json', Buffer.from('{ "versions": ['));
    expect(errorText(bundle)).toMatch(/Malformed JSON in metadata\/versions\.json/);
    expect(preflightRestore(bundle).errors.join('\n')).toMatch(/Malformed metadata\/versions\.json/);
  });

  it('rejects a payload that is not listed in the manifest', () => {
    const bundle = clone(sampleBundle());
    bundle.files.set('data/files/unlisted.bin', Buffer.from('unlisted'));
    expect(errorText(bundle)).toMatch(/Payload missing from manifest-sha256\.txt/);
  });

  it('rejects metadata that contains a signed URL or secret', () => {
    const bundle = buildAIP({
      bagName: `item-${ITEM_ID}`,
      payload: [{ path: 'files/doc.pdf', bytes: Buffer.from('doc') }],
      metadata: {
        descriptive: { id: ITEM_ID, title: 'Doc' },
        administrative: {},
        rights: {},
        provenance: { download: 'https://storage.example/obj?X-Amz-Signature=abcdef0123456789' },
        versions: {},
      },
    });
    expect(errorText(bundle)).toMatch(/signed URL/i);
  });

  it('reports a wrong Payload-Oxum', () => {
    const bundle = clone(sampleBundle());
    const bagInfo = bundle.files.get('bag-info.txt')!.toString('utf8');
    bundle.files.set('bag-info.txt', Buffer.from(bagInfo.replace(/^Payload-Oxum: .*$/m, 'Payload-Oxum: 1.1')));
    bundle.files.set('tagmanifest-sha256.txt', Buffer.from(
      [
        'bagit.txt', 'bag-info.txt', 'manifest-sha256.txt',
        'metadata/descriptive.json', 'metadata/administrative.json', 'metadata/rights.json',
        'metadata/provenance.json', 'metadata/versions.json',
      ].map((path) => `${sha256Bytes(bundle.files.get(path)!)}  ${path}`).join('\n') + '\n',
    ));
    expect(errorText(bundle)).toMatch(/Payload-Oxum/);
  });
});

describe('version-specific export selection (B11)', () => {
  const tagged: FileRow[] = [
    { id: 'f2', repository_item_id: ITEM_ID, original_filename: 'v2.pdf', display_filename: null, mime_type: null, role: 'ORIGINAL', display_order: 0, storage_provider: 'supabase', storage_bucket: 'repository', storage_key: 'k2', checksum: null, checksum_algorithm: 'sha256', repository_version_id: 'ver-2', created_at: '2026-09-30T00:00:00Z' },
  ];
  const older: FileRow[] = [
    { id: 'f1', repository_item_id: ITEM_ID, original_filename: 'v1.pdf', display_filename: null, mime_type: null, role: 'ORIGINAL', display_order: 0, storage_provider: 'supabase', storage_bucket: 'repository', storage_key: 'k1', checksum: null, checksum_algorithm: 'sha256', repository_version_id: 'ver-1', created_at: '2026-09-01T00:00:00Z' },
  ];

  it('exports every file when no version is requested', () => {
    const result = resolveVersionFiles({ tagged: [...tagged, ...older], snapshot: [], version: null });
    expect(result.selector).toBe('all-files');
    expect(result.files).toHaveLength(2);
    expect(result.warning).toBeNull();
  });

  it('exports only files tagged to that version', () => {
    const result = resolveVersionFiles({ tagged, snapshot: older, version: { id: 'ver-2', created_at: '2026-09-30T00:00:00Z' } });
    expect(result.selector).toBe('version-tag');
    expect(result.files.map((file) => file.id)).toEqual(['f2']);
    expect(result.warning).toBeNull();
  });

  it('falls back to an as-of snapshot and says so', () => {
    const result = resolveVersionFiles({ tagged: [], snapshot: older, version: { id: 'ver-1', created_at: '2026-09-15T00:00:00Z' } });
    expect(result.selector).toBe('version-snapshot');
    expect(result.files.map((file) => file.id)).toEqual(['f1']);
    expect(result.warning).toMatch(/snapshot/i);
  });
});
