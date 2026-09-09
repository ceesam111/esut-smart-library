import type { ResourceAdapter, ResourceCandidate } from './types';
import { fetchJson, fetchText } from './http';

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function first(value: unknown): string | null {
  if (Array.isArray(value)) return text(value[0]);
  return text(value);
}

function yearFrom(value: unknown): number | null {
  const match = String(value ?? '').match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function queryUrl(base: string, params: Record<string, string | number | undefined>) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export const openLibraryAdapter: ResourceAdapter = {
  name: 'Open Library',
  sourceType: 'open_library',
  async search(query, options) {
    const data = await fetchJson<{ docs?: Array<Record<string, unknown>> }>(queryUrl('https://openlibrary.org/search.json', { q: query, limit: options?.limit ?? 10 }), { signal: options?.signal });
    return (data.docs ?? []).map((doc): ResourceCandidate => {
      const key = text(doc.key) || text(doc.cover_edition_key) || text(doc.edition_key);
      const isbn = first(doc.isbn);
      return {
        source_name: 'Open Library',
        source_record_id: key,
        title: text(doc.title),
        authors: Array.isArray(doc.author_name) ? doc.author_name.map(String) : [],
        publisher: first(doc.publisher),
        year: yearFrom(doc.first_publish_year),
        language: first(doc.language),
        subjects: Array.isArray(doc.subject) ? doc.subject.map(String).slice(0, 12) : [],
        isbn,
        item_type: 'book',
        rights_status: 'metadata_only',
        source_url: key ? `https://openlibrary.org${key}` : null,
        cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
        raw_metadata: doc,
      };
    });
  },
};

export const googleBooksAdapter: ResourceAdapter = {
  name: 'Google Books',
  sourceType: 'google_books',
  metadataOnly: true,
  async search(query, options) {
    const data = await fetchJson<{ items?: Array<Record<string, unknown>> }>(queryUrl('https://www.googleapis.com/books/v1/volumes', { q: query, maxResults: options?.limit ?? 10 }), { signal: options?.signal });
    return (data.items ?? []).map((item): ResourceCandidate => {
      const info = (item.volumeInfo ?? {}) as Record<string, unknown>;
      const ids = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers as Array<Record<string, unknown>> : [];
      return {
        source_name: 'Google Books',
        source_record_id: text(item.id),
        title: text(info.title),
        authors: Array.isArray(info.authors) ? info.authors.map(String) : [],
        publisher: text(info.publisher),
        year: yearFrom(info.publishedDate),
        language: text(info.language),
        subjects: Array.isArray(info.categories) ? info.categories.map(String) : [],
        description: text(info.description),
        isbn: text(ids.find((id) => String(id.type).includes('ISBN_13'))?.identifier) || text(ids[0]?.identifier),
        item_type: 'book',
        rights_status: 'metadata_only',
        source_url: text(info.infoLink),
        cover_url: text((info.imageLinks as Record<string, unknown> | undefined)?.thumbnail)?.replace('http:', 'https:'),
        raw_metadata: item,
      };
    });
  },
};

export const doabAdapter: ResourceAdapter = {
  name: 'DOAB',
  sourceType: 'doab',
  async search(query, options) {
    const data = await fetchJson<{ results?: Array<Record<string, unknown>> }>(queryUrl('https://directory.doabooks.org/rest/search', { query, expand: 'metadata', limit: options?.limit ?? 10 }), { signal: options?.signal });
    return (data.results ?? []).map((row): ResourceCandidate => ({
      source_name: 'DOAB',
      source_record_id: text(row.uuid) || text(row.handle),
      title: text(row.name) || text(row.title),
      authors: Array.isArray(row.author) ? row.author.map(String) : [],
      publisher: text(row.publisher),
      year: yearFrom(row.dateIssued ?? row.year),
      subjects: Array.isArray(row.subject) ? row.subject.map(String) : [],
      isbn: first(row.isbn),
      item_type: 'ebook',
      licence: text(row.license) || 'Open Access',
      rights_status: 'open',
      source_url: text(row.url) || (row.handle ? `https://directory.doabooks.org/handle/${row.handle}` : null),
      download_url: text(row.downloadUrl),
      raw_metadata: row,
    }));
  },
};

export const doajAdapter: ResourceAdapter = {
  name: 'DOAJ',
  sourceType: 'doaj',
  async search(query, options) {
    const data = await fetchJson<{ results?: Array<{ bibjson?: Record<string, unknown>; id?: string }> }>(queryUrl('https://doaj.org/api/search/articles/' + encodeURIComponent(query), { pageSize: options?.limit ?? 10 }), { signal: options?.signal });
    return (data.results ?? []).map((row): ResourceCandidate => {
      const bib = row.bibjson ?? {};
      const links = Array.isArray(bib.link) ? bib.link as Array<Record<string, unknown>> : [];
      return {
        source_name: 'DOAJ',
        source_record_id: row.id,
        title: text(bib.title),
        authors: Array.isArray(bib.author) ? bib.author.map((author) => String((author as Record<string, unknown>).name ?? '')).filter(Boolean) : [],
        publisher: text((bib.journal as Record<string, unknown> | undefined)?.publisher),
        year: yearFrom(bib.year),
        subjects: Array.isArray(bib.subject) ? bib.subject.map(String) : [],
        issn: first((bib.journal as Record<string, unknown> | undefined)?.issns),
        doi: first(bib.identifier),
        item_type: 'article',
        licence: first(bib.license) || 'Open Access',
        rights_status: 'open',
        source_url: text(links[0]?.url),
        download_url: text(links.find((link) => String(link.type).toLowerCase().includes('fulltext'))?.url),
        raw_metadata: row,
      };
    });
  },
};

export const openAlexAdapter: ResourceAdapter = {
  name: 'OpenAlex',
  sourceType: 'openalex',
  metadataOnly: true,
  async search(query, options) {
    const data = await fetchJson<{ results?: Array<Record<string, unknown>> }>(queryUrl('https://api.openalex.org/works', { search: query, per_page: options?.limit ?? 10 }), { signal: options?.signal });
    return (data.results ?? []).map((work): ResourceCandidate => {
      const location = work.primary_location as Record<string, unknown> | undefined;
      return {
        source_name: 'OpenAlex',
        source_record_id: text(work.id),
        title: text(work.title),
        authors: Array.isArray(work.authorships) ? work.authorships.map((a) => String(((a as Record<string, unknown>).author as Record<string, unknown> | undefined)?.display_name ?? '')).filter(Boolean) : [],
        publisher: text(work.host_venue),
        year: yearFrom(work.publication_year),
        subjects: Array.isArray(work.concepts) ? work.concepts.map((c) => String((c as Record<string, unknown>).display_name ?? '')).filter(Boolean).slice(0, 10) : [],
        doi: text(work.doi),
        item_type: text(work.type) || 'article',
        rights_status: (work.open_access as Record<string, unknown> | undefined)?.is_oa ? 'open' : 'metadata_only',
        source_url: text(work.id),
        download_url: text((location?.pdf_url as string | undefined) ?? (work.open_access as Record<string, unknown> | undefined)?.oa_url),
        raw_metadata: work,
      };
    });
  },
};

export const crossRefAdapter: ResourceAdapter = {
  name: 'CrossRef',
  sourceType: 'crossref',
  metadataOnly: true,
  async search(query, options) {
    const data = await fetchJson<{ message?: { items?: Array<Record<string, unknown>> } }>(queryUrl('https://api.crossref.org/works', { query, rows: options?.limit ?? 10 }), { signal: options?.signal });
    return (data.message?.items ?? []).map((item): ResourceCandidate => ({
      source_name: 'CrossRef',
      source_record_id: text(item.DOI),
      title: first(item.title),
      authors: Array.isArray(item.author) ? item.author.map((author) => `${(author as Record<string, unknown>).given ?? ''} ${(author as Record<string, unknown>).family ?? ''}`.trim()).filter(Boolean) : [],
      publisher: text(item.publisher),
      year: yearFrom(JSON.stringify(item.published ?? item.issued)),
      subjects: Array.isArray(item.subject) ? item.subject.map(String) : [],
      isbn: first(item.ISBN),
      issn: first(item.ISSN),
      doi: text(item.DOI),
      item_type: text(item.type) || 'article',
      rights_status: 'metadata_only',
      source_url: text(item.URL),
      raw_metadata: item,
    }));
  },
};

export const internetArchiveAdapter: ResourceAdapter = {
  name: 'Internet Archive',
  sourceType: 'internet_archive',
  async search(query, options) {
    const q = `(${query}) AND mediatype:(texts) AND (licenseurl:* OR rights:(publicdomain) OR collection:(opensource))`;
    const data = await fetchJson<{ response?: { docs?: Array<Record<string, unknown>> } }>(queryUrl('https://archive.org/advancedsearch.php', { q, output: 'json', rows: options?.limit ?? 10, fl: 'identifier,title,creator,year,language,subject,licenseurl,rights' }), { signal: options?.signal });
    return (data.response?.docs ?? []).map((doc): ResourceCandidate => {
      const identifier = text(doc.identifier);
      return {
        source_name: 'Internet Archive',
        source_record_id: identifier,
        title: text(doc.title),
        authors: Array.isArray(doc.creator) ? doc.creator.map(String) : doc.creator ? [String(doc.creator)] : [],
        year: yearFrom(doc.year),
        language: first(doc.language),
        subjects: Array.isArray(doc.subject) ? doc.subject.map(String) : [],
        item_type: 'ebook',
        licence: text(doc.licenseurl) || text(doc.rights),
        rights_status: text(doc.rights)?.toLowerCase().includes('public') ? 'public_domain' : 'open',
        source_url: identifier ? `https://archive.org/details/${identifier}` : null,
        download_url: identifier ? `https://archive.org/download/${identifier}/${identifier}.pdf` : null,
        raw_metadata: doc,
      };
    });
  },
};

export const coreAdapter: ResourceAdapter = {
  name: 'CORE',
  sourceType: 'core',
  async search(query, options) {
    if (!options?.apiKey) return [];
    const data = await fetchJson<{ results?: Array<Record<string, unknown>> }>(queryUrl('https://api.core.ac.uk/v3/search/works', { q: query, limit: options.limit ?? 10 }), { signal: options.signal, headers: { Authorization: `Bearer ${options.apiKey}` } });
    return (data.results ?? []).map((work): ResourceCandidate => ({
      source_name: 'CORE',
      source_record_id: text(work.id),
      title: text(work.title),
      authors: Array.isArray(work.authors) ? work.authors.map((a) => String((a as Record<string, unknown>).name ?? a)).filter(Boolean) : [],
      publisher: text(work.publisher),
      year: yearFrom(work.yearPublished ?? work.publishedDate),
      subjects: Array.isArray(work.topics) ? work.topics.map(String) : [],
      description: text(work.abstract),
      doi: text(work.doi),
      item_type: 'article',
      rights_status: work.downloadUrl ? 'open' : 'metadata_only',
      source_url: text(work.sourceFulltextUrls) || text(work.url),
      download_url: text(work.downloadUrl),
      raw_metadata: work,
    }));
  },
};

export const gutenbergAdapter: ResourceAdapter = {
  name: 'Project Gutenberg',
  sourceType: 'gutenberg',
  async search(query, options) {
    const data = await fetchJson<{ results?: Array<Record<string, unknown>> }>(queryUrl('https://gutendex.com/books/', { search: query, languages: 'en', page: 1 }), { signal: options?.signal });
    return (data.results ?? []).slice(0, options?.limit ?? 10).map((book): ResourceCandidate => {
      const formats = (book.formats ?? {}) as Record<string, unknown>;
      const id = text(book.id);
      return {
        source_name: 'Project Gutenberg',
        source_record_id: id,
        title: text(book.title),
        authors: Array.isArray(book.authors) ? book.authors.map((a) => String((a as Record<string, unknown>).name ?? '')).filter(Boolean) : [],
        subjects: Array.isArray(book.subjects) ? book.subjects.map(String) : [],
        language: first(book.languages),
        item_type: 'ebook',
        rights_status: 'public_domain',
        licence: 'Public domain',
        source_url: id ? `https://www.gutenberg.org/ebooks/${id}` : null,
        download_url: text(formats['application/epub+zip']) || text(formats['text/html']) || text(formats['text/plain; charset=us-ascii']),
        cover_url: text(formats['image/jpeg']),
        raw_metadata: book,
      };
    });
  },
};

export const standardEbooksAdapter: ResourceAdapter = {
  name: 'Standard Ebooks',
  sourceType: 'standard_ebooks',
  async search(query, options) {
    const xml = await fetchText('https://standardebooks.org/feeds/opds/all', { signal: options?.signal, timeoutMs: 10000 }).catch(() => '');
    const entries = [...xml.matchAll(/<entry>[\s\S]*?<\/entry>/g)].map((match) => match[0]);
    const q = query.toLowerCase();
    return entries.filter((entry) => entry.toLowerCase().includes(q)).slice(0, options?.limit ?? 10).map((entry): ResourceCandidate => {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? null;
      const author = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/)?.[1]?.trim() ?? null;
      const link = entry.match(/<link[^>]+rel="http:\/\/opds-spec\.org\/acquisition"[^>]+href="([^"]+)"/)?.[1]
        || entry.match(/<link[^>]+href="([^"]+)"/)?.[1]
        || null;
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? link;
      return {
        source_name: 'Standard Ebooks',
        source_record_id: id,
        title,
        authors: author ? [author] : [],
        subjects: [...entry.matchAll(/<category[^>]+term="([^"]+)"/g)].map((m) => m[1]).slice(0, 10),
        language: 'English',
        item_type: 'ebook',
        rights_status: 'public_domain',
        licence: 'Public domain',
        source_url: id?.startsWith('http') ? id : link,
        download_url: link,
        cover_url: entry.match(/<link[^>]+rel="http:\/\/opds-spec\.org\/image"[^>]+href="([^"]+)"/)?.[1] ?? null,
        raw_metadata: { entry },
      };
    });
  },
};

