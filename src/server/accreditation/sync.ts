import {
  ACCREDITATION_YEAR_FROM,
  ACCREDITATION_YEAR_TO,
  accreditationProgrammes,
  programmeBySlug,
  type AccreditationProgramme,
} from '@/data/accreditation/programmes';
import { normalizeDoi, normalizeTitle } from '@/server/resources/normalize';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';
import { assignProgrammes } from './matching';
import { httpUrl } from './providers/mapping';
import { accreditationProviderById, enabledProviders } from './providers';
import type {
  AccreditationProvider,
  AccreditationResourceType,
  AccessState,
  HarvestQuery,
  HarvestedItem,
  ProviderHarvestResult,
  SyncRunSummary,
  SyncStateRow,
  SyncStatus,
  VerificationStatus,
} from './types';

const PAGE_SIZE_CAP = 25;
const DEFAULT_MAX_PER_PROGRAMME_PER_PROVIDER = 50;
const DEFAULT_MAX_PAGES = 4;
const DEFAULT_MAX_REQUESTS = 60;
const MIGRATION_REQUIRED_MESSAGE =
  'Accreditation tables are missing. Apply supabase/migrations/20261030180000_accreditation_resources.sql before running a sync.';

export interface RawMetadata {
  provider: string;
  harvestedAt: string;
  harvestProgramme: string;
}

export interface ResourceWriteValues {
  source_provider: string;
  external_id: string;
  resource_type: AccreditationResourceType;
  title: string;
  creators: string[];
  publisher: string | null;
  publication_date: string | null;
  publication_year: number | null;
  doi: string | null;
  isbn: string | null;
  issn: string | null;
  language: string | null;
  subject_headings: string[];
  abstract_text: string | null;
  landing_page_url: string;
  full_text_url: string | null;
  access_state: AccessState;
  open_access: boolean;
  programmes: string[];
  matched_terms: string[];
  relevance_score: number | null;
  dedupe_key: string;
}

export interface ResourceInsertValues extends ResourceWriteValues {
  verification_status: VerificationStatus;
  raw_metadata: RawMetadata;
  first_indexed_at: string;
  last_synced_at: string;
  is_active: boolean;
}

export interface ResourceRefreshPatch {
  resource_type: AccreditationResourceType;
  title: string;
  creators: string[];
  publisher: string | null;
  publication_date: string | null;
  publication_year: number | null;
  doi: string | null;
  isbn: string | null;
  issn: string | null;
  language: string | null;
  subject_headings: string[];
  abstract_text: string | null;
  landing_page_url: string;
  full_text_url: string | null;
  access_state: AccessState;
  open_access: boolean;
  programmes: string[];
  matched_terms: string[];
  relevance_score: number | null;
  dedupe_key: string;
  raw_metadata: RawMetadata;
  last_synced_at: string;
  is_active: boolean;
}

export interface ResourceMergePatch {
  programmes: string[];
  matched_terms: string[];
  relevance_score: number | null;
  publisher: string | null;
  doi: string | null;
  isbn: string | null;
  issn: string | null;
  language: string | null;
  subject_headings: string[];
  creators: string[];
  abstract_text: string | null;
  full_text_url: string | null;
  access_state: AccessState;
  open_access: boolean;
  last_synced_at: string;
}

export interface ExistingResource {
  id: string;
  source_provider: string;
  external_id: string;
  programmes: string[];
  matched_terms: string[];
  relevance_score: number | null;
  publisher: string | null;
  doi: string | null;
  isbn: string | null;
  issn: string | null;
  language: string | null;
  subject_headings: string[];
  creators: string[];
  abstract_text: string | null;
  full_text_url: string | null;
  access_state: AccessState;
  open_access: boolean;
  is_active: boolean;
}

export interface CheckpointState {
  provider: string;
  programme_slug: string;
  cursor: string | null;
  last_run_at: string;
  last_status: SyncStatus;
  records_fetched: number;
  records_upserted: number;
  last_error: string | null;
}

