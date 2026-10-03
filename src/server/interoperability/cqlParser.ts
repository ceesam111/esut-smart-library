export type CQLRelation = '=' | 'exact' | 'any' | 'all' | '>' | '>=' | '<' | '<=';
export type CQLBoolean = 'AND' | 'OR' | 'NOT';

export interface CQLTerm {
  field: string;
  value: string;
  relation: CQLRelation;
  boolean: CQLBoolean;
}

export interface CQLParseResult {
  terms: CQLTerm[];
  valid: boolean;
  error?: string;
}

const FIELD_MAPPINGS: Record<string, string> = {
  'cql.serverchoice': 'search_vector',
  'dc.title': 'title',
  'dc.creator': 'authors_text',
  'dc.subject': 'subjects_text',
  'dc.description': 'abstract',
  'dc.publisher': 'publisher',
  'dc.date': 'year',
  'dc.identifier': 'doi',
  'bath.isbn': 'isbn',
  'bath.issn': 'issn',
  'bath.name': 'authors_text',
  'bath.title': 'title',
  'bath.subject': 'subjects_text',
  'rec.identifier': 'id',
  'keyword': 'search_vector',
};

const SUPPORTED_INDEXES = new Set(Object.keys(FIELD_MAPPINGS));
const SUPPORTED_RELATIONS = new Set(['=', 'exact', 'any', 'all', '>', '>=', '<', '<=']);

export function isSupportedIndex(index: string): boolean {
  return SUPPORTED_INDEXES.has(index.toLowerCase());
}

export function isSupportedRelation(relation: string): boolean {
  return SUPPORTED_RELATIONS.has(relation.toLowerCase());
}

export function parseCQL(query: string): CQLParseResult {
  const terms: CQLTerm[] = [];
  let pos = 0;

  function skipWhitespace() {
    while (pos < query.length && /\s/.test(query[pos])) pos++;
  }

  function peek(): string {
    return query[pos] ?? '';
  }

  function consume(): string {
    return query[pos++] ?? '';
  }

  function parseQuotedString(): string | null {
    if (peek() !== '"') return null;
    consume();
    let value = '';
    while (pos < query.length && peek() !== '"') {
      if (peek() === '\\' && pos + 1 < query.length) {
        consume();
        value += consume();
      } else {
        value += consume();
      }
    }
    if (peek() !== '"') return null;
    consume();
    return value;
  }

  function parseToken(): string {
    skipWhitespace();
    if (peek() === '"') {
      const value = parseQuotedString();
      return value ?? '';
    }
    let token = '';
    while (pos < query.length && !/[\s()=!<>]/.test(peek())) {
      token += consume();
    }
    return token;
  }

  function parseRelation(): CQLRelation | null {
    skipWhitespace();
    if (peek() === '=') { consume(); return '='; }
    if (peek() === '>') {
      consume();
      if (peek() === '=') { consume(); return '>='; }
      return '>';
    }
    if (peek() === '<') {
      consume();
      if (peek() === '=') { consume(); return '<='; }
      if (peek() === '>') { consume(); return 'exact'; }
      return '<';
    }
    const word = parseToken().toLowerCase();
    if (word === 'any') return 'any';
    if (word === 'all') return 'all';
    if (word === 'exact') return 'exact';
    return null;
  }

  function parseTerm(): CQLTerm | null {
    skipWhitespace();
    const field = parseToken().toLowerCase();
    if (!field) return null;

    const relation = parseRelation();
    if (!relation) return null;

    skipWhitespace();
    const value = parseQuotedString();
    if (value === null) return null;

    if (!isSupportedIndex(field)) {
      return { field, value, relation, boolean: 'AND' };
    }

    return { field, value, relation, boolean: 'AND' };
  }

  function parseExpression(): boolean {
    skipWhitespace();
    if (peek() === '(') {
      consume();
      if (!parseOrExpression()) return false;
      skipWhitespace();
      if (peek() !== ')') return false;
      consume();
      return true;
    }
    const term = parseTerm();
    if (!term) return false;
    terms.push(term);
    return true;
  }

  function parseNotExpression(): boolean {
    skipWhitespace();
    const savedPos = pos;
    const word = parseToken().toLowerCase();
    if (word === 'not') {
      skipWhitespace();
      if (peek() === '(') {
        consume();
        if (!parseOrExpression()) return false;
        skipWhitespace();
        if (peek() !== ')') return false;
        consume();
        return true;
      }
      const term = parseTerm();
      if (!term) return false;
      term.boolean = 'NOT';
      terms.push(term);
      return true;
    }
    pos = savedPos;
    return parseExpression();
  }

  function parseAndExpression(): boolean {
    if (!parseNotExpression()) return false;
    while (true) {
      skipWhitespace();
      const savedPos = pos;
      const word = parseToken().toLowerCase();
      if (word === 'and') {
        if (!parseNotExpression()) return false;
      } else if (word === 'not') {
        const term = parseTerm();
        if (!term) return false;
        term.boolean = 'NOT';
        terms.push(term);
      } else {
        pos = savedPos;
        break;
      }
    }
    return true;
  }

  function parseOrExpression(): boolean {
    if (!parseAndExpression()) return false;
    while (true) {
      skipWhitespace();
      const savedPos = pos;
      const word = parseToken().toLowerCase();
      if (word === 'or') {
        const prevCount = terms.length;
        if (!parseAndExpression()) return false;
        if (terms.length > prevCount) terms[prevCount].boolean = 'OR';
      } else {
        pos = savedPos;
        break;
      }
    }
    return true;
  }

  const valid = parseOrExpression();
  skipWhitespace();
  if (pos < query.length) {
    return { terms, valid: false, error: `Unexpected token at position ${pos}` };
  }

  return { terms, valid, error: valid ? undefined : 'Failed to parse CQL query' };
}

