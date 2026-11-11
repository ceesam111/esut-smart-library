import { NextResponse } from 'next/server';
import { generateSwordServiceXml } from '@/server/interoperability/sword';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  const xml = generateSwordServiceXml(appBaseUrl());
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/atom+xml;type=service' } });
}
