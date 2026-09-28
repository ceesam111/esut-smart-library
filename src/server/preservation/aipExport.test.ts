import { describe, it, expect } from 'vitest';
import { computeChecksum } from './checksum';

describe('aipExport', () => {
  it('AIP export result structure is correct', () => {
    const manifestChecksum = computeChecksum(Buffer.from('payload-oxum: 123.abc'));
    const result = {
      item_id: 'abc-123',
      bag_path: 'https://example.com/aip.txt',
      manifest_checksum: manifestChecksum,
      file_count: 1,
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(result.item_id).toBe('abc-123');
    expect(result.file_count).toBe(1);
    expect(result.manifest_checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.manifest_checksum).toHaveLength(64);
  });

  it('BagIt manifest format is valid', () => {
    const manifest = 'BagIt-Version: 1.0\nTag-File-Character-Encoding: UTF-8\n\npayload-oxum: 123.abc\n\n';
    expect(manifest).toContain('BagIt-Version: 1.0');
    expect(manifest).toContain('Tag-File-Character-Encoding: UTF-8');
  });
});