export const pubMedAdapter: ResourceAdapter = {
  name: 'PubMed',
  sourceType: 'pubmed',
  metadataOnly: true,
  async search(query, options) {
    const key = options?.apiKeys?.NCBI_API_KEY ? `&api_key=${options.apiKeys.NCBI_API_KEY}` : '';
    const email = encodeURIComponent(options?.apiKeys?.NCBI_EMAIL || 'library@esut.edu.ng');
    const search = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${options?.limit ?? 10}&tool=ESUTSmartLibrary&email=${email}${key}`, { signal: options?.signal });
    const ids = search.esearchresult?.idlist ?? [];
    if (!ids.length) return [];
    const [summary, abstractsXml] = await Promise.all([
      fetchJson<{ result?: Record<string, any> }>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json&tool=${encodeURIComponent(options?.apiKeys?.NCBI_TOOL || 'ESUTSmartLibrary')}&email=${email}${key}`, { signal: options?.signal }),
      fetchText(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml&tool=${encodeURIComponent(options?.apiKeys?.NCBI_TOOL || 'ESUTSmartLibrary')}&email=${email}${key}`, { signal: options?.signal, timeoutMs: 10000 }).catch(() => ''),
    ]);
    const abstractsById = new Map([...abstractsXml.matchAll(/<PubmedArticle>[\s\S]*?<PMID[^>]*>(\d+)<\/PMID>[\s\S]*?<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>[\s\S]*?<\/PubmedArticle>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()]));
    return ids.map((id): ResourceCandidate | null => {
      const row = summary.result?.[id];
      if (!row) return null;
      return {
        source_name: 'PubMed',
        source_record_id: id,
        title: text(row.title),
        authors: Array.isArray(row.authors) ? row.authors.map((a: Record<string, unknown>) => String(a.name ?? '')).filter(Boolean) : [],
        publisher: text(row.fulljournalname) || text(row.source),
        year: yearFrom(row.pubdate),
        description: abstractsById.get(id) ?? null,
        doi: text(row.elocationid)?.replace(/^doi:\s*/i, '') ?? null,
        issn: text(row.issn),
        item_type: 'article',
        rights_status: 'metadata_only',
        source_url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        raw_metadata: row,
      };
    }).filter(Boolean) as ResourceCandidate[];
  },
};

export const pmcAdapter: ResourceAdapter = {
  name: 'PubMed Central',
  sourceType: 'pmc',
  async search(query, options) {
    const key = options?.apiKeys?.NCBI_API_KEY ? `&api_key=${options.apiKeys.NCBI_API_KEY}` : '';
    const email = encodeURIComponent(options?.apiKeys?.NCBI_EMAIL || 'library@esut.edu.ng');
    const search = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodeURIComponent(query)}&retmode=json&retmax=${options?.limit ?? 10}&tool=ESUTSmartLibrary&email=${email}${key}`, { signal: options?.signal });
    const ids = search.esearchresult?.idlist ?? [];
    if (!ids.length) return [];
    const [summary, fullXml] = await Promise.all([
      fetchJson<{ result?: Record<string, any> }>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=${ids.join(',')}&retmode=json&tool=${encodeURIComponent(options?.apiKeys?.NCBI_TOOL || 'ESUTSmartLibrary')}&email=${email}${key}`, { signal: options?.signal }),
      fetchText(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${ids.join(',')}&retmode=xml&tool=${encodeURIComponent(options?.apiKeys?.NCBI_TOOL || 'ESUTSmartLibrary')}&email=${email}${key}`, { signal: options?.signal, timeoutMs: 10000 }).catch(() => ''),
    ]);
    return ids.map((id): ResourceCandidate | null => {
      const row = summary.result?.[id];
      if (!row) return null;
      const pmcid = `PMC${id}`;
      const hasFullText = fullXml.includes(`<article-id pub-id-type="pmc">${id}</article-id>`) || fullXml.includes(pmcid);
      return {
        source_name: 'PubMed Central',
        source_record_id: pmcid,
        title: text(row.title),
        authors: Array.isArray(row.authors) ? row.authors.map((a: Record<string, unknown>) => String(a.name ?? '')).filter(Boolean) : [],
        publisher: text(row.fulljournalname) || text(row.source),
        year: yearFrom(row.pubdate),
        item_type: 'article',
        rights_status: hasFullText ? 'open' : 'metadata_only',
        licence: 'PMC Open Access / free full text',
        source_url: `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`,
        download_url: hasFullText ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/pdf/` : null,
        raw_metadata: row,
      };
    }).filter(Boolean) as ResourceCandidate[];
  },
};

export const hathiTrustAdapter: ResourceAdapter = {
  name: 'HathiTrust',
  sourceType: 'hathitrust',
  async search(query, options) {
    const identifier = query.match(/(?:isbn[:\s-]*|^)(97[89]\d{10}|\d{9}[\dXx])$/i)?.[1];
    if (!identifier) {
      return [{
        source_name: 'HathiTrust',
        source_record_id: `search:${query}`,
        title: `Search HathiTrust for ${query}`,
        authors: [],
        item_type: 'ebook',
        rights_status: 'metadata_only',
        licence: 'Search result link; rights vary by item',
        source_url: `https://catalog.hathitrust.org/Search/Home?lookfor=${encodeURIComponent(query)}&searchtype=all`,
        raw_metadata: { query, note: 'HathiTrust keyword search is linked out; identifier lookups can use bibliographic APIs.' },
      }];
    }
    const data = await fetchJson<{ records?: Record<string, Record<string, unknown>> }>(`https://catalog.hathitrust.org/api/volumes/brief/json/isbn/${encodeURIComponent(identifier)}`, { signal: options?.signal }).catch(() => ({ records: {} }));
    const records: Array<Record<string, unknown>> = Object.values(data.records ?? {});
    return records.slice(0, options?.limit ?? 10).map((record): ResourceCandidate => {
      const items = Array.isArray(record.items) ? record.items as Array<Record<string, unknown>> : [];
      const publicItem = items.find((item) => String(item.rightsCode ?? '').toLowerCase().includes('pd') || String(item.usRightsString ?? '').toLowerCase().includes('public'));
      return {
        source_name: 'HathiTrust',
        source_record_id: text(record.recordNumber) || text(publicItem?.itemURL),
        title: text(record.title),
        authors: text(record.author) ? [String(record.author)] : [],
        publisher: text(record.publisher),
        year: yearFrom(record.publishDates),
        item_type: 'ebook',
        rights_status: publicItem ? 'public_domain' : 'metadata_only',
        licence: publicItem ? 'Public domain' : 'Limited view or metadata only',
        source_url: text(publicItem?.itemURL) || text(record.recordURL),
        raw_metadata: record,
      };
    });
  },
};