export interface SyncRepository {
  loadCheckpoint(provider: string, programmeSlug: string): Promise<SyncStateRow | null>;
  saveCheckpoint(state: CheckpointState): Promise<void>;
  findExisting(provider: string, externalId: string): Promise<ExistingResource | null>;
  findByDedupeKey(dedupeKey: string): Promise<ExistingResource | null>;
  insertRecord(values: ResourceInsertValues): Promise<void>;
  updateRecord(id: string, patch: ResourceRefreshPatch | ResourceMergePatch): Promise<void>;
}

export const buildDedupeKey = (item: {
  doi?: string | null;
  title: string;
  publicationYear?: number | null;
  creators: string[];
}): string => {
  const doi = normalizeDoi(item.doi ?? null);
  if (doi) return `doi:${doi}`;
  const firstAuthor = (item.creators[0] ?? '').trim().toLowerCase();
  const surname = firstAuthor.split(/\s+/).filter(Boolean).pop()?.replace(/[^a-z]/g, '') ?? '';
  return `title:${normalizeTitle(item.title)}|${item.publicationYear ?? ''}|${surname}`;
};

export interface PrepareContext {
  providerId: string;
  programmeSlug: string;
  yearFrom: number;
  yearTo: number;
}

export const prepareRecord = (
  item: HarvestedItem,
  ctx: PrepareContext,
): ResourceWriteValues | null => {
  const year = item.publicationYear ?? null;
  if (year === null || year < ctx.yearFrom || year > ctx.yearTo) return null;
  const title = item.title.trim();
  if (!title) return null;
  const externalId = item.externalId.trim();
  if (!externalId) return null;
  const landingPageUrl = httpUrl(item.landingPageUrl);
  if (!landingPageUrl) return null;
  const fullTextUrl = httpUrl(item.fullTextUrl);
  const abstractText = item.abstractText?.trim() || null;
  const accessState: AccessState = fullTextUrl
    ? 'full_text'
    : abstractText
      ? 'abstract_only'
      : 'metadata_only';
  const openAccess = item.openAccess || Boolean(fullTextUrl);
  const creators = item.creators.map((creator) => creator.trim()).filter(Boolean);
  const subjectHeadings = item.subjectHeadings.map((heading) => heading.trim()).filter(Boolean);
  const scored = assignProgrammes({ title, subjectHeadings, abstractText });
  const programmes = [...new Set([ctx.programmeSlug, ...scored.programmes])];
  const doi = normalizeDoi(item.doi ?? null);
  return {
    source_provider: ctx.providerId,
    external_id: externalId,
    resource_type: item.resourceType,
    title,
    creators,
    publisher: item.publisher?.trim() || null,
    publication_date: item.publicationDate?.trim() || null,
    publication_year: year,
    doi,
    isbn: item.isbn?.trim() || null,
    issn: item.issn?.trim() || null,
    language: item.language?.trim() || null,
    subject_headings: subjectHeadings,
    abstract_text: abstractText,
    landing_page_url: landingPageUrl,
    full_text_url: fullTextUrl,
    access_state: accessState,
    open_access: openAccess,
    programmes,
    matched_terms: scored.matchedTerms,
    relevance_score: scored.relevanceScore,
    dedupe_key: buildDedupeKey({ doi, title, publicationYear: year, creators }),
  };
};

const unionStrings = (left: string[], right: string[]): string[] => [
  ...new Set([...left, ...right]),
];

