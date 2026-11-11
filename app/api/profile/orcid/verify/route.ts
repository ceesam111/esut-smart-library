import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { verifyOrcidClaim, type OrcidVerifyFailure } from '@/server/identity/orcidVerify';

export const dynamic = 'force-dynamic';

const FAILURE_STATUS: Record<OrcidVerifyFailure, number> = {
  invalid_format: 400,
  not_found: 404,
  fetch_failed: 502,
  no_profile_name: 422,
  name_mismatch: 422,
};

const FAILURE_MESSAGE: Record<OrcidVerifyFailure, string> = {
  invalid_format: 'ORCID ID failed checksum validation.',
  not_found: 'No ORCID record exists for that ID.',
  fetch_failed: 'The ORCID registry could not be reached.',
  no_profile_name: 'Your researcher profile has no name to match against the ORCID record.',
  name_mismatch: 'The ORCID record name does not match this profile name.',
};

function profileFullName(profile: { first_name: string; middle_name?: string | null; surname: string }): string {
  return [profile.first_name, profile.middle_name, profile.surname].filter((part) => Boolean(part && String(part).trim())).join(' ');
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const orcid = typeof body.orcid === 'string' ? body.orcid.trim() : '';
    if (!orcid) return NextResponse.json({ success: false, error: 'orcid is required.' }, { status: 400 });

    const supabase = getSupabaseAdminClient();
    const { data: patron, error: patronError } = await supabase
      .from('patrons')
      .select('id')
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    if (patronError) return NextResponse.json({ success: false, error: patronError.message }, { status: 500 });
    if (!patron) return NextResponse.json({ success: false, error: 'No patron record for this account.' }, { status: 404 });

    const { data: profile, error: profileError } = await supabase
      .from('researcher_profiles')
      .select('id, first_name, middle_name, surname, orcid_id, orcid_verified')
      .eq('patron_id', patron.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (profileError) return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
    if (!profile) return NextResponse.json({ success: false, error: 'Create a researcher profile before verifying an ORCID.' }, { status: 404 });

    const claim = await verifyOrcidClaim({ orcid, profileName: profileFullName(profile) });
    if (!claim.ok || !claim.orcid) {
      const failure = claim.failure ?? 'invalid_format';
      return NextResponse.json(
        {
          success: false,
          error: FAILURE_MESSAGE[failure],
          failure,
          orcidName: claim.record?.fullName ?? null,
        },
        { status: FAILURE_STATUS[failure] },
      );
    }

    const { data: conflict, error: conflictError } = await supabase
      .from('researcher_profiles')
      .select('id')
      .eq('orcid_id', claim.orcid)
      .neq('id', profile.id)
      .limit(1)
      .maybeSingle();
    if (conflictError) return NextResponse.json({ success: false, error: conflictError.message }, { status: 500 });
    if (conflict) {
      return NextResponse.json(
        { success: false, error: 'This ORCID is already linked to a different researcher profile.', failure: 'orcid_conflict' },
        { status: 409 },
      );
    }

    const verifiedAt = new Date().toISOString();
    const withTimestamp = await supabase
      .from('researcher_profiles')
      .update({ orcid_id: claim.orcid, orcid_verified: true, orcid_verified_at: verifiedAt })
      .eq('id', profile.id)
      .select('id')
      .maybeSingle();

    let persistedAt: string | null = verifiedAt;
    if (withTimestamp.error) {
      const withoutTimestamp = await supabase
        .from('researcher_profiles')
        .update({ orcid_id: claim.orcid, orcid_verified: true })
        .eq('id', profile.id)
        .select('id')
        .maybeSingle();
      if (withoutTimestamp.error) {
        return NextResponse.json({ success: false, error: withoutTimestamp.error.message }, { status: 500 });
      }
      persistedAt = null;
    }

    return NextResponse.json({
      success: true,
      data: {
        orcid: claim.orcid,
        nameMatch: true,
        orcidName: claim.record?.fullName ?? '',
        employments: claim.record?.employments ?? [],
        verifiedAt: persistedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && /Authentication required|Invalid or expired session/.test(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
