import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { getRegistrationPolicy, setRegistrationPolicy } from '@/server/registration/policy';
import { parseRegistrationPolicy } from '@/lib/registrationPolicy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['super_admin']);
    return NextResponse.json({ policy: await getRegistrationPolicy() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(request, ['super_admin']);
    const body = await request.json().catch(() => ({}));
    const policy = parseRegistrationPolicy(body.policy);
    return NextResponse.json({ policy: await setRegistrationPolicy(policy) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
