import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { xmlEscape } from '@/server/oai/oaiXml';
import { parseCQL, cqlToSupabaseFilter, isSupportedIndex, isSupportedRelation } from '@/server/interoperability/cqlParser';
import { serializeRecord, type SRURecord } from '@/server/interoperability/sru/serializers';
import { errorResponse, SRU_DIAGNOSTICS } from '@/server/interoperability/sru/diagnostics';

export const dynamic = 'force-dynamic';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const SUPPORTED_SCHEMAS = new Set(['info:srw/schema/1/marcxml', 'info:srw/schema/1/dc']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get('operation') || url.searchParams.get('verb') || '';
  const version = url.searchParams.get('version') || '1.2';

  if (version !== '1.2' && version !== '1.1') {
    return xmlErrorResponse(SRU_DIAGNOSTICS.UNSUPPORTED_SCHEMA(`version ${version}`));
  }

  if (op === 'explain') {
    return sruExplain();
  }

  if (op === 'searchRetrieve') {
    return sruSearchRetrieve(url);
  }

  return xmlErrorResponse(SRU_DIAGNOSTICS.UNKNOWN_OPERATION(op));
}

function sruExplain() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<explainResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.2</version>
  <record>
    <recordSchema>http://www.loc.gov/zing/srw/</recordSchema>
    <recordPacking>xml</recordPacking>
    <recordData>
      <explain>
        <serverInfo>
          <host>esutlibrary.edu.ng</host>
          <port>443</port>
          <database>/api/sru</database>
        </serverInfo>
        <databaseInfo>
          <title>ESUT Smart Library Catalogue</title>
          <description>Integrated library catalogue with CQL search</description>
        </databaseInfo>
        <indexInfo>
          <set>
            <title>Catalogue</title>
          </set>
          <index>
            <title>Full text</title>
            <map>
              <name>cql.serverChoice</name>
            </map>
          </index>
          <index>
            <title>Title</title>
            <map>
              <name>dc.title</name>
            </map>
          </index>
          <index>
            <title>Creator</title>
            <map>
              <name>dc.creator</name>
            </map>
          </index>
          <index>
            <title>Subject</title>
            <map>
              <name>dc.subject</name>
            </map>
          </index>
          <index>
            <title>ISBN</title>
            <map>
              <name>bath.isbn</name>
            </map>
          </index>
          <index>
            <title>ISSN</title>
            <map>
              <name>bath.issn</name>
            </map>
          </index>
          <index>
            <title>Identifier</title>
            <map>
              <name>dc.identifier</name>
            </map>
          </index>
        </indexInfo>
        <schemaInfo>
          <schema>
            <title>MARCXML</title>
            <identifier>info:srw/schema/1/marcxml</identifier>
          </schema>
          <schema>
            <title>Dublin Core</title>
            <identifier>info:srw/schema/1/dc</identifier>
          </schema>
        </schemaInfo>
        <configInfo>
          <default type="numberOfRecords">${DEFAULT_PAGE_SIZE}</default>
          <default type="maximumRecords">${MAX_PAGE_SIZE}</default>
        </configInfo>
      </explain>
    </recordData>
  </record>
