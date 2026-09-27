import { NextResponse } from 'next/server';
import { generateSwordServiceXml } from '@/server/interoperability/sword';

export const dynamic = 'force-dynamic';

export async function GET() {
  const xml = generateSwordServiceXml('https://esutlibrary.edu.ng');
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/atom+xml;type=service' } });
}
