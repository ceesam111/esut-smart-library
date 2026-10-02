import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContext, handleOaiRequest, listSets, type OaiRequestContext } from './service';
import { TOKEN_TTL_MS, buildToken, verifyToken } from './oaiXml';
import { DOMParser } from '@xmldom/xmldom';

const ITEMS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Public Article',
    authors: ['Dr. A. Smith'],
    abstract: 'A public abstract.',
    keywords: [],
    item_type: 'article',
    type: 'Article',
    doi: '10.1234/test',
    handle: 'public-article',
    license: 'CC BY 4.0',
    embargo_until: null,
    year: 2024,
    faculty_code: 'ENG',
    department: 'Computer Science',
    language: 'English',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    status: 'published',
    visibility: 'global',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Embargoed Article',
    authors: ['Dr. B. Jones'],
    abstract: 'Under embargo.',
    keywords: [],
    item_type: 'article',
    type: 'Article',
    doi: null,
    handle: null,
    license: null,
    embargo_until: '2999-01-01T00:00:00Z',
    year: 2025,
    faculty_code: null,
    department: null,
    language: 'English',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    status: 'published',
    visibility: 'global',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Private Item',
    authors: ['Dr. C. Brown'],
    abstract: 'Not public.',
    keywords: [],
    item_type: 'thesis',
    type: 'Thesis',
    doi: null,
    handle: null,
    license: null,
    embargo_until: null,
    year: 2023,
    faculty_code: null,
    department: null,
    language: 'English',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    status: 'published',
    visibility: 'private',
  },
];

let MOCK_ITEMS: Array<Record<string, unknown>> = [...ITEMS];

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => makeSupabase().supabase,
}));

beforeEach(() => {
  MOCK_ITEMS = [...ITEMS];
});

function makeSupabase() {
  const state = { items: MOCK_ITEMS };

  function createBuilder() {
    const ops: string[] = [];
    let eqId: string | undefined;
    const eqFilters: Array<[string, string]> = [];
    let embargoFilter = false;
    let setFilter: { column: string; value: string | null } | null = null;
    let rangeArgs: [number, number] | null = null;

    const resolve = () => {
      const last = ops[ops.length - 1];
      let items = state.items;
      for (const [column, value] of eqFilters) {
        items = items.filter((entry) => String((entry as Record<string, unknown>)[column]) === value);
      }
      if (embargoFilter) {
        items = items.filter((entry) => {
          const until = entry.embargo_until as string | null;
          return !until || new Date(until).getTime() <= 1_700_000_000_000;
        });
      }
      if (setFilter) {
        const filter = setFilter;
        items = items.filter(
          (entry) => String((entry as Record<string, unknown>)[filter.column]) === filter.value,
        );
      }
      if (rangeArgs) {
        items = items.slice(rangeArgs[0], rangeArgs[1] + 1);
      }
      if (last === 'maybeSingle') {
        const item = eqId ? items.find((entry) => entry.id === eqId) : items[0];
        return { data: item ?? null, error: null };
      }
      if (last === 'head') return { count: items.length, error: null };
      return { data: items, error: null };
    };

    const builder: Record<string, unknown> = {
      then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
    };

    for (const op of ['select', 'eq', 'gte', 'lte', 'or', 'order', 'limit', 'range', 'maybeSingle']) {
      builder[op] = (...args: unknown[]) => {
        if (op === 'eq') {
          const [column, value] = args;
          if (column === 'id') eqId = value as string;
          else eqFilters.push([column as string, value as string]);
        }
        if (op === 'or') {
          const pattern = String(args[0] ?? '');
          if (pattern.includes('embargo_until')) embargoFilter = true;
          const setColumn = pattern.includes('item_type') ? 'item_type'
            : pattern.includes('faculty_code') ? 'faculty_code'
            : pattern.includes('department') ? 'department' : null;
          if (setColumn) {
            setFilter = { column: setColumn, value: pattern.match(/eq\.([^,)]+)/)?.[1] ?? null };
          }
        }
        if (op === 'range') {
          rangeArgs = [Number(args[0]), Number(args[1])];
        }
        ops.push(op);
        return builder;
      };
    }
    builder.head = () => {
      ops.push('head');
      return builder;
    };

    return builder;
  }

  return { supabase: { from: () => createBuilder() }, state };
}

function makeContext(overrides?: Partial<OaiRequestContext>): OaiRequestContext {
  return buildContext('https://library.example.edu.ng/api/oai', {
    now: 1_700_000_000_000,
    secret: 'test-secret',
    ...overrides,
  });
}

function isWellFormed(xml: string): boolean {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return doc.documentElement.nodeName === 'OAI-PMH';
  } catch {
    return false;
  }
}