</explainResponse>`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/xml; charset=UTF-8' } });
}

async function sruSearchRetrieve(url: URL) {
  const query = url.searchParams.get('query') || '';
  const startRecordParam = url.searchParams.get('startRecord') || '1';
  const maximumRecordsParam = url.searchParams.get('maximumRecords') || String(DEFAULT_PAGE_SIZE);
  const recordSchema = url.searchParams.get('recordSchema') || 'info:srw/schema/1/dc';
  const recordPacking = url.searchParams.get('recordPacking') || 'xml';

  if (!query) {
    return xmlErrorResponse(SRU_DIAGNOSTICS.MISSING_QUERY());
  }

  const startRecord = Number(startRecordParam);
  if (!Number.isInteger(startRecord) || startRecord < 1) {
    return xmlErrorResponse(SRU_DIAGNOSTICS.INVALID_START_RECORD(startRecordParam));
  }

  const maximumRecords = Number(maximumRecordsParam);
  if (!Number.isInteger(maximumRecords) || maximumRecords < 1) {
    return xmlErrorResponse(SRU_DIAGNOSTICS.INVALID_MAXIMUM_RECORDS(maximumRecordsParam));
  }

  if (!SUPPORTED_SCHEMAS.has(recordSchema)) {
    return xmlErrorResponse(SRU_DIAGNOSTICS.UNSUPPORTED_SCHEMA(recordSchema));
  }

  if (recordPacking !== 'xml' && recordPacking !== 'string') {
    return xmlErrorResponse(SRU_DIAGNOSTICS.UNSUPPORTED_SCHEMA(`recordPacking ${recordPacking}`));
  }

  const parsed = parseCQL(query);
  if (!parsed.valid) {
    return xmlErrorResponse(SRU_DIAGNOSTICS.MALFORMED_CQL(parsed.error ?? 'Parse error'));
  }

  for (const term of parsed.terms) {
    if (!isSupportedIndex(term.field)) {
      return xmlErrorResponse(SRU_DIAGNOSTICS.UNSUPPORTED_INDEX(term.field));
    }
    if (!isSupportedRelation(term.relation)) {
      return xmlErrorResponse(SRU_DIAGNOSTICS.UNSUPPORTED_RELATION(term.relation));
    }
  }

  const serverChoiceTerms = parsed.terms.filter((t) => t.field === 'cql.serverchoice' || t.field === 'keyword');
  const filterTerms = parsed.terms.filter((t) => t.field !== 'cql.serverchoice' && t.field !== 'keyword');
  const { filter } = cqlToSupabaseFilter(filterTerms);

  const supabase = getSupabaseAdminClient();
  const offset = startRecord - 1;
  const limit = Math.min(maximumRecords, MAX_PAGE_SIZE);

  let dbQuery = supabase
    .from('catalogue_items')
    .select('id,title,authors,isbn,issn,publisher,year,format,abstract,subjects,call_number,language,doi,place_of_publication,physical_description,series,edition', { count: 'exact' })
    .eq('visibility', 'global')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  for (const term of serverChoiceTerms) {
    dbQuery = dbQuery.textSearch('search_vector', term.value, { type: 'websearch' });
  }
  if (filter) {
    dbQuery = dbQuery.or(filter);
  }

  const { data, error, count } = await dbQuery;

  if (error) {
    return xmlErrorResponse(SRU_DIAGNOSTICS.DATABASE_ERROR(error.message));
  }

  const records = (data ?? []).map((item, i) => {
    const sruRecord: SRURecord = {
      id: String(item.id),
      title: String(item.title ?? ''),
      authors: Array.isArray(item.authors) ? item.authors.map((a: unknown) => typeof a === 'string' ? a : String((a as Record<string, unknown>)?.name ?? '')) : [],
      isbn: item.isbn ?? undefined,
      issn: item.issn ?? undefined,
      publisher: item.publisher ?? undefined,
      year: item.year ?? undefined,
      format: item.format ?? undefined,
      abstract: item.abstract ?? undefined,
      subjects: Array.isArray(item.subjects) ? item.subjects.map(String) : [],
      callNumber: item.call_number ?? undefined,
      language: item.language ?? undefined,
      doi: item.doi ?? undefined,
      placeOfPublication: item.place_of_publication ?? undefined,
      physicalDescription: item.physical_description ?? undefined,
      series: item.series ?? undefined,
      edition: item.edition ?? undefined,
    };
    return `      <record>
        <recordSchema>${xmlEscape(recordSchema)}</recordSchema>
        <recordPacking>${xmlEscape(recordPacking)}</recordPacking>
        <recordData>
${serializeRecord(sruRecord, recordSchema)}
        </recordData>
        <recordPosition>${offset + i + 1}</recordPosition>
      </record>`;
  }).join('\n');

  const nextPosition = (count ?? 0) > offset + limit ? offset + limit + 1 : null;

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.2</version>
  <numberOfRecords>${count ?? 0}</numberOfRecords>
  <records>
${records}
  </records>
  ${nextPosition ? `<nextRecordPosition>${nextPosition}</nextRecordPosition>` : ''}
</searchRetrieveResponse>`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/xml; charset=UTF-8' } });
}

function xmlErrorResponse(diagnostic: ReturnType<typeof sruDiagnostic>) {
  return new NextResponse(errorResponse(diagnostic), {
    status: 400,
    headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
  });
}

function sruDiagnostic(number: number, message: string, details?: string) {
  return { uri: `info:srw/diagnostic/1/${number}`, details, message };
}
