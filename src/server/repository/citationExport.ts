export interface CitationInput {
  id: string;
  handle: string | null;
  title: string;
  authors: unknown;
  abstract: string | null;
  keywords: unknown;
  type: string | null;
  item_type?: string | null;
  doi: string | null;
  year: number | null;
  language: string | null;
  created_at: string | null;
  department: string | null;
  faculty_code: string | null;
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry : String((entry as { name?: unknown })?.name ?? '')))
    .map((name) => name.trim())
    .filter(Boolean);
}

function yearOf(item: CitationInput): string {
  if (item.year) return String(item.year);
  if (item.created_at) {
    const parsed = new Date(item.created_at);
    if (!Number.isNaN(parsed.getTime())) return String(parsed.getUTCFullYear());
  }
  return 'n.d.';
}

function landingUrl(item: CitationInput): string {
  return `${(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || 'https://virtuallibrary.esut.edu.ng').replace(/\/+$/, '')}/repository/${encodeURIComponent(item.id)}`;
}

function bibtexKey(item: CitationInput): string {
  const author = names(item.authors)[0]?.split(/\s+/).pop() ?? 'anon';
  const sanitized = author.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${sanitized}${yearOf(item)}`;
}

function bibtexEscape(value: string): string {
  return value.replace(/[\\{}\r\n]/g, ' ');
}

function bibtexType(item: CitationInput): string {
  const type = `${item.item_type ?? ''} ${item.type ?? ''}`.toLowerCase();
  if (type.includes('thesis') || type.includes('dissertation')) return 'phdthesis';
  if (type.includes('conference')) return 'inproceedings';
  if (type.includes('book') || type.includes('chapter')) return 'incollection';
  if (type.includes('report') || type.includes('preprint')) return 'techreport';
  return 'article';
}

export function toBibtex(item: CitationInput): string {
  const authors = names(item.authors).join(' and ');
  const keywords = [...new Set([...names(item.keywords)])];
  const lines = [
    `@${bibtexType(item)}{${bibtexKey(item)},`,
    `  title = {${bibtexEscape(item.title)}},`,
    authors ? `  author = {${bibtexEscape(authors)}},` : '',
    `  year = {${yearOf(item)}},`,
    item.doi ? `  doi = {${bibtexEscape(item.doi)}},` : '',
    `  url = {${landingUrl(item)}},`,
    item.abstract ? `  abstract = {${bibtexEscape(item.abstract.slice(0, 500))}},` : '',
    keywords.length > 0 ? `  keywords = {${bibtexEscape(keywords.join(', '))}},` : '',
    item.language ? `  language = {${bibtexEscape(item.language)}},` : '',
    `}`,
  ];
  return lines.filter(Boolean).join('\n');
}

function risTag(tag: string, value: string): string {
  return `${tag}  - ${value.replace(/[\r\n]+/g, ' ')}`;
}

export function toRis(item: CitationInput): string {
  const type = `${item.item_type ?? ''} ${item.type ?? ''}`.toLowerCase();
  const ty = type.includes('thesis') || type.includes('dissertation')
    ? 'THES'
    : type.includes('conference')
      ? 'CPAPER'
      : type.includes('book') || type.includes('chapter')
        ? 'CHAP'
        : type.includes('report') || type.includes('preprint')
          ? 'RPRT'
          : 'JOUR';
  const lines = [risTag('TY', ty)];
  names(item.authors).forEach((author) => lines.push(risTag('AU', author)));
  lines.push(risTag('TI', item.title));
  if (item.year) lines.push(risTag('PY', String(item.year)));
  if (item.doi) lines.push(risTag('DO', item.doi));
  lines.push(risTag('UR', landingUrl(item)));
  if (item.abstract) lines.push(risTag('AB', item.abstract));
  [...new Set([...names(item.keywords)])].forEach((keyword) => lines.push(risTag('KW', keyword)));
  if (item.department) lines.push(risTag('DP', item.department));
  lines.push(risTag('LA', item.language ?? 'English'));
  lines.push(risTag('PB', 'ESUT Library'));
  lines.push(risTag('ER', ''));
  return lines.join('\r\n');
}