describe('OAI-PMH verbs', () => {
  it('Identify returns config-driven values', async () => {
    const context = makeContext({
      config: {
        repoName: 'Test Repository',
        baseUrl: 'https://library.example.edu.ng/api/oai',
        adminEmail: 'admin@example.edu.ng',
        authority: 'example.edu.ng',
        protocolVersion: '2.0',
        deletedRecord: 'no',
        granularity: 'YYYY-MM-DDThh:mm:ssZ',
        earliestDatestamp: '2023-01-02',
      },
    });
    const result = await handleOaiRequest({ verb: 'Identify' }, context);
    expect(result.errorCode).toBeNull();
    expect(result.xml).toContain('<protocolVersion>2.0</protocolVersion>');
    expect(result.xml).toContain('<repositoryName>Test Repository</repositoryName>');
    expect(result.xml).toContain(`<baseURL>${context.baseUrl}</baseURL>`);
    expect(result.xml).toContain('<deletedRecord>no</deletedRecord>');
    expect(result.xml).toContain('<granularity>YYYY-MM-DDThh:mm:ssZ</granularity>');
    expect(result.xml).toContain('<earliestDatestamp>2023-01-02</earliestDatestamp>');
    expect(isWellFormed(result.xml)).toBe(true);
  });

  it('ListMetadataFormats advertises oai_dc, datacite and marcxml', async () => {
    const result = await handleOaiRequest({ verb: 'ListMetadataFormats' }, makeContext());
    expect(result.errorCode).toBeNull();
    for (const prefix of ['oai_dc', 'datacite', 'marcxml']) {
      expect(result.xml).toContain(`<metadataPrefix>${prefix}</metadataPrefix>`);
    }
    expect(isWellFormed(result.xml)).toBe(true);
  });

  it('ListSets returns stable setSpecs', async () => {
    const result = await handleOaiRequest({ verb: 'ListSets' }, makeContext());
    expect(result.errorCode).toBeNull();
    const sets = listSets();
    expect(sets.length).toBeGreaterThan(0);
    for (const set of sets) {
      expect(set.setSpec).toMatch(/^[a-z]+:[a-z]+$/);
      expect(result.xml).toContain(`<setSpec>${set.setSpec}</setSpec>`);
    }
    expect(isWellFormed(result.xml)).toBe(true);
  });

  it('ListIdentifiers returns only public, non-embargoed items with setSpecs', async () => {
    const result = await handleOaiRequest({ verb: 'ListIdentifiers' }, makeContext());
    expect(result.errorCode).toBeNull();
    expect(result.xml).toContain('oai:');
    expect(result.xml).toContain('<setSpec>type:article</setSpec>');
    expect(result.xml).toContain('11111111-1111-1111-1111-111111111111');
    expect(result.xml).not.toContain('22222222-2222-2222-2222-222222222222');
    expect(result.xml).not.toContain('33333333-3333-3333-3333-333333333333');
    expect(isWellFormed(result.xml)).toBe(true);
  });

  it('ListRecords embeds metadata for the requested prefix', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc' }, makeContext());
    expect(result.errorCode).toBeNull();
    expect(result.xml).toContain('<oai_dc:dc');
    expect(result.xml).toContain('<dc:title>Public Article</dc:title>');
    expect(result.xml).toContain('<dc:creator>Dr. A. Smith</dc:creator>');
    expect(isWellFormed(result.xml)).toBe(true);
  });

  it('ListRecords supports the datacite prefix', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'datacite' }, makeContext());
    expect(result.errorCode).toBeNull();
    expect(result.xml).toContain('<resource xmlns="http://datacite.org/schema/kernel-4.4"');
    expect(result.xml).toContain('<identifier identifierType="DOI">10.1234/test</identifier>');
    expect(result.xml).toContain('<publicationYear>2024</publicationYear>');
    expect(isWellFormed(result.xml)).toBe(true);
  });

  it('ListRecords supports the marcxml prefix', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'marcxml' }, makeContext());
    expect(result.errorCode).toBeNull();
    expect(result.xml).toContain('<collection xmlns="http://www.loc.gov/MARC21/slim">');
    expect(result.xml).toContain('<datafield tag="245"');
    expect(isWellFormed(result.xml)).toBe(true);
  });

  it('GetRecord returns a public record', async () => {
    const context = makeContext();
    const result = await handleOaiRequest(
      { verb: 'GetRecord', metadataPrefix: 'oai_dc', identifier: `oai:${context.config.authority}:11111111-1111-1111-1111-111111111111` },
      context,
    );
    expect(result.errorCode).toBeNull();
    expect(result.xml).toContain('<GetRecord>');
    expect(result.xml).toContain('Public Article');
    expect(isWellFormed(result.xml)).toBe(true);
  });
});