const upsertPrepared = async (
  repo: SyncRepository,
  values: ResourceWriteValues,
  provenance: { harvestProgramme: string; harvestedAt: string },
): Promise<void> => {
  const rawMetadata: RawMetadata = {
    provider: values.source_provider,
    harvestedAt: provenance.harvestedAt,
    harvestProgramme: provenance.harvestProgramme,
  };
  const existing = await repo.findExisting(values.source_provider, values.external_id);
  if (existing) {
    await repo.updateRecord(existing.id, {
      resource_type: values.resource_type,
      title: values.title,
      creators: values.creators,
      publisher: values.publisher,
      publication_date: values.publication_date,
      publication_year: values.publication_year,
      doi: values.doi,
      isbn: values.isbn,
      issn: values.issn,
      language: values.language,
      subject_headings: values.subject_headings,
      abstract_text: values.abstract_text,
      landing_page_url: values.landing_page_url,
      full_text_url: values.full_text_url,
      access_state: values.access_state,
      open_access: values.open_access,
      programmes: unionStrings(existing.programmes, values.programmes),
      matched_terms: unionStrings(existing.matched_terms, values.matched_terms),
      relevance_score: Math.max(existing.relevance_score ?? 0, values.relevance_score ?? 0),
      dedupe_key: values.dedupe_key,
      raw_metadata: rawMetadata,
      last_synced_at: provenance.harvestedAt,
      is_active: true,
    });
    return;
  }
  const duplicate = await repo.findByDedupeKey(values.dedupe_key);
  if (duplicate) {
    const fullTextUrl = duplicate.full_text_url ?? values.full_text_url;
    const abstractText = duplicate.abstract_text ?? values.abstract_text;
    const accessState: AccessState = fullTextUrl
      ? 'full_text'
      : abstractText
        ? 'abstract_only'
        : 'metadata_only';
    await repo.updateRecord(duplicate.id, {
      programmes: unionStrings(duplicate.programmes, values.programmes),
      matched_terms: unionStrings(duplicate.matched_terms, values.matched_terms),
      relevance_score: Math.max(duplicate.relevance_score ?? 0, values.relevance_score ?? 0),
      publisher: duplicate.publisher ?? values.publisher,
      doi: duplicate.doi ?? values.doi,
      isbn: duplicate.isbn ?? values.isbn,
      issn: duplicate.issn ?? values.issn,
      language: duplicate.language ?? values.language,
      subject_headings:
        duplicate.subject_headings.length > 0 ? duplicate.subject_headings : values.subject_headings,
      creators: duplicate.creators.length > 0 ? duplicate.creators : values.creators,
      abstract_text: abstractText,
      full_text_url: fullTextUrl,
      access_state: accessState,
      open_access: duplicate.open_access || values.open_access || Boolean(fullTextUrl),
      last_synced_at: provenance.harvestedAt,
    });
    return;
  }
  await repo.insertRecord({
    ...values,
    verification_status: 'unverified',
    raw_metadata: rawMetadata,
    first_indexed_at: provenance.harvestedAt,
    last_synced_at: provenance.harvestedAt,
    is_active: true,
  });
};

export interface SyncRunOptions {
  providerIds?: string[];
  programmeSlugs?: string[];
  maxPerProgrammePerProvider?: number;
  maxPages?: number;
  maxRequests?: number;
  yearFrom?: number;
  yearTo?: number;
  resume?: boolean;
}

