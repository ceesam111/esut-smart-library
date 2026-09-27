import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { oaiIdentifier, utcDatestamp, dateDatestamp, granularityValid, toUtcDate, buildToken, verifyToken, TOKEN_TTL_MS, xmlEscape } from '@/server/oai/oaiXml';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
const REPO_NAME = process.env.OAI_REPO_NAME ?? 'ESUT Digital Repository';
const ADMIN_EMAIL = process.env.OAI_ADMIN_EMAIL ?? 'library@esut.edu.ng';
const BASE_URL = process.env.OAI_BASE_URL ?? 'https://esutlibrary.edu.ng/api/oai';
const OAI_AUTHORITY = process.env.OAI_AUTHORITY ?? (() => { try { return new URL(BASE_URL).hostname; } catch { return 'esutlibrary.edu.ng'; } })();
const TOKEN_SECRET = process.env.OAI_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function isEnabled(): boolean { return process.env.OAI_ENABLED === 'true'; }
function oaiError(code: string, msg: string, verb = ''): string { return oaiEnvelope(verb, `<error code="${code}">${msg}</error>`); }

function dcRecord(item: Record<string, unknown>): string {
  const authors = Array.isArray(item.authors) ? item.authors as unknown[] : [];
  const subjects = Array.isArray(item.subjects) ? item.subjects as unknown[] : [];
  const keywords = Array.isArray(item.keywords) ? item.keywords as unknown[] : [];
  const doi = (item.doi as string) ?? null;
  const handle = (item.handle as string) ?? null;
  const itemUrl = `https://esutlibrary.edu.ng/repository/${encodeURIComponent(String(item.handle ?? item.id))}`;
  const creatorTags = authors.map((a) => `<dc:creator>${xmlEscape(typeof a === 'string' ? a : String((a as Record<string, unknown>).name ?? ''))}</dc:creator>`).join('\n        ');
  const subjectTags = [...subjects, ...keywords].map((s) => `<dc:subject>${xmlEscape(String(s))}</dc:subject>`).join('\n        ');
  const idTags = [itemUrl, doi ? `https://doi.org/${doi}` : null].filter(Boolean).map((u) => `<dc:identifier>${xmlEscape(String(u))}</dc:identifier>`).join('\n        ');
  return `<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
        <dc:title>${xmlEscape(String(item.title ?? ''))}</dc:title>${creatorTags}${subjectTags}
        <dc:description>${xmlEscape(String(item.abstract ?? ''))}</dc:description>
        <dc:date>${dateDatestamp(item.year ? String(item.year) : (item.date_issued as string) ?? '')}</dc:date>
        <dc:type>${xmlEscape(String(item.item_type ?? ''))}</dc:type>${idTags}
        <dc:language>${xmlEscape(String(item.language ?? 'English'))}</dc:language>
        <dc:rights>${xmlEscape(String(item.license ?? 'CC BY 4.0 https://creativecommons.org/licenses/by/4.0/'))}</dc:rights>
      </oai_dc:dc>`;
}

