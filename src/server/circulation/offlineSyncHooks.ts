import { captureEvent } from '@/server/analytics/eventCapture';
import { noticeDeliveryService } from '@/server/circulation/deliveryService';
import type { NoticeType } from '@/server/circulation/notices';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type { AppliedHook, ResolveEvent, SyncHooks } from './offlineSync';

const NOTICE_FOR_OP: Record<AppliedHook['operation'], NoticeType> = {
  checkout: 'checkout_receipt',
  checkin: 'checkin_receipt',
  renew: 'renewal_confirmation',
};

async function insertAuditLog(entry: {
  userId: string | null;
  action: string;
  recordId: string | null;
  newValues: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('audit_logs').insert({
    user_id: entry.userId,
    action: entry.action,
    table_name: 'circulation_transactions',
    entity_type: 'circulation',
    record_id: entry.recordId,
    new_values: entry.newValues,
    metadata: entry.metadata,
  });
  if (error) throw new Error(`audit_logs insert failed: ${error.message}`);
}

/**
 * Production hooks for offline circulation sync. All three side effects —
 * analytics, patron notices, audit log — fire ONLY after a transaction has
 * been durably applied (never for conflicts, rejects or duplicate replays),
 * and each notice carries an idempotency key derived from client_txn_id so a
 * replay can never deliver twice.
 */
export function createOfflineSyncHooks(): SyncHooks {
  return {
    async onApplied(hook: AppliedHook): Promise<void> {
      const offlineMeta = {
        offline: true,
        device_id: hook.device_id,
        local_seq: hook.local_seq,
        branch: hook.branch,
        client_txn_id: hook.client_txn_id,
        operator_id: hook.operator_id,
      };

      const sideEffects: Promise<unknown>[] = [
        captureEvent({
          event_type: hook.operation === 'renew' ? 'renewal' : hook.operation,
          user_id: hook.patron_user_id,
          entity_type: 'loan',
          entity_id: hook.loan_id,
          path: '/admin/circulation',
          event_category: 'CIRCULATION',
          metadata: offlineMeta,
        }),
        insertAuditLog({
          userId: hook.operator_id,
          action: `circulation.${hook.operation}`,
          recordId: hook.loan_id,
          newValues: {
            patron_id: hook.patron_id,
            catalogue_item_id: hook.catalogue_item_id,
            due_date: hook.due_date ?? null,
            fine_amount: hook.fine_amount ?? null,
          },
          metadata: { source: 'offline_sync', ...offlineMeta, timestamp: new Date().toISOString() },
        }),
      ];

      if (hook.patron_user_id) {
        sideEffects.push(
          noticeDeliveryService
            .send({
              noticeType: NOTICE_FOR_OP[hook.operation],
              userId: hook.patron_user_id,
              channel: 'in-app',
              context: {
                patron_name: hook.patron_name,
                item_title: hook.item_title,
                due_date: hook.due_date,
                return_date: hook.operation === 'checkin' ? new Date() : undefined,
                fine_amount: hook.fine_amount,
              },
              entityType: 'loan',
              entityId: hook.loan_id,
              idempotencyKey: `offline:${hook.client_txn_id}`,
            })
            .catch((err: unknown) => {
              console.warn('offline notice failed:', err instanceof Error ? err.message : err);
            }),
        );
      }

      if (hook.hold_ready?.patron_user_id) {
        sideEffects.push(
          noticeDeliveryService
            .send({
              noticeType: 'hold_ready',
              userId: hook.hold_ready.patron_user_id,
              channel: 'in-app',
              context: {
                patron_name: 'Patron',
                item_title: hook.item_title,
              },
              entityType: 'reservation',
              entityId: hook.hold_ready.hold_id,
              idempotencyKey: `offline:${hook.client_txn_id}:hold`,
            })
            .catch((err: unknown) => {
              console.warn('offline hold notice failed:', err instanceof Error ? err.message : err);
            }),
        );
      }

      // Analytics, audit and notices are independent side effects — run them
      // concurrently (REST round-trips dominate sync latency).
      await Promise.all(sideEffects);
    },

    async onResolved(event: ResolveEvent): Promise<void> {
      await insertAuditLog({
        userId: event.actor_id,
        action: `circulation.offline_${event.action}`,
        recordId: null,
        newValues: {
          client_txn_id: event.client_txn_id,
          conflict_code: event.conflict_code,
          note: event.note,
        },
        metadata: { source: 'offline_sync', timestamp: new Date().toISOString() },
      }).catch((err: unknown) => {
        console.warn('offline resolve audit failed:', err instanceof Error ? err.message : err);
      });
    },
  };
}
