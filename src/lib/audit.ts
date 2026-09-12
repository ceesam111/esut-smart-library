import { supabase } from '@/lib/supabase';

export interface CirculationAuditLog {
  action: 'checkout' | 'checkin' | 'renewal' | 'hold_placed' | 'hold_fulfilled' | 'hold_cancelled' | 'overdue_detected';
  patron_id: string;
  catalogue_item_id?: string;
  loan_id?: string;
  metadata?: Record<string, unknown>;
}

export async function logCirculationEvent(event: CirculationAuditLog) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId ?? null,
      action: `circulation.${event.action}`,
      table_name: 'circulation_transactions',
      entity_type: 'circulation',
      record_id: event.loan_id ?? null,
      new_values: {
        patron_id: event.patron_id,
        catalogue_item_id: event.catalogue_item_id ?? null,
        ...event.metadata,
      },
      metadata: {
        source: 'circulation_desk',
        timestamp: new Date().toISOString(),
      },
    });

    if (error) {
      console.warn('Audit log write failed:', error.message);
    }
  } catch (err) {
    console.warn('Audit log error:', err);
  }
}
