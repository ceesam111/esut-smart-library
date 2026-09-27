import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { xmlEscape } from '@/server/oai/oaiXml';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get('operation') || url.searchParams.get('verb') || '';
  const query = url.searchParams.get('query') || url.searchParams.get('searchRetrieve') || '';
  const startRecord = Number(url.searchParams.get('startRecord') || 1);
  const maximumRecords = Math.min(Number(url.searchParams.get('maximumRecords') || 25), 100);

  if (op === 'explain') {
    return sruExplain();
  }

  if (op === 'searchRetrieve') {
    return sruSearchRetrieve(query, startRecord, maximumRecords);
  }

  return sruDiagnostic(1, 'Unknown operation. Use operation=explain or operation=searchRetrieve.');
}

function sruExplain() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<explainResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.1</version>
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
          <description>Integrated library catalogue with full-text search</description>
        </databaseInfo>
        <metaInfo>
          <dateModified>${new Date().toISOString().slice(0, 10)}</dateModified>
        </metaInfo>
        <indexInfo>
          <set>
            <title>Catalogue</title>
          </set>
          <index>
            <title>Full text</title>
            <map>
              <name>anywhere</name>
            </map>
          </index>
          <index>
            <title>Title</title>
            <map>
              <name>title</name>
            </map>
          </index>
          <index>
            <title>Author</title>
            <map>
              <name>author</name>
            </map>
          </index>
        </indexInfo>
        <schemaInfo>
          <schema>
            <title>DC</title>
            <identifier>info:srw/schema/1/dc</identifier>
          </schema>
        </schemaInfo>
        <configInfo>
          <default type="numberOfRecords">25</default>
          <default type="maximumRecords">100</default>
        </configInfo>
      </explain>
    </recordData>
  </record>
</explainResponse>`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/xml; charset=UTF-8' } });
}

async function sruSearchRetrieve(query: string, startRecord: number, maximumRecords: number) {
  const supabase = getSupabaseAdminClient();
  const offset = Math.max(startRecord - 1, 0);

  let dbQuery = supabase
    .from('catalogue_items')
    .select('id,title,authors,isbn,issn,call_number,year,format,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + maximumRecords - 1);

  if (query) {
    dbQuery = dbQuery.textSearch('search_vector', query, { type: 'websearch' });
  }

  const { data, error, count } = await dbQuery;

  if (error) {
    return sruDiagnostic(6, error.message);
  }

  const records = (data ?? []).map((item, i) => {
    const authors = Array.isArray(item.authors) ? item.authors : [];
    const creator = typeof authors[0] === 'string' ? authors[0] : String((authors[0] as Record<string, unknown>)?.name ?? '');
    return `      <record>
        <recordSchema>info:srw/schema/1/dc</recordSchema>
        <recordPacking>xml</recordPacking>
        <recordData>
          <dc xmlns="http://purl.org/dc/elements/1.1/">
            <title>${xmlEscape(String(item.title ?? ''))}</title>
            ${creator ? `<creator>${xmlEscape(creator)}</creator>` : ''}
            <identifier>${xmlEscape(String(item.id))}</identifier>
            <type>${xmlEscape(String(item.format ?? ''))}</type>
            <date>${xmlEscape(String(item.year ?? ''))}</date>
            ${item.isbn ? `<identifier>ISBN:${xmlEscape(String(item.isbn))}</identifier>` : ''}
          </dc>
        </recordData>
        <recordPosition>${offset + i + 1}</recordPosition>
      </record>`;
  }).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.1</version>
  <numberOfRecords>${count ?? 0}</numberOfRecords>
  <records>
${records}
  </records>
  <nextRecordPosition>${(count ?? 0) > offset + maximumRecords ? offset + maximumRecords + 1 : ''}</nextRecordPosition>
</searchRetrieveResponse>`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/xml; charset=UTF-8' } });
}

function sruDiagnostic(number: number, message: string) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.1</version>
  <diagnostics>
    <diagnostic xmlns="http://www.loc.gov/zing/srw/diagnostic/">
      <uri>info:srw/diagnostic/1/${number}</uri>
      <details>${xmlEscape(message)}</details>
      <message>${xmlEscape(message)}</message>
    </diagnostic>
  </diagnostics>
</searchRetrieveResponse>`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/xml; charset=UTF-8' } });
}