function oaiEnvelope(verb: string, body: string, params = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${utcDatestamp(new Date().toISOString())}</responseDate>
  <request verb="${verb}" ${params}>${BASE_URL}</request>${body}
</OAI-PMH>`;
}

const COLS = 'id,title,authors,abstract,keywords,item_type,doi,handle,license,embargo_until,year,date_issued,faculty_code,updated_at';

export async function GET(request: Request) {
  if (!isEnabled()) return new NextResponse('OAI-PMH is not enabled. Set OAI_ENABLED=true.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  const p = new URL(request.url).searchParams;
  const verb = p.get('verb') ?? '';
  const metadataPrefix = p.get('metadataPrefix') ?? '';
  const from = p.get('from') ?? '';
  const until = p.get('until') ?? '';
  const identifier = p.get('identifier') ?? '';
  const set = p.get('set') ?? '';
  const resumptionToken = p.get('resumptionToken') ?? '';
  const now = Date.now();
  const xml = (body: string): NextResponse => new NextResponse(body, { headers: { 'Content-Type': 'text/xml; charset=UTF-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  if (request.method === 'OPTIONS') return new NextResponse(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  const supabase = getSupabaseAdminClient();

  if (verb === 'Identify') {
    const { data: earliest } = await supabase.from('repository_items').select('created_at').eq('status', 'published').order('created_at', { ascending: true }).limit(1).maybeSingle();
    const earliestDate = earliest?.created_at ? dateDatestamp(earliest.created_at) : '';
    return xml(oaiEnvelope('Identify', `<Identify><repositoryName>${REPO_NAME}</repositoryName><baseURL>${BASE_URL}</baseURL><protocolVersion>2.0</protocolVersion><adminEmail>${ADMIN_EMAIL}</adminEmail>${earliestDate ? `<earliestDatestamp>${earliestDate}</earliestDatestamp>` : ''}<deletedRecord>no</deletedRecord><granularity>YYYY-MM-DDThh:mm:ssZ</granularity></Identify>`));
  }
  if (verb === 'ListMetadataFormats') {
    return xml(oaiEnvelope('ListMetadataFormats', '<ListMetadataFormats><metadataFormat><metadataPrefix>oai_dc</metadataPrefix><schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema><metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace></metadataFormat></ListMetadataFormats>'));
  }
  if (verb === 'ListSets') {
    const { data: communities } = await supabase.from('repository_communities').select('slug, name').order('name');
    const sets = (communities ?? []).map((c: Record<string, unknown>) => `<set><setSpec>${c.slug}</setSpec><setName>${c.name}</setName></set>`).join('\n    ');
    return xml(oaiEnvelope('ListSets', `<ListSets>${sets}</ListSets>`));
  }
  if (verb === 'GetRecord') {
    if (metadataPrefix !== 'oai_dc') return xml(oaiError('cannotDisseminateFormat', 'Only oai_dc is supported', verb));
    if (!identifier) return xml(oaiError('badArgument', 'identifier is required', verb));
    const itemId = identifier.replace(/^oai:[^:]+:/, '');
    const { data: item } = await supabase.from('repository_items').select(COLS).eq('id', itemId).eq('status', 'published').eq('visibility', 'global').maybeSingle();
    if (!item) return xml(oaiError('idDoesNotExist', 'Record not found', verb));
    return xml(oaiEnvelope('GetRecord', `<GetRecord><record><header><identifier>${oaiIdentifier(item.id as string, OAI_AUTHORITY)}</identifier><datestamp>${utcDatestamp(item.updated_at as string)}</datestamp></header><metadata>${dcRecord(item as Record<string, unknown>)}</metadata></record></GetRecord>`, `metadataPrefix="${metadataPrefix}" identifier="${identifier}"`));
  }
  if (verb === 'ListIdentifiers' || verb === 'ListRecords') {
    if (!resumptionToken && metadataPrefix !== 'oai_dc') return xml(oaiError('cannotDisseminateFormat', 'Only oai_dc is supported', verb));
    let offset = 0, prefix = 'oai_dc', totalCount: number | null = null;
    if (resumptionToken) {
      const verified = await verifyToken(resumptionToken, now, TOKEN_SECRET);
      if (!verified) return xml(oaiError('badResumptionToken', 'Invalid or expired resumption token', verb));
      offset = verified.offset; prefix = verified.prefix;
    } else {
      if ((from && !granularityValid(from)) || (until && !granularityValid(until))) return xml(oaiError('badArgument', 'Invalid datestamp granularity; use YYYY-MM-DD or YYYY-MM-DDThh:mm:ssZ', verb));
      let countQuery = supabase.from('repository_items').select('*', { count: 'exact' }).eq('status', 'published').eq('visibility', 'global');
      if (from) countQuery = countQuery.gte('updated_at', toUtcDate(from));
      if (until) countQuery = countQuery.lte('updated_at', toUtcDate(until, true));
      if (set) countQuery = countQuery.eq('faculty_code', set);
      const { count } = await countQuery; totalCount = count ?? 0;
    }
    let query = supabase.from('repository_items').select(COLS).eq('status', 'published').eq('visibility', 'global').order('updated_at', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (from) query = query.gte('updated_at', toUtcDate(from));
    if (until) query = query.lte('updated_at', toUtcDate(until, true));
    if (set) query = query.eq('faculty_code', set);
    const { data: items, error } = await query;
    if (error) return xml(oaiError('internalError', 'Database error', verb));
    if (!items || items.length === 0) {
      if (resumptionToken) return xml(oaiEnvelope(verb, `<${verb === 'ListIdentifiers' ? 'ListIdentifiers' : 'ListRecords'}/>`, `resumptionToken="${resumptionToken}"`));
      return xml(oaiError('noRecordsMatch', 'No records match the query', verb));
    }
    const records = items.map((item: Record<string, unknown>) => {
      const header = `<header><identifier>${oaiIdentifier(item.id as string, OAI_AUTHORITY)}</identifier><datestamp>${utcDatestamp(item.updated_at as string)}</datestamp></header>`;
      return verb === 'ListIdentifiers' ? `<header>${header}</header>` : `<record>${header}<metadata>${dcRecord(item)}</metadata></record>`;
    }).join('\n    ');
    const nextOffset = offset + items.length;
    const tokenValue = items.length >= PAGE_SIZE ? await buildToken(nextOffset, prefix, now, TOKEN_SECRET) : '';
    const tokenEl = tokenValue ? `<resumptionToken completeListSize="${totalCount}" cursor="${nextOffset}" expiration="${now + TOKEN_TTL_MS}">${tokenValue}</resumptionToken>` : '';
    const tag = verb === 'ListIdentifiers' ? 'ListIdentifiers' : 'ListRecords';
    return xml(oaiEnvelope(verb, `<${tag}>${records}${tokenEl}</${tag}>`, tokenValue ? `resumptionToken="${tokenValue}"` : ''));
  }
  return xml(oaiError('badVerb', 'Illegal OAI verb', verb));
}
