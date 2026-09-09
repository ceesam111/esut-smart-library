import { describe, expect, it } from 'vitest';
import { applyRightsPolicy, canDownloadLegalFile, classifyRights } from './rights';

describe('resource rights policy', () => {
  it('allows clear open legal files', () => {
    const candidate = { source_name: 'DOAB', title: 'Open Book', download_url: 'https://example.test/book.pdf', licence: 'CC-BY 4.0' };
    expect(classifyRights(candidate)).toBe('open');
    expect(canDownloadLegalFile(candidate)).toBe(true);
  });

  it('keeps unclear rights metadata only', () => {
    const candidate = applyRightsPolicy({ source_name: 'Unknown', title: 'Maybe closed', download_url: 'https://example.test/file.pdf' });
    expect(candidate.rights_status).toBe('unclear');
    expect(candidate.download_url).toBeNull();
    expect(candidate.confidence).toBe('needs_review');
  });

  it('treats Google Books as metadata only', () => {
    const candidate = applyRightsPolicy({ source_name: 'Google Books', title: 'Book', download_url: 'https://example.test/file.pdf' });
    expect(candidate.rights_status).toBe('metadata_only');
    expect(candidate.download_url).toBeNull();
  });
});
