import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichWithUnpaywall, hathiTrustAdapter, standardEbooksAdapter } from './adapters';

function mockFetchJson(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })));
}

function mockFetchText(payload: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(payload, { status: 200, headers: { 'Content-Type': 'application/xml' } })));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resource adapters', () => {
  it('normalizes Standard Ebooks OPDS records as public-domain ebooks', async () => {
    mockFetchText(`
      <feed>
        <entry>
          <title>The Republic</title>
          <id>https://standardebooks.org/ebooks/plato/the-republic</id>
          <author><name>Plato</name></author>
          <category term="Philosophy" />
          <link rel="http://opds-spec.org/acquisition" href="https://standardebooks.org/ebooks/plato/the-republic/downloads/plato_the-republic.epub" />
          <link rel="http://opds-spec.org/image" href="https://standardebooks.org/images/covers/plato_the-republic.jpg" />
        </entry>
      </feed>
    `);

    const results = await standardEbooksAdapter.search('republic', { limit: 5 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source_name: 'Standard Ebooks',
      title: 'The Republic',
      authors: ['Plato'],
      item_type: 'ebook',
      rights_status: 'public_domain',
      download_url: 'https://standardebooks.org/ebooks/plato/the-republic/downloads/plato_the-republic.epub',
    });
  });

  it('maps HathiTrust public-domain volume records safely', async () => {
    mockFetchJson({
      records: {
        '001': {
          recordNumber: '001',
          title: 'Public Book',
          author: 'A. Writer',
          publishDates: ['1910'],
          recordURL: 'https://catalog.hathitrust.org/Record/001',
          items: [{ rightsCode: 'pd', itemURL: 'https://hdl.handle.net/2027/test.001' }],
        },
      },
    });

    const results = await hathiTrustAdapter.search('9781234567890', { limit: 5 });

    expect(results[0]).toMatchObject({
      source_name: 'HathiTrust',
      title: 'Public Book',
      rights_status: 'public_domain',
      source_url: 'https://hdl.handle.net/2027/test.001',
    });
  });

  it('enriches DOI candidates only when Unpaywall returns open access', async () => {
    mockFetchJson({
      best_oa_location: {
        url: 'https://example.test/article',
        url_for_pdf: 'https://example.test/article.pdf',
        license: 'cc-by',
      },
    });

    const result = await enrichWithUnpaywall({
      source_name: 'CrossRef',
      source_record_id: '10.1234/example',
      title: 'Example Article',
      doi: '10.1234/example',
      item_type: 'article',
      rights_status: 'metadata_only',
      source_url: 'https://doi.org/10.1234/example',
      raw_metadata: {},
    });

    expect(result).toMatchObject({
      rights_status: 'open',
      licence: 'cc-by',
      source_url: 'https://doi.org/10.1234/example',
      download_url: 'https://example.test/article.pdf',
    });
  });
});
