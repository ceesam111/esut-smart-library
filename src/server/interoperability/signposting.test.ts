import { describe, it, expect } from 'vitest';
import { generateSignpostingLinks, signpostingToHeader, generateSignpostingHtml } from '@/server/interoperability/signposting';

describe('signposting', () => {
  it('generates landing page link', () => {
    const links = generateSignpostingLinks({ itemId: 'abc', handle: 'test/1' });
    expect(links[0].rel).toBe('landing page');
    expect(links[0].href).toContain('/repository/');
  });

  it('generates file link when fileUrl provided', () => {
    const links = generateSignpostingLinks({ itemId: 'abc', fileUrl: 'https://example.com/file.pdf' });
    const fileLink = links.find((l) => l.rel === 'item');
    expect(fileLink).toBeDefined();
    expect(fileLink?.type).toBe('application/pdf');
  });

  it('generates metadata link when metadataUrl provided', () => {
    const links = generateSignpostingLinks({ itemId: 'abc', metadataUrl: 'https://example.com/oai' });
    const metaLink = links.find((l) => l.rel === 'describedby');
    expect(metaLink).toBeDefined();
  });

  it('converts links to HTTP Link header', () => {
    const links = generateSignpostingLinks({ itemId: 'abc' });
    const header = signpostingToHeader(links);
    expect(header).toContain('rel="landing page"');
  });

  it('converts links to HTML link tags', () => {
    const links = generateSignpostingLinks({ itemId: 'abc' });
    const html = generateSignpostingHtml(links);
    expect(html).toContain('<link rel="landing page"');
  });
});
