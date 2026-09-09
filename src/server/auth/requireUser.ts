import type { NextRequest } from 'next/server';
import { getSupabaseUserClient } from '@/server/supabase/userClient';

export interface ServerUserContext {
  accessToken: string;
  user: {
    id: string;
    email?: string;
  };
}

export function getBearerToken(request: Request | NextRequest) {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export async function requireUser(request: Request | NextRequest): Promise<ServerUserContext> {
  const accessToken = getBearerToken(request);
  if (!accessToken) throw new Error('Authentication required.');

  const supabase = getSupabaseUserClient(accessToken);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Invalid or expired session.');

  return {
    accessToken,
    user: {
      id: data.user.id,
      email: data.user.email ?? undefined,
    },
  };
}
