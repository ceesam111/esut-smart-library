export type ValidationSeverity = 'ERROR' | 'WARNING';

export interface ValidationIssue {
  severity: ValidationSeverity;
  tag: string;
  subfield?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface MarcField {
  tag: string;
  ind1?: string;
  ind2?: string;
  value?: string;
  subfields?: Array<{ code: string; value: string }>;
}

export interface MarcRecord {
  leader: string;
  fields: MarcField[];
}

const VALID_TAGS = /^\d{3}$/;
const VALID_INDICATOR = /^[0-9a-z ]$/i;
const VALID_SUBFIELD_CODE = /^[a-z0-9]$/;

export function validateMarcRecord(record: MarcRecord, requiredFields?: Array<{ tag: string; subfield: string }>): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!record.leader || record.leader.length !== 24) {
    errors.push({ severity: 'ERROR', tag: 'LDR', message: 'Leader must be 24 characters' });
  }

  for (const field of record.fields) {
    if (!VALID_TAGS.test(field.tag)) {
      errors.push({ severity: 'ERROR', tag: field.tag, message: `Invalid tag format: ${field.tag}` });
    }

    if (field.ind1 !== undefined && field.ind1 !== '' && !VALID_INDICATOR.test(field.ind1)) {
      errors.push({ severity: 'ERROR', tag: field.tag, message: `Invalid indicator 1: ${field.ind1}` });
    }
    if (field.ind2 !== undefined && field.ind2 !== '' && !VALID_INDICATOR.test(field.ind2)) {
      errors.push({ severity: 'ERROR', tag: field.tag, message: `Invalid indicator 2: ${field.ind2}` });
    }

    if (field.subfields) {
      for (const sf of field.subfields) {
        if (!VALID_SUBFIELD_CODE.test(sf.code)) {
          errors.push({ severity: 'ERROR', tag: field.tag, subfield: sf.code, message: `Invalid subfield code: ${sf.code}` });
        }
      }
    }
  }

  if (requiredFields) {
    for (const req of requiredFields) {
      const field = record.fields.find(f => f.tag === req.tag);
      if (!field) {
        errors.push({ severity: 'ERROR', tag: req.tag, subfield: req.subfield, message: `Required field ${req.tag}$${req.subfield} missing` });
      } else if (req.subfield) {
        const sf = field.subfields?.find(s => s.code === req.subfield);
        if (!sf || !sf.value.trim()) {
          errors.push({ severity: 'ERROR', tag: req.tag, subfield: req.subfield, message: `Required subfield ${req.tag}$${req.subfield} missing or empty` });
        }
      }
    }
  }

  const has245 = record.fields.some(f => f.tag === '245' && f.subfields?.some(s => s.code === 'a' && s.value.trim()));
  if (!has245) {
    errors.push({ severity: 'ERROR', tag: '245', subfield: 'a', message: 'Title (245$a) is required' });
  }

  const has001 = record.fields.some(f => f.tag === '001');
  if (!has001) {
    warnings.push({ severity: 'WARNING', tag: '001', message: 'Control number (001) missing' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateISBN(isbn: string): ValidationIssue | null {
  const cleaned = isbn.replace(/[^0-9X]/gi, '');
  if (cleaned.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += (10 - i) * parseInt(cleaned[i], 10);
    const check = (11 - (sum % 11)) % 11;
    const expected = check === 10 ? 'X' : String(check);
    if (cleaned[9].toUpperCase() !== expected) {
      return { severity: 'WARNING', tag: '020', subfield: 'a', message: 'ISBN-10 check digit invalid' };
    }
  } else if (cleaned.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * parseInt(cleaned[i], 10);
    const check = (10 - (sum % 10)) % 10;
    if (parseInt(cleaned[12], 10) !== check) {
      return { severity: 'WARNING', tag: '020', subfield: 'a', message: 'ISBN-13 check digit invalid' };
    }
  } else {
    return { severity: 'WARNING', tag: '020', subfield: 'a', message: `ISBN length invalid: ${cleaned.length}` };
  }
  return null;
}

export function validateISSN(issn: string): ValidationIssue | null {
  const cleaned = issn.replace(/[^0-9X]/gi, '');
  if (cleaned.length !== 8) {
    return { severity: 'WARNING', tag: '022', subfield: 'a', message: `ISSN length invalid: ${cleaned.length}` };
  }
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += (8 - i) * parseInt(cleaned[i], 10);
  const check = (11 - (sum % 11)) % 11;
  const expected = check === 10 ? 'X' : String(check);
  if (cleaned[7].toUpperCase() !== expected) {
    return { severity: 'WARNING', tag: '022', subfield: 'a', message: 'ISSN check digit invalid' };
  }
  return null;
}
