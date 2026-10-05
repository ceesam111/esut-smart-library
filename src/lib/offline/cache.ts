import type {
  CachePatron,
  OfflineCache,
  OfflineSession,
} from './types';

export const OFFLINE_GRANT_HOURS = 12;

export function buildOfflineSession(
  operatorId: string,
  email: string,
  roles: string[],
  now: Date = new Date(),
): OfflineSession {
  return {
    operator_id: operatorId,
    email,
    roles,
    granted_at: now.toISOString(),
    expires_at: new Date(now.getTime() + OFFLINE_GRANT_HOURS * 3600_000).toISOString(),
  };
}

export function cacheIsStale(cache: OfflineCache | null, now: Date = new Date()): boolean {
  if (!cache) return true;
  const fetched = Date.parse(cache.fetched_at);
  if (Number.isNaN(fetched)) return true;
  const maxAge = (cache.max_age_hours ?? 48) * 3600_000;
  return now.getTime() - fetched > maxAge;
}

export function searchPatrons(cache: OfflineCache | null, q: string): CachePatron[] {
  if (!cache || q.trim().length < 2) return [];
  const needle = q.trim().toLowerCase();
  return cache.patrons
    .filter(
      (p) =>
        p.full_name.toLowerCase().includes(needle) ||
        p.patron_id.toLowerCase().includes(needle) ||
        p.email.toLowerCase().includes(needle),
    )
    .slice(0, 8);
}

export function searchItems(cache: OfflineCache | null, q: string): OfflineCache['items'] {
  if (!cache || q.trim().length < 2) return [];
  const needle = q.trim().toLowerCase();
  return cache.items
    .filter(
      (it) =>
        (it.title ?? '').toLowerCase().includes(needle) ||
        (it.call_number ?? '').toLowerCase().includes(needle),
    )
    .slice(0, 8);
}

export function findItemByBarcode(cache: OfflineCache | null, barcode: string): OfflineCache['items'][number] | null {
  if (!cache || !barcode.trim()) return null;
  const code = barcode.trim().toLowerCase();
  const copy = cache.copies.find((c) => (c.barcode ?? '').toLowerCase() === code);
  if (!copy) return null;
  return cache.items.find((it) => it.id === copy.item_id) ?? null;
}

export function activeLoansForPatron(cache: OfflineCache | null, patronId: string): OfflineCache['loans'] {
  if (!cache) return [];
  return cache.loans.filter((l) => l.patron_id === patronId && (l.status === 'active' || l.status === 'overdue'));
}

export function activeLoanFor(cache: OfflineCache | null, patronId: string, itemId: string): OfflineCache['loans'][number] | null {
  if (!cache) return null;
  return (
    cache.loans.find(
      (l) => l.patron_id === patronId && l.catalogue_item_id === itemId && (l.status === 'active' || l.status === 'overdue'),
    ) ?? null
  );
}

export function patronEligibleOffline(patron: CachePatron, now: Date = new Date()): { ok: boolean; reason?: string } {
  if (patron.status === 'suspended') return { ok: false, reason: `${patron.full_name}'s account is suspended.` };
  if (patron.status === 'expired') return { ok: false, reason: `${patron.full_name}'s account has expired.` };
  if (patron.membership_expires_at && Date.parse(patron.membership_expires_at) < now.getTime()) {
    return { ok: false, reason: `${patron.full_name}'s membership has expired.` };
  }
  return { ok: true };
}
