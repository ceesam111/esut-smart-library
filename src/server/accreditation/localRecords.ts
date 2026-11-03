import { accreditationProgrammes, type AccreditationProgramme } from '@/data/accreditation/programmes';
import type { PortalResourceItem } from '@/lib/accreditationApi';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { PROGRAMME_MATCH_THRESHOLD, scoreRecordForProgramme } from './matching';

const LOCAL_ROW_CAP = 3000;

interface CatalogueRow {
  id: string;
  title: string;
  authors: unknown;
  doi: string | null;
  publisher: string | null;
  year: number | null;
  subjects: unknown;
  abstract: string | null;
  format: string | null;
  call_number: string | null;
  language: string | null;
  source_url: string | null;
}

interface RepositoryRow {
  id: string;
  title: string;
  authors: unknown;
  doi: string | null;
  year: number | null;
  item_type: string | null;
  keywords: unknown;
  language: string | null;
  abstract: string | null;
  file_url: string | null;
  visibility: string;
}

export const normaliseAuthorList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          if (typeof record.name === 'string') return record.name;
          if (typeof record.full_name === 'string') return record.full_name;
          const given = typeof record.given === 'string' ? record.given : '';
          const family = typeof record.family === 'string' ? record.family : '';
          const joined = `${given} ${family}`.trim();
          return joined || null;
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry && entry.trim()));
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const normaliseSubjectList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          if (typeof record.label === 'string') return record.label;
          if (typeof record.name === 'string') return record.name;
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry && entry.trim()));
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

export const mapCatalogueResourceType = (format: string | null, sourceUrl: string | null): string => {
  const raw = (format ?? '').toLowerCase();
  if (/e-?book|ebook|digital|electronic|online|pdf/.test(raw)) return 'ebook';
  if (sourceUrl && /e-?book|ebook|online|digital/.test(sourceUrl.toLowerCase())) return 'ebook';
  if (/journal|serial|periodical/.test(raw)) return 'ejournal';
  if (/thesis|dissertation/.test(raw)) return 'thesis';
  if (/dataset|data/.test(raw)) return 'dataset';
  if (/report/.test(raw)) return 'report';
  return 'print_holding';
};

export const mapRepositoryResourceType = (itemType: string | null): string => {
  const raw = (itemType ?? '').toLowerCase();
  if (raw.includes('thesis') || raw.includes('dissertation')) return 'thesis';
  if (raw.includes('book')) return 'ebook';
  if (raw.includes('report')) return 'report';
  if (raw.includes('dataset') || raw.includes('data')) return 'dataset';
  if (raw.includes('preprint')) return 'research_article';
  if (raw.includes('article')) return 'research_article';
  return 'research_article';
};

const scoreAgainstProgrammes = (
  record: { title: string; subjectHeadings: string[]; abstractText?: string | null },
  programmeFilter?: AccreditationProgramme,
): { programmes: string[]; matchedTerms: string[]; score: number } => {
  const candidates = programmeFilter ? [programmeFilter] : accreditationProgrammes;
  const programmes: string[] = [];
  const matchedTerms = new Set<string>();
  let best = 0;
  for (const programme of candidates) {
    const outcome = scoreRecordForProgramme(record, programme);
    if (outcome.score >= PROGRAMME_MATCH_THRESHOLD) {
      programmes.push(programme.slug);
      for (const term of outcome.matchedTerms) matchedTerms.add(term);
      if (outcome.score > best) best = outcome.score;
    }
  }
  if (!programmeFilter) {
    return { programmes, matchedTerms: [...matchedTerms], score: best };
  }
  return { programmes, matchedTerms: [...matchedTerms], score: best };
};

export const loadLocalRecords = async (
  programmeSlug?: string,
): Promise<{ items: PortalResourceItem[]; schemaAvailable: boolean }> => {
  const supabase = getSupabaseAdminClient();
  const { tenantId } = await resolveTenant();

  const [catalogue, repository] = await Promise.all([
    supabase
      .from('catalogue_items')
      .select('id,title,authors,doi,publisher,year,subjects,abstract,format,call_number,language,source_url')
      .eq('tenant_id', tenantId)
      .limit(LOCAL_ROW_CAP),
    supabase
      .from('repository_items')
      .select('id,title,authors,doi,year,item_type,keywords,language,abstract,file_url,visibility')
      .eq('status', 'published')
      .eq('visibility', 'global')
      .limit(LOCAL_ROW_CAP),
  ]);

  if (catalogue.error && !isMissingSchemaError(catalogue.error)) throw new Error(catalogue.error.message);
  if (repository.error && !isMissingSchemaError(repository.error)) throw new Error(repository.error.message);

  const programmeFilter = programmeSlug
    ? accreditationProgrammes.find((programme) => programme.slug === programmeSlug)
    : undefined;
  if (programmeSlug && !programmeFilter) return { items: [], schemaAvailable: true };

  const items: PortalResourceItem[] = [];

  for (const row of (catalogue.data ?? []) as CatalogueRow[]) {
    const subjects = normaliseSubjectList(row.subjects);
    const scored = scoreAgainstProgrammes(
      { title: row.title, subjectHeadings: subjects, abstractText: row.abstract },
      programmeFilter,
    );
    if (scored.programmes.length === 0) continue;
    items.push({
      key: `catalogue:${row.id}`,
      recordSource: 'catalogue',
      sourceProvider: null,
      sourceLabel: 'Library catalogue',
      resourceType: mapCatalogueResourceType(row.format, row.source_url),
      title: row.title,
      creators: normaliseAuthorList(row.authors),
      year: row.year,
      publisher: row.publisher,
      doi: row.doi ?? null,
      abstract: row.abstract,
      subjects,
      landingUrl: `/catalogue/${row.id}`,
      fullTextUrl: null,
      accessState: 'local_holdings',
      openAccess: false,
      verification: null,
      availability: { callNumber: row.call_number, shelfLocation: null },
      relevanceScore: scored.score,
      matchedTerms: scored.matchedTerms,
    });
  }

  for (const row of (repository.data ?? []) as RepositoryRow[]) {
    const keywords = normaliseSubjectList(row.keywords);
    const scored = scoreAgainstProgrammes(
      { title: row.title, subjectHeadings: keywords, abstractText: row.abstract },
      programmeFilter,
    );
    if (scored.programmes.length === 0) continue;
    items.push({
      key: `repository:${row.id}`,
      recordSource: 'repository',
      sourceProvider: null,
      sourceLabel: 'Institutional repository',
      resourceType: mapRepositoryResourceType(row.item_type),
      title: row.title,
      creators: normaliseAuthorList(row.authors),
      year: row.year,
      publisher: null,
      doi: row.doi ?? null,
      abstract: row.abstract,
      subjects: keywords,
      landingUrl: `/repository/${row.id}`,
      fullTextUrl: null,
      accessState: 'local_holdings',
      openAccess: false,
      verification: null,
      availability: null,
      relevanceScore: scored.score,
      matchedTerms: scored.matchedTerms,
    });
  }

  const schemaAvailable =
    !catalogue.error || isMissingSchemaError(catalogue.error) ? true : true;

  return { items, schemaAvailable };
};
