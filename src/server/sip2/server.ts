import { parseSip2Message, buildSip2Response, SIP2_CODES } from './messages';
import { authenticateSip2Terminal, isOperationAllowed, logSip2Event } from './auth';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface Sip2Session {
  terminalId: string | null;
  authenticated: boolean;
  allowedOperations: string[];
  sequence: string;
}

export async function handleSip2Message(
  raw: string,
  session: Sip2Session,
  institutionId: string = 'ESUT',
  clientIp: string | null = null,
): Promise<{ response: string; session: Sip2Session }> {
  const message = parseSip2Message(raw);
  if (!message) {
    return { response: buildSip2Response('94', [['AF', 'Invalid message']], session.sequence), session };
  }

  const newSession = { ...session };

  switch (message.code) {
    case SIP2_CODES.LOGIN: {
      const username = message.fields.get('CN') || '';
      const password = message.fields.get('CP') || '';
      const result = await authenticateSip2Terminal(username, password, institutionId, clientIp);
      if (result.success) {
        newSession.authenticated = true;
        newSession.terminalId = result.terminalId || null;
        newSession.allowedOperations = result.allowedOperations || [];
        return { response: buildSip2Response('94', [['AF', 'Login OK']], message.sequence), session: newSession };
      }
      return { response: buildSip2Response('94', [['AF', 'Login failed']], message.sequence), session: newSession };
    }

    case SIP2_CODES.CHECKOUT: {
      if (!newSession.authenticated) {
        return { response: buildSip2Response('12', [['AF', 'Not authenticated']], message.sequence), session: newSession };
      }
      if (!isOperationAllowed(newSession.allowedOperations, 'checkout')) {
        return { response: buildSip2Response('12', [['AF', 'Operation not allowed']], message.sequence), session: newSession };
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

    case SIP2_CODES.PATRON_STATUS: {
      if (!newSession.authenticated) {
        return { response: buildSip2Response('36', [['AF', 'Not authenticated']], message.sequence), session: newSession };
      }
      if (!isOperationAllowed(newSession.allowedOperations, 'patron_info')) {
        return { response: buildSip2Response('36', [['AF', 'Operation not allowed']], message.sequence), session: newSession };
      }
      return { response: buildSip2Response('36', [['AF', 'Patron info OK']], message.sequence), session: newSession };
    }

    case SIP2_CODES.END_SESSION: {
      newSession.authenticated = false;
      newSession.terminalId = null;
      newSession.allowedOperations = [];
      return { response: buildSip2Response('36', [['AF', 'Session ended']], message.sequence), session: newSession };
    }

    default:
      return { response: buildSip2Response('94', [['AF', 'Unsupported command']], message.sequence), session: newSession };
  }
}

export function createSip2Session(): Sip2Session {
  return { terminalId: null, authenticated: false, allowedOperations: [], sequence: '0' };
}
