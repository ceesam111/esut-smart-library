import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { rulesFingerprint, institutionRulesSnapshot, OFFLINE_CACHE_MAX_AGE_HOURS } from '@/lib/circulationRules';

export const dynamic = 'force-dynamic';

const LIMITS = {
  patrons: 5000,
  items: 20000,
  copies: 40000,
  loans: 10000,
  holds: 5000,
};

async function fetchBounded<T>(
  table: string,
  columns: string,
  limit: number,
  order?: { column: string },
): Promise<{ rows: T[]; truncated: boolean }> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from(table).select(columns).limit(limit + 1);
  if (order) query = query.order(order.column, { ascending: true });
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  const rows = (data ?? []) as T[];
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

/**
 * Offline circulation cache preload. Bounded and paginated (limit + truncation
 * flags) so a large catalogue cannot produce an unbounded payload. The client
 * stores fetched_at; checkout transactions older than the max age raise a
 * STALE_CACHE conflict on sync.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);

    const [patrons, items, copies, loans, holds] = await Promise.all([
      fetchBounded<{
        id: string; patron_id: string; user_id: string | null; full_name: string;
        email: string; patron_category: string; faculty_name: string | null;
        status: string; membership_expires_at: string | null;
      }>(
        'patrons',
        'id, patron_id, user_id, full_name, email, patron_category, faculty_name, status, membership_expires_at',
        LIMITS.patrons,
        { column: 'patron_id' },
      ),
      fetchBounded<{
        id: string; title: string; authors: unknown; call_number: string | null;
        format: string; available_copies: number; total_copies: number;
      }>(
        'catalogue_items',
        'id, title, authors, call_number, format, available_copies, total_copies',
        LIMITS.items,
        { column: 'title' },
      ),
      fetchBounded<{ item_id: string; barcode: string | null; status: string }>(
        'catalogue_copies',
        'item_id, barcode, status',
        LIMITS.copies,
      ),
      fetchBounded<{
        id: string; patron_id: string; catalogue_item_id: string;
        checkout_date: string; due_date: string; renewed_count: number | null; status: string;
      }>(
        'loans',
        'id, patron_id, catalogue_item_id, checkout_date, due_date, renewed_count, status',
        LIMITS.loans,
        { column: 'checkout_date' },
      ),
      fetchBounded<{ id: string; patron_id: string; catalogue_item_id: string; status: string; priority: number | null }>(
        'reservations',
        'id, patron_id, catalogue_item_id, status, priority',
        LIMITS.holds,
        { column: 'created_at' },
      ),
    ]);

    const activeLoans = loans.rows.filter((l) => l.status === 'active' || l.status === 'overdue');
    const openHolds = holds.rows.filter((h) => h.status === 'pending' || h.status === 'ready_for_collection');

    return NextResponse.json({
      success: true,
      cache: {
        fetched_at: new Date().toISOString(),
        max_age_hours: OFFLINE_CACHE_MAX_AGE_HOURS,
        rules: institutionRulesSnapshot(),
        rules_fingerprint: rulesFingerprint(),
        patrons: patrons.rows,
        items: items.rows,
        copies: copies.rows,
        loans: activeLoans,
        holds: openHolds,
        truncated: {
          patrons: patrons.truncated,
          items: items.truncated,
          copies: copies.truncated,
          loans: loans.truncated,
          holds: holds.truncated,
        },
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
