export type ReferrerClass = 'direct' | 'internal' | 'search_engine' | 'social' | 'ai_agent' | 'other';

const SEARCH_ENGINES = [
  'google.', 'bing.', 'search.yahoo.', 'duckduckgo.', 'yandex.', 'baidu.',
  'ecosia.', 'search.brave.', 'startpage.', 'qwant.', 'mojeek.',
];

const SOCIAL_NETWORKS = [
  'facebook.', 'fb.', 'twitter.', 'x.', 'linkedin.',
  'instagram.', 'reddit.', 'pinterest.', 'tiktok.', 'youtube.',
  'wa.', 'web.whatsapp.', 'telegram.', 't.', 'threads.', 'mastodon.',
];

const AI_AGENTS = [
  'chatgpt.', 'chat.openai.', 'perplexity.', 'claude.', 'gemini.google.',
  'copilot.microsoft.', 'poe.', 'you.', 'phind.', 'edgeservices.google.',
];

function hostnameOf(referrer: string): string | null {
  try {
    const url = new URL(referrer);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, pattern: string): boolean {
  if (pattern.endsWith('.')) return host.startsWith(pattern);
  return host === pattern || host.endsWith(`.${pattern}`);
}

export function classifyReferrer(
  referrer: string | null | undefined,
  internalHosts: readonly string[] = [],
): ReferrerClass {
  if (!referrer || !referrer.trim()) return 'direct';
  const rawHost = hostnameOf(referrer.trim());
  if (!rawHost) return 'other';
  const host = rawHost.startsWith('www.') ? rawHost.slice(4) : rawHost;
  if (internalHosts.some((h) => hostMatches(host, h.toLowerCase()))) return 'internal';
  if (AI_AGENTS.some((d) => hostMatches(host, d))) return 'ai_agent';
  if (SEARCH_ENGINES.some((d) => hostMatches(host, d))) return 'search_engine';
  if (SOCIAL_NETWORKS.some((d) => hostMatches(host, d))) return 'social';
  return 'other';
}

export interface MetadataCompletenessInput {
  title?: string | null;
  authors?: unknown;
  abstract?: string | null;
  year?: number | null;
  subjects?: unknown;
  keywords?: unknown;
  doi?: string | null;
  faculty_code?: string | null;
  department?: string | null;
  language?: string | null;
  file_url?: string | null;
}

export interface MetadataFieldStatus {
  field: string;
  filled: boolean;
}

export interface MetadataCompletenessResult {
  score: number;
  fields: MetadataFieldStatus[];
  missingFields: string[];
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((entry) => {
    if (typeof entry === 'string') return entry.trim().length > 0;
    if (entry && typeof entry === 'object') {
      const name = (entry as { name?: unknown }).name;
      return typeof name === 'string' && name.trim().length > 0;
    }
    return false;
  });
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function metadataCompleteness(item: MetadataCompletenessInput): MetadataCompletenessResult {
  const fields: MetadataFieldStatus[] = [
    { field: 'title', filled: hasText(item.title) },
    { field: 'authors', filled: hasNonEmptyArray(item.authors) || hasText(item.authors) },
    { field: 'abstract', filled: hasText(item.abstract) },
    { field: 'year', filled: typeof item.year === 'number' && Number.isFinite(item.year) },
    { field: 'subjects', filled: hasNonEmptyArray(item.subjects) || hasNonEmptyArray(item.keywords) },
    { field: 'doi', filled: hasText(item.doi) },
    { field: 'faculty_code', filled: hasText(item.faculty_code) },
    { field: 'department', filled: hasText(item.department) },
    { field: 'language', filled: hasText(item.language) },
    { field: 'file_url', filled: hasText(item.file_url) },
  ];
  const filledCount = fields.filter((f) => f.filled).length;
  return {
    score: Math.round((filledCount / fields.length) * 100),
    fields,
    missingFields: fields.filter((f) => !f.filled).map((f) => f.field),
  };
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  status?: string | null;
}

export interface DuplicateTitleGroup {
  normalizedTitle: string;
  count: number;
  items: DuplicateCandidate[];
}

export function duplicateTitleGroups(
  items: DuplicateCandidate[],
  minGroupSize = 2,
): DuplicateTitleGroup[] {
  const byTitle = new Map<string, DuplicateCandidate[]>();
  for (const item of items) {
    const key = normalizeTitle(item.title ?? '');
    if (!key) continue;
    const bucket = byTitle.get(key);
    if (bucket) bucket.push(item);
    else byTitle.set(key, [item]);
  }
  return [...byTitle.entries()]
    .filter(([, group]) => group.length >= minGroupSize)
    .map(([normalizedTitle, group]) => ({
      normalizedTitle,
      count: group.length,
      items: group,
    }))
    .sort((a, b) => b.count - a.count || a.normalizedTitle.localeCompare(b.normalizedTitle));
}

export interface DepositInput {
  created_at: string;
  status?: string | null;
}

export interface DepositBucket {
  month: string;
  total: number;
  byStatus: Record<string, number>;
}

export function monthlyDepositBuckets(items: DepositInput[]): DepositBucket[] {
  const byMonth = new Map<string, DepositBucket>();
  for (const item of items) {
    const month = String(item.created_at ?? '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    let bucket = byMonth.get(month);
    if (!bucket) {
      bucket = { month, total: 0, byStatus: {} };
      byMonth.set(month, bucket);
    }
    bucket.total += 1;
    const status = item.status ?? 'unknown';
    bucket.byStatus[status] = (bucket.byStatus[status] ?? 0) + 1;
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function toCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvSection {
  name: string;
  header: string[];
  rows: Array<Array<string | number>>;
}

export function buildResearchCsv(sections: CsvSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (lines.length > 0) lines.push('');
    lines.push(`# ${section.name}`);
    lines.push(section.header.map(toCsvCell).join(','));
    for (const row of section.rows) lines.push(row.map(toCsvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}