describe('OAI-PMH errors', () => {
  it('returns badVerb for an unknown verb', async () => {
    const result = await handleOaiRequest({ verb: 'DeleteEverything' }, makeContext());
    expect(result.errorCode).toBe('badVerb');
    expect(result.xml).toContain('code="badVerb"');
  });

  it('returns badVerb for a missing verb', async () => {
    const result = await handleOaiRequest({}, makeContext());
    expect(result.errorCode).toBe('badVerb');
  });

  it('returns cannotDisseminateFormat for an unsupported prefix', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_marc' }, makeContext());
    expect(result.errorCode).toBe('cannotDisseminateFormat');
  });

  it('returns idDoesNotExist for an unknown identifier', async () => {
    const result = await handleOaiRequest(
      { verb: 'GetRecord', metadataPrefix: 'oai_dc', identifier: 'oai:example.org:does-not-exist' },
      makeContext(),
    );
    expect(result.errorCode).toBe('idDoesNotExist');
  });

  it('returns idDoesNotExist for a private item', async () => {
    const result = await handleOaiRequest(
      { verb: 'GetRecord', metadataPrefix: 'oai_dc', identifier: 'oai:example.org:33333333-3333-3333-3333-333333333333' },
      makeContext(),
    );
    expect(result.errorCode).toBe('idDoesNotExist');
  });

  it('returns idDoesNotExist for an embargoed item', async () => {
    const result = await handleOaiRequest(
      { verb: 'GetRecord', metadataPrefix: 'oai_dc', identifier: 'oai:example.org:22222222-2222-2222-2222-222222222222' },
      makeContext(),
    );
    expect(result.errorCode).toBe('idDoesNotExist');
  });

  it('returns badArgument when identifier is missing', async () => {
    const result = await handleOaiRequest({ verb: 'GetRecord', metadataPrefix: 'oai_dc' }, makeContext());
    expect(result.errorCode).toBe('badArgument');
  });

  it('returns badArgument for invalid datestamp granularity', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc', from: '2024/01/01' }, makeContext());
    expect(result.errorCode).toBe('badArgument');
  });

  it('returns badArgument when until precedes from', async () => {
    const result = await handleOaiRequest(
      { verb: 'ListRecords', metadataPrefix: 'oai_dc', from: '2024-06-01', until: '2024-01-01' },
      makeContext(),
    );
    expect(result.errorCode).toBe('badArgument');
  });

  it('returns badResumptionToken for a malformed token', async () => {
    const result = await handleOaiRequest(
      { verb: 'ListRecords', resumptionToken: 'not-a-token' },
      makeContext(),
    );
    expect(result.errorCode).toBe('badResumptionToken');
  });

  it('returns badResumptionToken for an expired token', async () => {
    const context = makeContext();
    const token = await buildToken({ offset: 0, prefix: 'oai_dc' }, context.now - TOKEN_TTL_MS - 1000, context.secret);
    const result = await handleOaiRequest({ verb: 'ListRecords', resumptionToken: token }, context);
    expect(result.errorCode).toBe('badResumptionToken');
  });

  it('returns badResumptionToken for an altered token', async () => {
    const context = makeContext();
    const token = await buildToken({ offset: 0, prefix: 'oai_dc' }, context.now, context.secret);
    const decoded = JSON.parse(atob(token)) as { offset: number };
    decoded.offset = 999;
    const altered = btoa(JSON.stringify(decoded));
    const result = await handleOaiRequest({ verb: 'ListRecords', resumptionToken: altered }, context);
    expect(result.errorCode).toBe('badResumptionToken');
  });
});

