import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import {
  buildToken,
  dateDatestamp,
  granularityValid,
  isPublicItem,
  localIdentifier,
  oaiIdentifier,
  PAGE_SIZE,
  resolveAuthority,
  toUtcDate,
  TOKEN_TTL_MS,
  utcDatestamp,
  verifyToken,
  xmlEscape,
  type OaiConfig,
} from './oaiXml';
import { METADATA_FORMATS, SUPPORTED_METADATA_PREFIXES, isMetadataPrefix, toMetadata, type MetadataPrefix } from './crosswalks';

export interface OaiRequestContext {
  baseUrl: string;
  config: OaiConfig;
  now: number;
  secret: string;
}

export interface OaiResponse {
  xml: string;
  recordCount: number;
  errorCode: string | null;
  metadataPrefix: string | null;
  set: string | null;
  resumptionToken: boolean;
}

export type OaiParams = {
  verb?: string | null;
  metadataPrefix?: string | null;
  from?: string | null;
  until?: string | null;
  identifier?: string | null;
  set?: string | null;
  resumptionToken?: string | null;
};

const COLS = 'id,title,authors,abstract,keywords,item_type,type,doi,handle,license,embargo_until,year,faculty_code,department,language,created_at,updated_at,status,visibility';

function envelope(verb: string, body: string, params: string, context: OaiRequestContext): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${utcDatestamp(new Date(context.now).toISOString())}</responseDate>
  <request verb="${xmlEscape(verb)}"${params ? ` ${params}` : ''}>${xmlEscape(context.baseUrl)}</request>
  ${body}
