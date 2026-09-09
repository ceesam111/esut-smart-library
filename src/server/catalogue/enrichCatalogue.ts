import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type { CatalogueConfidence, NormalizedCatalogueRow } from './importValidation';

export interface CatalogueEnrichment {
  title?: string | null;
  authors?: string[];
  publisher?: string | null;
  year?: number | null;
  subjects?: string[];
  cover_url?: string | null;
  language?: string | null;
  source?: string;
}

export interface EnrichmentResult {
  data: CatalogueEnrichment;
  confidence: CatalogueConfidence;
}

function cleanList(values: unknown[]) {
  return values.map((value) => String(value).trim()).filter(Boolean);
}

async function lookupOpenLibrary(isbn: string): Promise<CatalogueEnrichment | null> {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = await res.json();
  const item = json[`ISBN:${isbn}`];
  if (!item) return null;
  return {
    title: item.title ?? null,
    authors: cleanList((item.authors ?? []).map((author: { name?: string }) => author.name)),
    publisher: item.publishers?.[0]?.name ?? null,
    year: parseInt(String(item.publish_date ?? '').match(/\d{4}/)?.[0] ?? '', 10) || null,
    subjects: cleanList((item.subjects ?? []).slice(0, 8).map((subject: { name?: string }) => subject.name)),
    cover_url: item.cover?.medium ?? item.cover?.large ?? item.cover?.small ?? null,
    language: item.languages?.[0]?.name ?? null,
    source: 'open_library',
  };
}

async function lookupGoogleBooks(isbn: string): Promise<CatalogueEnrichment | null> {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = await res.json();
  const info = json.items?.[0]?.volumeInfo;
  if (!info) return null;
  return {
    title: info.title ?? null,
    authors: cleanList(info.authors ?? []),
    publisher: info.publisher ?? null,
    year: parseInt(String(info.publishedDate ?? '').match(/\d{4}/)?.[0] ?? '', 10) || null,
    subjects: cleanList(info.categories ?? []),
    cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
    language: info.language ?? null,
    source: 'google_books',
  };
}

function compareConfidence(row: NormalizedCatalogueRow, enrichment: CatalogueEnrichment | null): CatalogueConfidence {
  if (!enrichment) return 'no_match';
  const conflicts: string[] = [];
  if (row.title && enrichment.title && row.title.toLowerCase() !== enrichment.title.toLowerCase()) conflicts.push('title');
  if (row.publisher && enrichment.publisher && row.publisher.toLowerCase() !== enrichment.publisher.toLowerCase()) conflicts.push('publisher');
  if (row.year && enrichment.year && row.year !== enrichment.year) conflicts.push('year');
  if (conflicts.length > 0) return 'conflict';
  if (!row.title || row.authors.length === 0 || !row.publisher || !row.year || row.subjects.length === 0) return 'needs_review';
  return 'clean_match';
}

export function mergeEnrichment(row: NormalizedCatalogueRow, enrichment: CatalogueEnrichment | null): NormalizedCatalogueRow {
  if (!enrichment) return row;
  return {
    ...row,
    title: row.title || enrichment.title || null,
    authors: row.authors.length ? row.authors : enrichment.authors ?? [],
    publisher: row.publisher || enrichment.publisher || null,
    year: row.year || enrichment.year || null,
    subjects: row.subjects.length ? row.subjects : enrichment.subjects ?? [],
    language: row.language || enrichment.language || null,
  };
}

export async function enrichCatalogueRow(row: NormalizedCatalogueRow): Promise<EnrichmentResult> {
  if (!row.isbn) return { data: {}, confidence: 'needs_review' };

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.functions.invoke('enrich-catalogue', { body: { row } });
    if (!error && data?.data && data?.confidence) {
      return { data: data.data, confidence: data.confidence };
    }
  } catch {
    // Local deterministic fallback keeps development moving before the Edge Function is deployed.
  }

  let data: CatalogueEnrichment | null = null;
  try { data = await lookupOpenLibrary(row.isbn); } catch { data = null; }
  if (!data) {
    try { data = await lookupGoogleBooks(row.isbn); } catch { data = null; }
  }
  return { data: data ?? {}, confidence: compareConfidence(row, data) };
}
