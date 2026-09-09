import type { CandidateConfidence, ResourceCandidate } from './types';

export function normalizeIdentifier(value?: string | null) {
  return value?.trim().replace(/^ISBN(?:-1[03])?\s*:?\s*/i, '').replace(/^doi:\s*/i, '').replace(/[\s-]+/g, '') || null;
}

export function normalizeDoi(value?: string | null) {
  return value?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:/i, '').toLowerCase() || null;
}

export function normalizeTitle(value?: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() || '';
}

export function normalizeAuthors(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'string' ? item : String((item as { name?: unknown })?.name ?? '')).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof value === 'string') return value.split(/;|,/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return [];
}

export function compactTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))].slice(0, 20);
}

export function classifyConfidence(candidate: ResourceCandidate, query?: string | null): CandidateConfidence {
  if (!candidate.title && !candidate.isbn && !candidate.doi) return 'no_match';
  if (candidate.isbn || candidate.doi) return 'clean_match';
  if (query && candidate.title && normalizeTitle(candidate.title).includes(normalizeTitle(query))) return 'clean_match';
  return 'needs_review';
}

export function normalizeCandidate(candidate: ResourceCandidate, query?: string | null): ResourceCandidate {
  const doi = normalizeDoi(candidate.doi);
  const isbn = normalizeIdentifier(candidate.isbn);
  const issn = normalizeIdentifier(candidate.issn);
  return {
    ...candidate,
    source_name: candidate.source_name,
    source_record_id: candidate.source_record_id?.trim() || null,
    title: candidate.title?.trim() || null,
    authors: normalizeAuthors(candidate.authors),
    subjects: compactTextArray(candidate.subjects),
    publisher: candidate.publisher?.trim() || null,
    year: candidate.year && candidate.year > 0 ? candidate.year : null,
    language: candidate.language?.trim() || null,
    description: candidate.description?.trim() || null,
    isbn,
    issn,
    doi,
    item_type: candidate.item_type?.trim() || 'book',
    licence: candidate.licence?.trim() || null,
    rights_status: candidate.rights_status || null,
    source_url: candidate.source_url || null,
    download_url: candidate.download_url || null,
    cover_url: candidate.cover_url || null,
    confidence: candidate.confidence || classifyConfidence(candidate, query),
    raw_metadata: candidate.raw_metadata || {},
  };
}

export function safeResourcePathPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'resource';
}