</OAI-PMH>`;
}

function errorResponse(code: string, message: string, verb: string, context: OaiRequestContext): OaiResponse {
  return {
    xml: envelope(verb, `<error code="${code}">${xmlEscape(message)}</error>`, '', context),
    recordCount: 0,
    errorCode: code,
    metadataPrefix: null,
    set: null,
    resumptionToken: false,
  };
}

export interface OaiSet {
  setSpec: string;
  setName: string;
}

export function listSets(): OaiSet[] {
  return [
    { setSpec: 'type:article', setName: 'Articles' },
    { setSpec: 'type:thesis', setName: 'Theses' },
    { setSpec: 'type:dataset', setName: 'Datasets' },
    { setSpec: 'type:conference', setName: 'Conference Papers' },
    { setSpec: 'type:book', setName: 'Book Chapters' },
  ];
}

function setMatches(setSpec: string, item: Record<string, unknown>): boolean {
  const [kind, ...rest] = setSpec.split(':');
  const value = rest.join(':');
  if (kind === 'type') return String(item.item_type ?? item.type ?? '').toLowerCase() === value.toLowerCase();
  if (kind === 'faculty') return String(item.faculty_code ?? '') === value;
  if (kind === 'department') return String(item.department ?? '') === value;
  return false;
}

function setQueryFilter(set: string): string | null {
  const [kind, ...rest] = set.split(':');
  const value = rest.join(':');
  if (kind === 'type') return `item_type.eq.${value}`;
  if (kind === 'faculty') return `faculty_code.eq.${value}`;
  if (kind === 'department') return `department.eq.${value}`;
  return null;
}

function setSpecsFor(item: Record<string, unknown>): string[] {
  const specs: string[] = [];
  const type = String(item.item_type ?? item.type ?? '').toLowerCase();
  if (type) specs.push(`type:${type}`);
  if (item.faculty_code) specs.push(`faculty:${String(item.faculty_code)}`);
  if (item.department) specs.push(`department:${String(item.department)}`);
  return specs;
}

export async function handleOaiRequest(params: OaiParams, context: OaiRequestContext): Promise<OaiResponse> {
  const verb = params.verb ?? '';
  const prefix = params.metadataPrefix ?? '';
  const from = params.from ?? '';
  const until = params.until ?? '';
  const identifier = params.identifier ?? '';
  const set = params.set ?? '';
  const resumptionToken = params.resumptionToken ?? '';

  if (verb === 'Identify') {
    return {
      xml: envelope('Identify', `<Identify>
    <repositoryName>${xmlEscape(context.config.repoName)}</repositoryName>
    <baseURL>${xmlEscape(context.baseUrl)}</baseURL>
    <protocolVersion>${xmlEscape(context.config.protocolVersion)}</protocolVersion>
    <adminEmail>${xmlEscape(context.config.adminEmail)}</adminEmail>
    ${context.config.earliestDatestamp ? `<earliestDatestamp>${context.config.earliestDatestamp}</earliestDatestamp>` : ''}
    <deletedRecord>${xmlEscape(context.config.deletedRecord)}</deletedRecord>
    <granularity>${xmlEscape(context.config.granularity)}</granularity>
  </Identify>`, '', context),
      recordCount: 0,
      errorCode: null,
      metadataPrefix: null,
      set: null,
      resumptionToken: false,
    };
  }

  if (verb === 'ListMetadataFormats') {
    const formats = SUPPORTED_METADATA_PREFIXES
      .map((name) => {
        const format = METADATA_FORMATS[name];
        return `  <metadataFormat>
    <metadataPrefix>${name}</metadataPrefix>
    <schema>${format.schema}</schema>
    <metadataNamespace>${format.namespace}</metadataNamespace>
  </metadataFormat>`;
      })
      .join('\n');
    return {
      xml: envelope('ListMetadataFormats', `<ListMetadataFormats>\n${formats}\n</ListMetadataFormats>`, '', context),
      recordCount: 0,
      errorCode: null,
      metadataPrefix: null,
      set: null,
      resumptionToken: false,
    };
  }

  if (verb === 'ListSets') {
    const sets = listSets()
      .map((entry) => `  <set><setSpec>${xmlEscape(entry.setSpec)}</setSpec><setName>${xmlEscape(entry.setName)}</setName></set>`)
      .join('\n');
    return {
      xml: envelope('ListSets', `<ListSets>\n${sets}\n</ListSets>`, '', context),
      recordCount: 0,
      errorCode: null,
      metadataPrefix: null,
      set: null,
      resumptionToken: false,
    };
  }

  if (verb === 'GetRecord') {
    if (!isMetadataPrefix(prefix)) {
      return errorResponse('cannotDisseminateFormat', `metadataPrefix "${prefix}" is not supported. Supported: ${SUPPORTED_METADATA_PREFIXES.join(', ')}.`, verb, context);
    }
    if (!identifier) {
      return errorResponse('badArgument', 'identifier is required.', verb, context);
    }
    const db = getSupabaseAdminClient();
    const itemId = localIdentifier(identifier);
    const { data: item, error } = await db.from('repository_items').select(COLS).eq('id', itemId).maybeSingle();
    if (error) return errorResponse('internalError', 'Database error', verb, context);
    if (!item || !isPublicItem(item)) {
      return errorResponse('idDoesNotExist', 'No such record.', verb, context);
    }
    const header = recordHeader(item, context);
    const body = `<GetRecord><record>${header}<metadata>${toMetadata(prefix as MetadataPrefix, item, context.baseUrl)}</metadata></record></GetRecord>`;
    return {
      xml: envelope(verb, body, `metadataPrefix="${prefix}" identifier="${xmlEscape(identifier)}"`, context),
      recordCount: 1,
      errorCode: null,
      metadataPrefix: prefix,
      set: null,
      resumptionToken: false,
    };
  }

  if (verb === 'ListIdentifiers' || verb === 'ListRecords') {
    return handleListVerb(verb, { prefix, from, until, set, resumptionToken }, context);
  }

  return errorResponse('badVerb', `Illegal or missing verb. Supported: Identify, ListMetadataFormats, ListSets, ListIdentifiers, ListRecords, GetRecord.`, verb || 'missing', context);
}

function recordHeader(item: Record<string, unknown>, context: OaiRequestContext): string {
  const setSpecs = setSpecsFor(item);
  const setTags = setSpecs.map((spec) => `<setSpec>${xmlEscape(spec)}</setSpec>`).join('');
  return `<header>
      <identifier>${oaiIdentifier(String(item.id), context.config.authority)}</identifier>
      <datestamp>${utcDatestamp(item.updated_at as string)}</datestamp>
      ${setTags}
    </header>`;
}

async function handleListVerb(
  verb: 'ListIdentifiers' | 'ListRecords',
  params: { prefix: string; from: string; until: string; set: string; resumptionToken: string },
  context: OaiRequestContext,
): Promise<OaiResponse> {
  const db = getSupabaseAdminClient();
  const isIdentifiers = verb === 'ListIdentifiers';
  const tag = isIdentifiers ? 'ListIdentifiers' : 'ListRecords';

  let offset = 0;
  let prefix = params.prefix;
  let from = params.from;
  let until = params.until;
  let set = params.set;
  let usedToken = false;

  if (params.resumptionToken) {
    const verified = await verifyToken(params.resumptionToken, context.now, context.secret);
    if (!verified) {
      return errorResponse('badResumptionToken', 'Invalid or expired resumption token.', verb, context);
    }
    offset = verified.offset;
    prefix = verified.prefix;
    from = verified.from ?? '';
    until = verified.until ?? '';
    set = verified.set ?? '';
    usedToken = true;
  } else {
    if (!isIdentifiers && !isMetadataPrefix(prefix)) {
      return errorResponse('cannotDisseminateFormat', `metadataPrefix "${prefix}" is not supported. Supported: ${SUPPORTED_METADATA_PREFIXES.join(', ')}.`, verb, context);
    }
    if ((from && !granularityValid(from)) || (until && !granularityValid(until))) {
      return errorResponse('badArgument', 'Invalid datestamp granularity. Use YYYY-MM-DD or YYYY-MM-DDThh:mm:ssZ.', verb, context);
    }
    if (from && until && toUtcDate(until, true) < toUtcDate(from)) {
      return errorResponse('badArgument', 'until must not be earlier than from.', verb, context);
    }
  }

  const baseFilter = () => {
    let query = db.from('repository_items').select(COLS).eq('status', 'published').eq('visibility', 'global');
    query = query.or(`embargo_until.is.null,embargo_until.lte.${new Date(context.now).toISOString()}`);
    if (from) query = query.gte('updated_at', toUtcDate(from));
    if (until) query = query.lte('updated_at', toUtcDate(until, true));
    return query;
  };

  const setFilterQuery = set ? setQueryFilter(set) : null;

  let totalCount: number | null = null;
  if (!usedToken) {
    let countQuery = db.from('repository_items').select('*', { count: 'exact', head: true }).eq('status', 'published').eq('visibility', 'global');
    countQuery = countQuery.or(`embargo_until.is.null,embargo_until.lte.${new Date(context.now).toISOString()}`);
    if (from) countQuery = countQuery.gte('updated_at', toUtcDate(from));
    if (until) countQuery = countQuery.lte('updated_at', toUtcDate(until, true));
    if (setFilterQuery) countQuery = countQuery.or(setFilterQuery);
    const { count, error } = await countQuery;
    if (error) return errorResponse('internalError', 'Database error', verb, context);
    totalCount = count ?? 0;
  }

  let query = baseFilter().order('updated_at', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
  if (setFilterQuery) query = query.or(setFilterQuery);

  const { data: items, error } = await query;
  if (error) return errorResponse('internalError', 'Database error', verb, context);

  if (!items || items.length === 0) {
    if (usedToken) {
      return {
        xml: envelope(verb, `<${tag}/>`, `resumptionToken="${xmlEscape(params.resumptionToken)}"`, context),
        recordCount: 0,
        errorCode: null,
        metadataPrefix: prefix,
        set: set || null,
        resumptionToken: true,
      };
    }
    return errorResponse('noRecordsMatch', 'No records match the query.', verb, context);
  }

  const records = items
    .filter((item) => !set || setMatches(set, item))
    .map((item) => {
      const header = recordHeader(item, context);
      return isIdentifiers ? header : `<record>${header}<metadata>${toMetadata(prefix as MetadataPrefix, item, context.baseUrl)}</metadata></record>`;
    })
    .join('\n  ');

  const nextOffset = offset + items.length;
  const tokenValue = items.length >= PAGE_SIZE
    ? await buildToken({ offset: nextOffset, prefix, from: from || null, until: until || null, set: set || null }, context.now, context.secret)
    : '';
  const tokenElement = tokenValue
    ? `  <resumptionToken completeListSize="${totalCount ?? ''}" cursor="${nextOffset}" expiration="${context.now + TOKEN_TTL_MS}">${tokenValue}</resumptionToken>`
    : '';
  const requestParams = tokenValue
    ? `resumptionToken="${tokenValue}"`
    : isIdentifiers
      ? ''
      : `metadataPrefix="${prefix}"`;

  return {
    xml: envelope(verb, `<${tag}>\n  ${records}\n${tokenElement}\n</${tag}>`, requestParams, context),
    recordCount: items.length,
    errorCode: null,
    metadataPrefix: prefix,
    set: set || null,
    resumptionToken: Boolean(tokenValue),
  };
}

export function buildContext(requestUrl: string, overrides?: Partial<OaiRequestContext>): OaiRequestContext {
  const baseUrl = process.env.OAI_BASE_URL ?? requestUrl.replace(/\?.*$/, '');
  return {
    baseUrl,
    config: {
      repoName: process.env.OAI_REPO_NAME ?? 'ESUT Digital Repository',
      baseUrl,
      adminEmail: process.env.OAI_ADMIN_EMAIL ?? 'library@esut.edu.ng',
      authority: process.env.OAI_AUTHORITY ?? resolveAuthority(baseUrl),
      protocolVersion: '2.0',
      deletedRecord: process.env.OAI_DELETED_RECORD ?? 'no',
      granularity: 'YYYY-MM-DDThh:mm:ssZ',
      earliestDatestamp: null,
    },
    now: Date.now(),
    secret: process.env.OAI_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    ...overrides,
  };
}

export { dateDatestamp };
