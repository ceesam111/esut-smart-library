import { NextResponse } from 'next/server';
import { getRegistrationPolicy } from '@/server/registration/policy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const policy = await getRegistrationPolicy();
  return NextResponse.json({ policy });
}
