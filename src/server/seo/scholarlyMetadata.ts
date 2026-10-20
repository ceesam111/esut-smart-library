import type { Metadata } from 'next';

export interface ScholarlyItem {
  id: string;
  handle: string | null;
  title: string;
  authors: unknown;
  abstract: string | null;
  keywords: unknown;
  type: string | null;
  item_type?: string | null;
  doi: string | null;
  license: string | null;
  year: number | null;
  department: string | null;
  faculty_code: string | null;
  language: string | null;
  file_url: string | null;
  orcid_ids?: unknown;
  created_at: string | null;
  landing_path?: string;
}

const FALLBACK_BASE = 'https://virtuallibrary.esut.edu.ng';

export function appBaseUrl(): string {
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || FALLBACK_BASE;
  return base.replace(/\/+$/, '');
}

export function normalizeNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) =>
      typeof entry === 'string'
        ? entry
        : String((entry as { name?: unknown })?.name ?? '')
    )
    .map((name) => name.trim())
    .filter(Boolean);
}

export function repositoryItemUrl(item: { id: string; handle?: string | null; landing_path?: string }): string {
  if (item.landing_path) return `${appBaseUrl()}${item.landing_path}`;
  return `${appBaseUrl()}/repository/${encodeURIComponent(item.id)}`;
}

export function isPubliclyIndexable(item: {
  status?: string | null;
  visibility?: string | null;
  embargo_until?: string | null;
}): boolean {
  if ((item.status ?? '') !== 'published') return false;
  if ((item.visibility ?? '') !== 'global') return false;
  if (item.embargo_until) {
    const embargo = new Date(item.embargo_until);
    if (!Number.isNaN(embargo.getTime()) && embargo.getTime() > Date.now()) return false;
  }
  return true;
}

function scholarlyType(item: ScholarlyItem): string {
  const type = `${item.item_type ?? ''} ${item.type ?? ''}`.toLowerCase();
  if (type.includes('thesis') || type.includes('dissertation')) return 'Thesis';
  if (type.includes('dataset')) return 'Dataset';
  if (type.includes('book') || type.includes('chapter')) return 'Chapter';
  if (type.includes('report') || type.includes('preprint')) return 'Report';
  return 'ScholarlyArticle';
}

function publicationYear(item: ScholarlyItem): string | undefined {
  if (item.year) return String(item.year);
  if (item.created_at) {
    const parsed = new Date(item.created_at);
    if (!Number.isNaN(parsed.getTime())) return String(parsed.getUTCFullYear());
  }
  return undefined;
}

function publicPdfUrl(item: ScholarlyItem): string | null {
  const url = (item.file_url ?? '').trim();
  if (!url.startsWith('https://')) return null;
  if (/token=|expires=|signature=/i.test(url)) return null;
  return url;
}

function authorEntities(item: ScholarlyItem): Array<Record<string, unknown>> {
  const names = normalizeNames(item.authors);
  const orcids = Array.isArray(item.orcid_ids)
    ? item.orcid_ids.map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];
  return names.map((name, index) => {
    const entity: Record<string, unknown> = { '@type': 'Person', name };
    if (orcids[index]) entity.identifier = `https://orcid.org/${orcids[index]}`;
    if (item.department || item.faculty_code) {
      entity.affiliation = {
        '@type': 'Organization',
        name: [item.department, item.faculty_code, 'ESUT'].filter(Boolean).join(', '),
      };
    }
    return entity;
  });
}

export function buildScholarlyMetadata(item: ScholarlyItem): Metadata {
  const url = repositoryItemUrl(item);
  const authors = normalizeNames(item.authors);
  const keywords = [...new Set([...normalizeNames(item.keywords)])];
  const year = publicationYear(item);
  const pdfUrl = publicPdfUrl(item);

  const other: Record<string, string | string[]> = {
    citation_title: item.title,
    citation_publisher: 'ESUT Library',
    citation_language: item.language ?? 'English',
  };
  if (authors.length > 0) other.citation_author = authors;
  if (year) other.citation_publication_date = year;
  if (item.doi) other.citation_doi = item.doi;
  if (item.license) other.citation_rights = item.license;
  if (pdfUrl) other.citation_pdf_url = pdfUrl;

  return {
    title: item.title,
    description: item.abstract ?? item.title,
    keywords: keywords.length > 0 ? keywords : undefined,
    alternates: { canonical: url },
    other,
    openGraph: {
      title: item.title,
      description: item.abstract ?? item.title,
      url,
      type: 'article',
      publishedTime: item.created_at ?? undefined,
      authors: authors.length > 0 ? authors : undefined,
      siteName: 'ESUT Virtual Library',
    },
  };
}

export function buildScholarlyJsonLd(item: ScholarlyItem): Record<string, unknown> {
  const url = repositoryItemUrl(item);
  const year = publicationYear(item);
  const pdfUrl = publicPdfUrl(item);
  const doi = item.doi ?? undefined;
  const identifier = doi ? `https://doi.org/${doi}` : url;
  const keywords = [...new Set([...normalizeNames(item.keywords)])];

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': scholarlyType(item),
    identifier,
    name: item.title,
    headline: item.title,
    url,
    abstract: item.abstract ?? undefined,
    keywords: keywords.length > 0 ? keywords.join(', ') : undefined,
    inLanguage: item.language ?? 'English',
    datePublished: year,
    isAccessibleForFree: Boolean(pdfUrl),
    license: item.license ?? undefined,
    author: authorEntities(item),
    publisher: {
      '@type': 'Organization',
      name: 'ESUT Library',
      url: appBaseUrl(),
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
  if (doi) data.sameAs = `https://doi.org/${doi}`;
  if (pdfUrl) data.encoding = { '@type': 'MediaObject', contentUrl: pdfUrl, encodingFormat: 'application/pdf' };

  Object.keys(data).forEach((key) => {
    if (data[key] === undefined) delete data[key];
  });
  return data;
}

export function toJsonLdHtml(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