export function normalizeISBN(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function normalizeISSN(issn: string): string {
  return issn.replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function cqlTermToCondition(term: CQLTerm): string | null {
  const pgField = FIELD_MAPPINGS[term.field];
  if (!pgField) return null;

  const value = term.value.replace(/[(),]/g, ' ').trim();

  if (term.field === 'bath.isbn') {
    return `isbn.eq.${normalizeISBN(term.value)}`;
  }
  if (term.field === 'bath.issn') {
    return `issn.eq.${normalizeISSN(term.value)}`;
  }
  if (term.field === 'dc.date') {
    return `year.eq.${value}`;
  }
  if (term.field === 'rec.identifier') {
    const uuid = value;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      return 'id.eq.00000000-0000-0000-0000-000000000000';
    }
    return `id.eq.${uuid}`;
  }

  switch (term.relation) {
    case '=':
      return `${pgField}.ilike.%${value}%`;
    case 'exact':
      return `${pgField}.eq.${value}`;
    case 'any': {
      const words = value.split(/\s+/).filter(Boolean);
      if (words.length === 0) return null;
      if (words.length === 1) return `${pgField}.ilike.%${words[0]}%`;
      return `or(${words.map((w) => `${pgField}.ilike.%${w}%`).join(',')})`;
    }
    case 'all': {
      const words = value.split(/\s+/).filter(Boolean);
      if (words.length === 0) return null;
      if (words.length === 1) return `${pgField}.ilike.%${words[0]}%`;
      return `and(${words.map((w) => `${pgField}.ilike.%${w}%`).join(',')})`;
    }
    case '>':
      return `${pgField}.gt.${value}`;
    case '>=':
      return `${pgField}.gte.${value}`;
    case '<':
      return `${pgField}.lt.${value}`;
    case '<=':
      return `${pgField}.lte.${value}`;
    default:
      return null;
  }
}

export function cqlToSupabaseFilter(terms: CQLTerm[]): { filter: string; params: string[] } {
  const groups: string[][] = [[]];
  const allParams: string[] = [];

  for (const term of terms) {
    const condition = cqlTermToCondition(term);
    if (!condition) continue;
    if (term.boolean === 'OR') {
      groups.push([condition]);
    } else if (term.boolean === 'NOT') {
      groups[groups.length - 1].push(`not.and(${condition})`);
    } else {
      groups[groups.length - 1].push(condition);
    }
    allParams.push(term.value);
  }

  const groupStrings = groups
    .filter((g) => g.length > 0)
    .map((g) => (g.length === 1 ? g[0] : `and(${g.join(',')})`));

  const filter = groupStrings.join(',');
  return { filter, params: allParams };
}