export const unpaywallDoiAdapter: ResourceAdapter = {
  name: 'Unpaywall',
  sourceType: 'unpaywall',
  async search(query) {
    const doi = text(query)?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:/i, '').trim();
    if (!doi || !doi.includes('/')) return [];
    const enriched = await enrichWithUnpaywall({ source_name: 'Unpaywall', source_record_id: doi, title: doi, doi, item_type: 'article', rights_status: 'metadata_only', source_url: `https://doi.org/${doi}`, raw_metadata: {} });
    return [enriched];
  },
};

export async function enrichWithUnpaywall(candidate: ResourceCandidate, email = process.env.UNPAYWALL_EMAIL || 'library@esut.edu.ng') {
  if (!candidate.doi || candidate.download_url || candidate.rights_status === 'open') return candidate;
  try {
    const data = await fetchJson<Record<string, any>>(`https://api.unpaywall.org/v2/${encodeURIComponent(candidate.doi)}?email=${encodeURIComponent(email)}`);
    const best = data.best_oa_location;
    if (!best?.url_for_pdf && !best?.url) return candidate;
    return {
      ...candidate,
      rights_status: 'open',
      licence: text(best.license) || candidate.licence || 'Open access via Unpaywall',
      download_url: text(best.url_for_pdf),
      source_url: candidate.source_url || text(best.url),
      raw_metadata: { ...(candidate.raw_metadata ?? {}), unpaywall: data },
    } satisfies ResourceCandidate;
  } catch {
    return candidate;
  }
}

export const resourceAdapters = [openLibraryAdapter, googleBooksAdapter, doabAdapter, doajAdapter, openAlexAdapter, crossRefAdapter, internetArchiveAdapter, coreAdapter, gutenbergAdapter, standardEbooksAdapter, pubMedAdapter, pmcAdapter, hathiTrustAdapter, unpaywallDoiAdapter];

export function getEnabledAdapters(sourceTypes?: string[]) {
  if (!sourceTypes?.length) return resourceAdapters;
  const allowed = new Set(sourceTypes);
  return resourceAdapters.filter((adapter) => allowed.has(adapter.sourceType) || allowed.has(adapter.name));
}