export interface SyncRunDeps {
  repo?: SyncRepository;
  providers?: AccreditationProvider[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface SyncRunOutcome {
  summaries: SyncRunSummary[];
  requestsMade: number;
  elapsedMs: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.floor(value), min), max);

const resolveProviders = (
  requested: string[] | undefined,
  registry: AccreditationProvider[] | undefined,
): AccreditationProvider[] => {
  const pool = registry ?? enabledProviders();
  if (!requested || requested.length === 0) {
    return registry ? pool.filter((provider) => {
      try {
        return provider.enabled();
      } catch {
        return false;
      }
    }) : pool;
  }
  return requested.map((id) => {
    const provider = pool.find((entry) => entry.id === id) ?? accreditationProviderById(id);
    if (!provider) throw new Error(`Unknown provider id: ${id}`);
    return provider;
  });
};

const resolveProgrammes = (requested: string[] | undefined): AccreditationProgramme[] => {
  if (!requested || requested.length === 0) return accreditationProgrammes;
  return requested.map((slug) => {
    const programme = programmeBySlug(slug);
    if (!programme) throw new Error(`Unknown programme slug: ${slug}`);
    return programme;
  });
};

interface ComboBudget {
  used: number;
  max: number;
}

interface ComboContext {
  repo: SyncRepository;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  yearFrom: number;
  yearTo: number;
  maxPer: number;
  maxPages: number;
  budget: ComboBudget;
}

const syncCombo = async (
  provider: AccreditationProvider,
  programme: AccreditationProgramme,
  ctx: ComboContext,
  resume: boolean,
): Promise<{ summary: SyncRunSummary; rateLimited: boolean }> => {
  const { repo, sleep, now, yearFrom, yearTo, maxPer, maxPages, budget } = ctx;
  const checkpoint = resume ? await repo.loadCheckpoint(provider.id, programme.slug) : null;
  let cursor: string | null = resume ? (checkpoint?.cursor ?? null) : null;
  let fetched = 0;
  let upserted = 0;
  let pages = 0;
  let status: SyncStatus = 'ok';
  let errorMessage: string | undefined;

  while (pages < maxPages && fetched < maxPer && budget.used < budget.max) {
    const limit = Math.min(PAGE_SIZE_CAP, maxPer - fetched);
    const query: HarvestQuery = {
      programmeSlug: programme.slug,
      searchTerms: programme.searchTerms,
      yearFrom,
      yearTo,
      limit,
      cursor,
    };
    budget.used += 1;
    let result: ProviderHarvestResult;
    try {
      result = await provider.harvest(query);
    } catch (caught) {
      result = {
        items: [],
        error: caught instanceof Error ? caught.message : 'provider threw unexpectedly',
      };
    }

    if (result.error) {
      const rateLimited = Boolean(result.rateLimitedUntil) || result.error === 'rate limited';
      status = rateLimited ? 'rate_limited' : 'error';
      errorMessage = result.rateLimitedUntil
        ? `rate limited until ${result.rateLimitedUntil}`
        : result.error;
      await repo.saveCheckpoint({
        provider: provider.id,
        programme_slug: programme.slug,
        cursor,
        last_run_at: now().toISOString(),
        last_status: status,
        records_fetched: fetched,
        records_upserted: upserted,
        last_error: errorMessage,
      });
      return {
        summary: {
          provider: provider.id,
          programmeSlug: programme.slug,
          fetched,
          upserted,
          status,
          error: errorMessage,
        },
        rateLimited,
      };
    }

    const harvestedAt = now().toISOString();
    for (const item of result.items) {
      const prepared = prepareRecord(item, {
        providerId: provider.id,
        programmeSlug: programme.slug,
        yearFrom,
        yearTo,
      });
      if (!prepared) continue;
      await upsertPrepared(repo, prepared, { harvestProgramme: programme.slug, harvestedAt });
      upserted += 1;
    }
    fetched += result.items.length;
    pages += 1;
    cursor = result.nextCursor ?? null;
    await repo.saveCheckpoint({
      provider: provider.id,
      programme_slug: programme.slug,
      cursor,
      last_run_at: harvestedAt,
      last_status: 'ok',
      records_fetched: fetched,
      records_upserted: upserted,
      last_error: null,
    });
    if (cursor === null) break;
    if (provider.courtesyDelayMs) await sleep(provider.courtesyDelayMs);
  }

  return {
    summary: {
      provider: provider.id,
      programmeSlug: programme.slug,
      fetched,
      upserted,
      status,
      ...(errorMessage ? { error: errorMessage } : {}),
    },
    rateLimited: false,
  };
};

export const runAccreditationSync = async (
  options: SyncRunOptions = {},
  deps: SyncRunDeps = {},
): Promise<SyncRunOutcome> => {
  const startedAt = Date.now();
  const repo = deps.repo ?? createSupabaseSyncRepository();
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? (() => new Date());
  const yearFrom = options.yearFrom ?? ACCREDITATION_YEAR_FROM;
  const yearTo = options.yearTo ?? ACCREDITATION_YEAR_TO;
  const maxPer = clampInt(options.maxPerProgrammePerProvider ?? DEFAULT_MAX_PER_PROGRAMME_PER_PROVIDER, 1, 200);
  const maxPages = clampInt(options.maxPages ?? DEFAULT_MAX_PAGES, 1, 20);
  const budget: ComboBudget = {
    used: 0,
    max: clampInt(options.maxRequests ?? DEFAULT_MAX_REQUESTS, 1, 300),
  };
  const resume = options.resume !== false;
  const providers = resolveProviders(options.providerIds, deps.providers);
  const programmes = resolveProgrammes(options.programmeSlugs);
  const ctx: ComboContext = { repo, sleep, now, yearFrom, yearTo, maxPer, maxPages, budget };
  const summaries: SyncRunSummary[] = [];
  const rateLimitedProviders = new Set<string>();

  for (const provider of providers) {
    if (budget.used >= budget.max) break;
    for (const programme of programmes) {
      if (rateLimitedProviders.has(provider.id)) {
        summaries.push({
          provider: provider.id,
          programmeSlug: programme.slug,
          fetched: 0,
          upserted: 0,
          status: 'rate_limited',
          error: 'skipped: provider rate limited earlier in this run',
        });
        continue;
      }
      const combo = await syncCombo(provider, programme, ctx, resume);
      summaries.push(combo.summary);
      if (combo.rateLimited) rateLimitedProviders.add(provider.id);
      if (budget.used >= budget.max) break;
    }
  }

  return {
    summaries,
    requestsMade: budget.used,
    elapsedMs: Date.now() - startedAt,
  };
};

const EXISTING_COLUMNS =
  'id,source_provider,external_id,programmes,matched_terms,relevance_score,publisher,doi,isbn,issn,language,subject_headings,creators,abstract_text,full_text_url,access_state,open_access,is_active';

export const createSupabaseSyncRepository = (): SyncRepository => {
  const supabase = getSupabaseAdminClient();
  return {
    async loadCheckpoint(provider, programmeSlug) {
      const { data, error } = await supabase
        .from('resource_sync_state')
        .select(
          'provider,programme_slug,cursor,last_run_at,last_status,records_fetched,records_upserted,last_error,updated_at',
        )
        .eq('provider', provider)
        .eq('programme_slug', programmeSlug)
        .maybeSingle();
      if (error) {
        if (isMissingSchemaError(error)) return null;
        throw new Error(error.message);
      }
      return (data as SyncStateRow | null) ?? null;
    },
    async saveCheckpoint(state) {
      const { error } = await supabase
        .from('resource_sync_state')
        .upsert({ ...state, updated_at: new Date().toISOString() }, {
          onConflict: 'provider,programme_slug',
        });
      if (error && !isMissingSchemaError(error)) throw new Error(error.message);
    },
    async findExisting(provider, externalId) {
      const { data, error } = await supabase
        .from('scholarly_resources')
        .select(EXISTING_COLUMNS)
        .eq('source_provider', provider)
        .eq('external_id', externalId)
        .maybeSingle();
      if (error) {
        if (isMissingSchemaError(error)) return null;
        throw new Error(error.message);
      }
      return (data as ExistingResource | null) ?? null;
    },
    async findByDedupeKey(dedupeKey) {
      const { data, error } = await supabase
        .from('scholarly_resources')
        .select(EXISTING_COLUMNS)
        .eq('dedupe_key', dedupeKey)
        .limit(1)
        .maybeSingle();
      if (error) {
        if (isMissingSchemaError(error)) return null;
        throw new Error(error.message);
      }
      return (data as ExistingResource | null) ?? null;
    },
    async insertRecord(values) {
      const { error } = await supabase.from('scholarly_resources').insert(values);
      if (error) {
        if (isMissingSchemaError(error)) throw new Error(MIGRATION_REQUIRED_MESSAGE);
        throw new Error(error.message);
      }
    },
    async updateRecord(id, patch) {
      const { error } = await supabase.from('scholarly_resources').update(patch).eq('id', id);
      if (error) {
        if (isMissingSchemaError(error)) throw new Error(MIGRATION_REQUIRED_MESSAGE);
        throw new Error(error.message);
      }
    },
  };
};