describe('OAI-PMH resumption tokens', () => {
  it('emits a token that round-trips its query context', async () => {
    const context = makeContext();
    const token = await buildToken(
      { offset: 100, prefix: 'oai_dc', from: '2024-01-01', until: '2024-12-31', set: 'type:article' },
      context.now,
      context.secret,
    );
    const verified = await verifyToken(token, context.now, context.secret);
    expect(verified).not.toBeNull();
    expect(verified).toMatchObject({ offset: 100, prefix: 'oai_dc', from: '2024-01-01', until: '2024-12-31', set: 'type:article' });
  });

  it('rejects a token signed with the wrong secret', async () => {
    const context = makeContext();
    const token = await buildToken({ offset: 0, prefix: 'oai_dc' }, context.now, 'attacker-secret');
    const verified = await verifyToken(token, context.now, context.secret);
    expect(verified).toBeNull();
  });

  it('accepts a valid token and continues from its cursor', async () => {
    const context = makeContext();
    const token = await buildToken({ offset: 0, prefix: 'oai_dc' }, context.now, context.secret);
    const result = await handleOaiRequest({ verb: 'ListRecords', resumptionToken: token }, context);
    expect(result.errorCode).toBeNull();
    expect(result.xml).toContain('Public Article');
  });

  it('emits a resumption token only when a page is full and continues on the next page', async () => {
    MOCK_ITEMS = Array.from({ length: 101 }, (_, index) => ({
      ...ITEMS[0],
      id: `bulk-${index}`,
      title: `Bulk Item ${index}`,
      updated_at: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    const context = makeContext();
    const first = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc' }, context);
    expect(first.errorCode).toBeNull();
    expect(first.resumptionToken).toBe(true);
    expect(first.recordCount).toBe(100);

    const tokenMatch = /<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/.exec(first.xml);
    expect(tokenMatch).not.toBeNull();

    const second = await handleOaiRequest({ verb: 'ListRecords', resumptionToken: tokenMatch?.[1] }, context);
    expect(second.errorCode).toBeNull();
    expect(second.recordCount).toBe(1);
    expect(second.xml).toContain('Bulk Item 100');
  });
});

describe('OAI-PMH access control', () => {
  it('never exposes embargoed items in ListRecords', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc' }, makeContext());
    expect(result.xml).not.toContain('Embargoed Article');
    expect(result.xml).not.toContain('22222222');
  });

  it('never exposes private items in ListRecords', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc' }, makeContext());
    expect(result.xml).not.toContain('Private Item');
    expect(result.xml).not.toContain('33333333');
  });

  it('never exposes embargoed items in ListIdentifiers', async () => {
    const result = await handleOaiRequest({ verb: 'ListIdentifiers' }, makeContext());
    expect(result.xml).not.toContain('Embargoed Article');
  });

  it('never emits file URLs, signed URLs or storage keys', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc' }, makeContext());
    expect(result.xml).not.toContain('storage_key');
    expect(result.xml).not.toContain('X-Amz-Signature');
    expect(result.xml).not.toContain('signature=');
    expect(result.xml).not.toContain('token=');
  });

  it('filters by a setSpec', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc', set: 'type:article' }, makeContext());
    expect(result.errorCode).toBeNull();
    expect(result.xml).toContain('Public Article');
  });

  it('returns noRecordsMatch for a setSpec with no records', async () => {
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc', set: 'type:dataset' }, makeContext());
    expect(result.errorCode).toBe('noRecordsMatch');
  });
});

describe('OAI-PMH date filtering', () => {
  it('accepts date-only granularity', async () => {
    const result = await handleOaiRequest(
      { verb: 'ListRecords', metadataPrefix: 'oai_dc', from: '2024-01-01', until: '2024-12-31' },
      makeContext(),
    );
    expect(result.errorCode).toBeNull();
  });

  it('accepts full UTC datetime granularity', async () => {
    const result = await handleOaiRequest(
      { verb: 'ListRecords', metadataPrefix: 'oai_dc', from: '2024-01-01T00:00:00Z', until: '2024-12-31T23:59:59Z' },
      makeContext(),
    );
    expect(result.errorCode).toBeNull();
  });

  it('rejects a datetime with a timezone offset', async () => {
    const result = await handleOaiRequest(
      { verb: 'ListRecords', metadataPrefix: 'oai_dc', from: '2024-01-01T00:00:00+01:00' },
      makeContext(),
    );
    expect(result.errorCode).toBe('badArgument');
  });
});

describe('OAI-PMH XML conformance', () => {
  it('every verb produces well-formed OAI-PMH 2.0 XML', async () => {
    const context = makeContext();
    const verbs = [
      { verb: 'Identify' },
      { verb: 'ListMetadataFormats' },
      { verb: 'ListSets' },
      { verb: 'ListIdentifiers' },
      { verb: 'ListRecords', metadataPrefix: 'oai_dc' },
    ];
    for (const params of verbs) {
      const result = await handleOaiRequest(params, context);
      expect(isWellFormed(result.xml)).toBe(true);
      expect(result.xml).toContain('xmlns="http://www.openarchives.org/OAI/2.0/"');
      expect(result.xml).toContain('<responseDate>');
      expect(result.xml).toContain('<request verb=');
    }
  });

  it('escapes XML special characters so output stays well-formed', async () => {
    const context = makeContext();
    const result = await handleOaiRequest({ verb: 'ListRecords', metadataPrefix: 'oai_dc' }, context);
    expect(isWellFormed(result.xml)).toBe(true);
    expect(result.xml).not.toMatch(/<dc:title>[^<]*<[^/]/);
  });
});
