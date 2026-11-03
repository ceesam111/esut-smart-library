import { DOMParser, type Document, type Element } from '@xmldom/xmldom';
import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetch, queryUrl } from './http';
import { compactTextArray, doiFromValue, httpUrl, resolveHarvestedItem } from './mapping';

const BASE = 'https://export.arxiv.org/api/query';
const MAX_RESULTS = 20;

interface EntryData {
  title: string | null;
  id: string | null;
  pdfUrl: string | null;
  abstract: string | null;
  authors: string[];
  categories: string[];
  primaryCategory: string | null;
  published: string | null;
  doi: string | null;
}

function childText(node: Element, tagName: string): string | null {
  const found = Array.from(node.children).find((child) => child.tagName === tagName);
  if (found && found.textContent) return found.textContent.replace(/\s+/g, ' ').trim() || null;
  return null;
}

function attrValue(el: Element, name: string): string | null {
  const value = el.getAttribute(name);
  return value && value.trim() ? value.trim() : null;
}

function parseEntry(entry: Element): EntryData {
  const title = childText(entry, 'title');
  const id = childText(entry, 'id');
  const published = childText(entry, 'published');
  const summary = childText(entry, 'summary');
  const arxivDoi = childText(entry, 'arxiv:doi');

  let primaryCategory: string | null = null;
  for (const child of Array.from(entry.children)) {
    if (child.tagName === 'arxiv:primary_category') {
      primaryCategory = attrValue(child, 'term');
      break;
    }
  }

  const authors: string[] = [];
  for (const child of Array.from(entry.children)) {
    if (child.tagName === 'author') {
      const nameEl = Array.from(child.children).find((c) => c.tagName === 'name');
      const name = nameEl?.textContent?.replace(/\s+/g, ' ').trim();
      if (name && !authors.includes(name)) authors.push(name);
    }
  }

  const categories: string[] = [];
  for (const child of Array.from(entry.children)) {
    if (child.tagName === 'category') {
      const term = attrValue(child, 'term');
      if (term && !categories.includes(term)) categories.push(term);
    }
  }

  let pdfUrl: string | null = null;
  for (const child of Array.from(entry.children)) {
    if (child.tagName === 'link') {
      const href = attrValue(child, 'href');
      const type = attrValue(child, 'type');
      const rel = attrValue(child, 'rel');
      if (href && (type === 'application/pdf' || rel === 'related') && !pdfUrl) {
        pdfUrl = href;
      }
    }
  }

  return {
    title,
    id,
    pdfUrl: httpUrl(pdfUrl),
    abstract: summary,
    authors,
    categories,
    primaryCategory,
    published,
    doi: doiFromValue(arxivDoi),
  };
}

function yearFromPublished(published?: string | null): number | null {
  if (!published) return null;
  const match = published.match(/(\d{4})/);
  const year = match ? Number.parseInt(match[1], 10) : null;
  return year !== null && year >= 1400 && year <= 2100 ? year : null;
}

function collectEntries(doc: Document, entries: Element[]): void {
  const walk = (el: Element): void => {
    for (const child of Array.from(el.children)) {
      if (child.tagName === 'entry') {
        entries.push(child);
      } else {
        walk(child);
      }
    }
  };
  const root = doc.documentElement;
  if (root) walk(root);
}

export const arxivProvider: AccreditationProvider = {
  id: 'arxiv',
  displayName: 'arXiv',
  homepageUrl: 'https://arxiv.org',
  docsUrl: 'https://info.arxiv.org/help/api/index.html',
  enabled: () => true,
  supportsServerYearFilter: true,
  courtesyDelayMs: 3000,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const from = `${query.yearFrom}01010000`;
    const to = `${query.yearTo}12312359`;
    const searchQuery = `all:${query.searchTerms.join('')} AND submittedDate:[${from} TO ${to}]`;
    const start = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
    const safeStart = Number.isInteger(start) && start >= 0 ? start : 0;
    const outcome = await providerFetch(queryUrl(BASE, {
      search_query: searchQuery,
      start: safeStart,
      max_results: MAX_RESULTS,
    }), { headers: { Accept: 'application/atom+xml' } });
    if (outcome.error) return harvestErrorOutcome(outcome);
    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(outcome.body ?? '', 'text/xml');
    } catch {
      return { items: [], error: 'invalid xml' };
    }
    const entries: Element[] = [];
    collectEntries(doc, entries);
    const items = entries
      .map((entry) => parseEntry(entry))
      .map((data) => {
        if (!data.title || !data.id) return null;
        const year = yearFromPublished(data.published);
        if (year === null || year < query.yearFrom || year > query.yearTo) return null;
        const landing = data.id.startsWith('http') ? data.id.replace(/^https?:\/\/arxiv\.org\/abs\//, 'https://arxiv.org/abs/') : `https://arxiv.org/abs/${data.id}`;
        return resolveHarvestedItem({
          externalId: data.id.replace(/^https?:\/\/arxiv\.org\/abs\//, ''),
          resourceType: 'research_article',
          title: data.title,
          creators: data.authors,
          landingPageUrl: httpUrl(landing) ?? landing,
          publicationDate: data.published ?? undefined,
          publicationYear: year ?? undefined,
          doi: data.doi ?? undefined,
          subjectHeadings: compactTextArray([data.primaryCategory, ...data.categories].filter((c): c is string => Boolean(c))),
          abstractText: data.abstract ?? undefined,
          fullTextUrl: data.pdfUrl ?? undefined,
          openAccess: true,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const nextCursor = items.length === MAX_RESULTS ? String(safeStart + MAX_RESULTS) : null;
    return { items, nextCursor };
  },
};