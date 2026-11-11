export function normalizePersonName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function personNameTokens(name: string): string[] {
  return normalizePersonName(name).split(' ').filter(Boolean);
}

export function significantNameTokens(name: string): string[] {
  return personNameTokens(name).filter((token) => token.length > 1);
}

export function namesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizePersonName(left);
  const normalizedRight = normalizePersonName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = new Set(significantNameTokens(left));
  const rightTokens = new Set(significantNameTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;

  const [shorter, longer] = leftTokens.size <= rightTokens.size ? [leftTokens, rightTokens] : [rightTokens, leftTokens];
  if (shorter.size < 2) return false;
  for (const token of shorter) {
    if (!longer.has(token)) return false;
  }
  return true;
}

export function nameSimilarity(left: string, right: string): number {
  const leftTokens = new Set(significantNameTokens(left));
  const rightTokens = new Set(significantNameTokens(right));
  if (leftTokens.size === 0 && rightTokens.size === 0) return normalizePersonName(left) && normalizePersonName(right) ? 1 : 0;
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = leftTokens.size + rightTokens.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 100) / 100;
}

export function nameMatchKey(name: string): string {
  const tokens = Array.from(new Set(significantNameTokens(name))).sort();
  if (tokens.length >= 2) return tokens.join(' ');
  return normalizePersonName(name);
}
