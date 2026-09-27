import { parseSip2Message, buildSip2Response, SIP2_CODES } from './messages';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface Sip2Session {
  patronId: string | null;
  authenticated: boolean;
  sequence: string;
}

export async function handleSip2Message(raw: string, session: Sip2Session): Promise<{ response: string; session: Sip2Session }> {
  const message = parseSip2Message(raw);
  if (!message) {
    return { response: buildSip2Response('94', [['AF', 'Invalid message']], session.sequence), session };
  }

  const newSession = { ...session };

  switch (message.code) {
    case SIP2_CODES.LOGIN: {
      const username = message.fields.get('CN') || '';
      const password = message.fields.get('CP') || '';
      const { data: user } = await getSupabaseAdminClient()
        .from('user_roles')
        .select('user_id')
        .eq('role', 'librarian')
        .limit(1)
        .maybeSingle();
      if (username && password && user) {
        newSession.authenticated = true;
        newSession.patronId = user.user_id;
        return { response: buildSip2Response('94', [['AF', 'Login OK']], message.sequence), session: newSession };
      }
      return { response: buildSip2Response('94', [['AF', 'Login failed']], message.sequence), session: newSession };
    }

    case SIP2_CODES.CHECKOUT: {
      if (!newSession.authenticated) {
        return { response: buildSip2Response('12', [['AF', 'Not authenticated']], message.sequence), session: newSession };
      }
      const itemBarcode = message.fields.get('AB') || '';
      const patronBarcode = message.fields.get('AA') || '';
      const { error } = await getSupabaseAdminClient()
        .from('circulation_transactions')
        .insert({
          action: 'checkout',
          item_id: itemBarcode,
          patron_id: patronBarcode,
          due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
        });
      if (error) {
        return { response: buildSip2Response('12', [['AF', 'Checkout failed']], message.sequence), session: newSession };
      }
      return { response: buildSip2Response('12', [['AF', 'Checkout OK']], message.sequence), session: newSession };
    }

    case SIP2_CODES.END_SESSION: {
      newSession.authenticated = false;
      newSession.patronId = null;
      return { response: buildSip2Response('36', [['AF', 'Session ended']], message.sequence), session: newSession };
    }

    default:
      return { response: buildSip2Response('94', [['AF', 'Unsupported command']], message.sequence), session: newSession };
  }
}

export function createSip2Session(): Sip2Session {
  return { patronId: null, authenticated: false, sequence: '0' };
}
