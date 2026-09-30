export interface CQLTerm {
  field: string;
  value: string;
  operator: '=' | 'any' | 'all';
}

export interface CQLQuery {
  terms: CQLTerm[];
  booleanOp: 'AND' | 'OR';
}

const FIELD_MAPPINGS: Record<string, string> = {
  'dc.title': 'title',
  'dc.creator': 'authors',
  'dc.subject': 'keywords',
  'dc.description': 'abstract',
  'dc.publisher': 'publisher',
  'dc.date': 'year',
  'dc.identifier': 'doi',
  'bath.isbn': 'isbn',
  'bath.issn': 'issn',
  'bath.name': 'authors',
  'bath.title': 'title',
  'bath.subject': 'keywords',
  'keyword': 'keywords',
  'identifier': 'doi',
};

export function parseCQL(query: string): CQLQuery {
  const terms: CQLTerm[] = [];
  let booleanOp: 'AND' | 'OR' = 'AND';

  const orParts = query.split(/\s+OR\s+/i);
  if (orParts.length > 1) {
    booleanOp = 'OR';
    for (const part of orParts) {
      const andParts = part.split(/\s+AND\s+/i);
      for (const term of andParts) {
        const parsed = parseTerm(term.trim());
        if (parsed) terms.push(parsed);
      }
    }
  } else {
    const andParts = query.split(/\s+AND\s+/i);
    for (const term of andParts) {
      const parsed = parseTerm(term.trim());
      if (parsed) terms.push(parsed);
    }
  }

  return { terms, booleanOp };
}

function parseTerm(term: string): CQLTerm | null {
  const match = term.match(/^([\w.]+)\s*(=|any|all)\s*"([^"]*)"$/i);
  if (!match) return null;
  const [, field, operator, value] = match;
  return {
    field: field.toLowerCase(),
    value: value.trim(),
    operator: operator.toLowerCase() as '=' | 'any' | 'all',
  };
}

export function cqlToPostgres(query: CQLQuery): { where: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];

  for (const term of query.terms) {
    const pgField = FIELD_MAPPINGS[term.field];
    if (!pgField) continue;

    params.push(term.value);
    const paramIdx = params.length;

    if (term.operator === '=') {
      conditions.push(`${pgField} ILIKE '%' || $${paramIdx} || '%'`);
    } else if (term.operator === 'any') {
      const words = term.value.split(/\s+/);
      const wordConds = words.map((_, i) => `${pgField} ILIKE '%' || $${paramIdx + i} + '%'`);
      params.push(...words.slice(1));
      conditions.push(`(${wordConds.join(' OR ')})`);
    } else {
      const words = term.value.split(/\s+/);
      const wordConds = words.map((_, i) => `${pgField} ILIKE '%' || $${paramIdx + i} + '%'`);
      params.push(...words.slice(1));
      conditions.push(`(${wordConds.join(' AND ')})`);
    }
  }

  const where = conditions.length ? conditions.join(` ${query.booleanOp} `) : 'TRUE';
  return { where, params };
}
