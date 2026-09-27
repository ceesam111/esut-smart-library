import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const orcidId = new URL(request.url).searchParams.get('id');
  if (!orcidId) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const formatted = formatOrcidId(orcidId);
  if (!formatted) return NextResponse.json({ success: false, error: 'Invalid ORCID ID format' }, { status: 400 });

  try {
    const res = await fetch(`https://pub.orcid.org/v3.0/${formatted}/record`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return NextResponse.json({ success: false, error: 'ORCID ID not found' }, { status: 404 });
    const data = await res.json();

    const name = data.person?.name;
    const givenName = name?.['given-names']?.value || '';
    const familyName = name?.['family-name']?.value || '';
    const fullName = `${givenName} ${familyName}`.trim();

    const employments = (data['activities-summary']?.employments?.['affiliation-group'] ?? []).map(
      (g: Record<string, unknown>) => {
        const summaries = g.summaries as Array<Record<string, unknown>> | undefined;
        const s = summaries?.[0];
        const employment = s?.['employment-summary'] as Record<string, unknown> | undefined;
        const org = employment?.organization as Record<string, unknown> | undefined;
        return org?.name || '';
      }
    ).filter(Boolean);

    return NextResponse.json({
      success: true,
      data: {
        orcid: formatted,
        name: fullName,
        givenName,
        familyName,
        employments,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

function formatOrcidId(input: string): string | null {
  const cleaned = input.replace(/^https?:\/\//, '').replace(/^orcid\.org\//, '');
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(cleaned)) return null;
  return cleaned;
}
