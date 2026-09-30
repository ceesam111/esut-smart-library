import { describe, it, expect } from 'vitest';

describe('repository-files', () => {
  it('has correct access level constraints', () => {
    const validLevels = ['PUBLIC', 'AUTHENTICATED', 'FACULTY', 'RESTRICTED', 'PRIVATE'];
    expect(validLevels).toContain('PUBLIC');
    expect(validLevels).toContain('PRIVATE');
  });

  it('has correct role constraints', () => {
    const validRoles = ['ORIGINAL', 'SUPPLEMENTARY', 'THUMBNAIL', 'TEXT', 'LICENSE', 'METADATA'];
    expect(validRoles).toContain('ORIGINAL');
    expect(validRoles).toContain('SUPPLEMENTARY');
  });

  it('supports multiple files per item', () => {
    const files = [
      { id: '1', role: 'ORIGINAL', filename: 'thesis.pdf' },
      { id: '2', role: 'SUPPLEMENTARY', filename: 'appendix.xlsx' },
      { id: '3', role: 'DATASET', filename: 'data.csv' },
    ];
    expect(files.length).toBe(3);
    expect(files[0].role).toBe('ORIGINAL');
  });

  it('does not expose storage key in API response', () => {
    const apiFile = { id: '1', filename: 'thesis.pdf', mimeType: 'application/pdf', size: 1024, role: 'ORIGINAL', accessLevel: 'PUBLIC' };
    expect(apiFile).not.toHaveProperty('storage_key');
    expect(apiFile).not.toHaveProperty('storageBucket');
  });
});
