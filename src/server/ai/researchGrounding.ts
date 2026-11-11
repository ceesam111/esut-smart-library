import { searchRepository } from '@/server/search/repositorySearch';

export const GROUNDING_TOP_K = 6;
export const GROUNDING_QUERY_MAX = 300;

export interface GroundedRecord {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string;
}

export interface GroundingResult {
  query: string;
  records: GroundedRecord[];
  total: number;
  degraded: boolean;
  error?: string;
}

function stripControlCharacters(raw: string): string {
  let cleaned = '';
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    cleaned += code < 32 || code === 127 ? ' ' : char;
  }
  return cleaned;
}

export function sanitizeGroundingQuery(raw: string): string {
  return stripControlCharacters(raw).replace(/\s+/g, ' ').trim().slice(0, GROUNDING_QUERY_MAX);
}

export function normalizeAuthors(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(';').map((part) => part.trim()).filter(Boolean).slice(0, 12);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (entry && typeof entry === 'object' && 'name' in entry) {
          const name = (entry as { name?: unknown }).name;
          return typeof name === 'string' ? name.trim() : '';
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

export function toGroundedRecords(items: unknown[]): GroundedRecord[] {
  const records: GroundedRecord[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Untitled record';
    const doi = typeof row.doi === 'string' && row.doi.trim() ? row.doi.trim() : null;
    const year = typeof row.year === 'number' && Number.isFinite(row.year) ? row.year : null;
    records.push({ id, title, authors: normalizeAuthors(row.authors), year, doi, url: `/repository/${id}` });
    if (records.length >= GROUNDING_TOP_K) break;
  }
  return records;
}

export async function retrieveGroundingRecords(question: string): Promise<GroundingResult> {
  const query = sanitizeGroundingQuery(question);
  if (query.length < 3) return { query, records: [], total: 0, degraded: false };
  try {
    const response = await searchRepository({ query, pageSize: GROUNDING_TOP_K, page: 1 });
    return { query, records: toGroundedRecords(response.items), total: response.total, degraded: false };
  } catch (error) {
    return {
      query,
      records: [],
      total: 0,
      degraded: true,
      error: error instanceof Error ? error.message : 'Retrieval failed.',
    };
  }
}

export function buildGroundingBlock(records: GroundedRecord[]): string {
  if (records.length === 0) {
    return 'ESUT repository records for this question: none retrieved. Do not invent ESUT repository records, IDs, DOIs or links; answer from general knowledge and say when ESUT holdings should be checked directly.';
  }
  const lines = records.map((record, index) => {
    const authors = record.authors.length > 0 ? record.authors.join('; ') : 'author not listed';
    const year = record.year ? String(record.year) : 'n.d.';
    const doi = record.doi ? ` DOI:${record.doi}` : '';
    return `[${index + 1}] ${record.title} (${year}). ${authors}.${doi} URL:${record.url}`;
  });
  return [
    'ESUT repository records retrieved for this question (the ONLY records you may cite as ESUT holdings):',
    ...lines,
    'When you use one, cite it inline as [n] and mention its title. Never invent additional ESUT records, IDs, DOIs or URLs. Records not listed above are not in ESUT holdings as far as this search knows.',
  ].join('\n');
}

export function parseCitedRecords(answer: string, records: GroundedRecord[]): GroundedRecord[] {
  const cited: GroundedRecord[] = [];
  const markerPattern = /\[(\d{1,2})\]/g;
  let match: RegExpExecArray | null;
  while ((match = markerPattern.exec(answer)) !== null) {
    const index = Number(match[1]) - 1;
    const record = records[index];
    if (record && !cited.some((entry) => entry.id === record.id)) cited.push(record);
  }
  for (const record of records) {
    if (answer.includes(record.url) && !cited.some((entry) => entry.id === record.id)) cited.push(record);
  }
  return cited;
}

export function formatSourcesFooter(cited: GroundedRecord[]): string {
  if (cited.length === 0) return '';
  const lines = cited.map((record, index) => `${index + 1}. ${record.title} - ${record.url}`);
  return `\n\nESUT repository sources used:\n${lines.join('\n')}`;
}
