const ORCID_COMPACT_PATTERN = /^\d{15}[\dX]$/;

export function normalizeOrcidId(input: string): string | null {
  const cleaned = input.trim().replace(/^https?:\/\//i, '').replace(/^orcid\.org\//i, '').replace(/\s+/g, '');
  const compact = cleaned.replace(/-/g, '').toUpperCase();
  if (!ORCID_COMPACT_PATTERN.test(compact)) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}`;
}

export function orcidChecksumDigit(firstFifteenDigits: string): string {
  if (!/^\d{15}$/.test(firstFifteenDigits)) return '';
  let total = 0;
  for (let index = 0; index < 15; index += 1) {
    total += Number(firstFifteenDigits[index]) * 2 ** (15 - index);
  }
  const remainder = total % 11;
  const check = (12 - remainder) % 11;
  return check === 10 ? 'X' : String(check);
}

export function validateOrcidId(input: string): string | null {
  const normalized = normalizeOrcidId(input);
  if (!normalized) return null;
  const compact = normalized.replace(/-/g, '');
  return compact[15] === orcidChecksumDigit(compact.slice(0, 15)) ? normalized : null;
}

export function orcidProfileUrl(input: string): string | null {
  const normalized = validateOrcidId(input);
  return normalized ? `https://orcid.org/${normalized}` : null;
}
