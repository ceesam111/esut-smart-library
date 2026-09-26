import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { institutionConfig } from '@config/institution.config';

export const dynamic = 'force-dynamic';

/**
 * Server-side patron profile creation.
 *
 * Supabase email confirmation is enabled (mailer_autoconfirm=false), so
 * `auth.signUp()` returns no session. A client-side insert into `patrons`
 * therefore runs as `anon` and is rejected by RLS (`FOR INSERT TO
 * authenticated`). This route performs the insert with the service-role
 * client after verifying that the auth user really exists.
 */

const ALLOWED_PROFILE_KEYS = new Set([
  'surname', 'other_names', 'gender', 'date_of_birth', 'phone', 'email',
  'student_type', 'institution', 'faculty_code', 'faculty_name', 'department',
  'level', 'current_level', 'programme', 'duration_years', 'matric_number',
  'staff_id', 'rank', 'academic_rank', 'research_interests',
  'highest_qualification', 'professional_qualification', 'short_bio',
  'preferred_branch', 'library_section', 'job_title', 'profile_photo_url',
]);

function pickProfileColumns(profile: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (ALLOWED_PROFILE_KEYS.has(key)) row[key] = value ?? null;
  }
  return row;
}

async function generatePatronId(supabase: ReturnType<typeof getSupabaseAdminClient>, facultyCode: string) {
  const code = institutionConfig.institutionCode || 'LIB';
  const faculty = (facultyCode || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'GEN';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = `${code}-${faculty}-${Math.floor(100000 + Math.random() * 900000)}`;
    const { data } = await supabase
      .from('patrons')
      .select('id')
      .eq('patron_id', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${code}-${faculty}-${Date.now().toString().slice(-6)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body.role === 'string' ? body.role : '';
    const patronCategory = typeof body.patronCategory === 'string' ? body.patronCategory : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const status = body.status === 'active' ? 'active' : 'pending';
    const profile = body.profile && typeof body.profile === 'object' ? (body.profile as Record<string, unknown>) : {};
    const registrationPolicy = typeof body.registrationPolicy === 'string' ? body.registrationPolicy : null;
    const timestamps = {
      approvedAt: body.approvedAt ? String(body.approvedAt) : null,
      emailVerifiedAt: body.emailVerifiedAt ? String(body.emailVerifiedAt) : null,
      mainLibraryAccessAt: body.mainLibraryAccessAt ? String(body.mainLibraryAccessAt) : null,
      branchApprovedAt: body.branchApprovedAt ? String(body.branchApprovedAt) : null,
    };

    if (!userId || !email || !role || !patronCategory) {
      return NextResponse.json({ ok: false, error: 'userId, email, role and patronCategory are required.' }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ ok: false, error: 'Full name is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    const { data: authUser, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr || !authUser?.user) {
      return NextResponse.json({ ok: false, error: 'Registration session could not be verified. Please try again.' }, { status: 400 });
    }
    const authEmail = (authUser.user.email || '').toLowerCase();
    if (authEmail && authEmail !== email) {
      return NextResponse.json({ ok: false, error: 'Registration email does not match the created account.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('patrons')
      .select('id, patron_id, status')
      .eq('user_id', userId)
      .maybeSingle();

    const row = {
      user_id: userId,
      email,
      full_name: fullName,
      patron_category: patronCategory,
      account_role: role,
      status,
      approved_at: timestamps.approvedAt,
      email_verified_at: timestamps.emailVerifiedAt,
      main_library_access_at: timestamps.mainLibraryAccessAt,
      branch_approved_at: timestamps.branchApprovedAt,
      registration_policy: registrationPolicy,
      membership_expires_at: null,
      ...pickProfileColumns(profile),
    };

    if (existing) {
      const { error: updateErr } = await supabase
        .from('patrons')
        .update(row)
        .eq('id', existing.id);
      if (updateErr) {
        return NextResponse.json({ ok: false, error: friendlyPatronError(updateErr.message) }, { status: 400 });
      }
      return NextResponse.json({ ok: true, patronRowId: existing.id, patronId: existing.patron_id, recovered: true });
    }

    const facultyCode = typeof profile.faculty_code === 'string' ? profile.faculty_code : '';
    let patronId = await generatePatronId(supabase, facultyCode);
    let { error: insertErr } = await supabase.from('patrons').insert({ ...row, patron_id: patronId });

    for (let attempt = 0; insertErr && attempt < 4; attempt += 1) {
      if (!/duplicate key|23505/i.test(insertErr.message || '')) break;
      if (/user_id/.test(insertErr.message || '')) {
        const { data: raced } = await supabase.from('patrons').select('id, patron_id').eq('user_id', userId).maybeSingle();
        if (raced) return NextResponse.json({ ok: true, patronRowId: raced.id, patronId: raced.patron_id, recovered: true });
      }
      patronId = await generatePatronId(supabase, facultyCode);
      ({ error: insertErr } = await supabase.from('patrons').insert({ ...row, patron_id: patronId }));
    }

    if (insertErr) {
      return NextResponse.json({ ok: false, error: friendlyPatronError(insertErr.message) }, { status: 400 });
    }

    const { data: created } = await supabase.from('patrons').select('id').eq('user_id', userId).maybeSingle();
    return NextResponse.json({ ok: true, patronRowId: created?.id ?? null, patronId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ ok: false, error: friendlyPatronError(message) }, { status: 500 });
  }
}

function friendlyPatronError(message: string) {
  if (/row-level security|permission denied|42501/i.test(message)) {
    return 'Your profile could not be saved due to a permissions issue. The library team has been informed — please try again shortly.';
  }
  if (/duplicate key|23505/i.test(message)) {
    return 'An account profile already exists for this user. Please sign in instead, or contact the library desk.';
  }
  if (/column .* does not exist|PGRST204|42703/i.test(message)) {
    return 'The registration form is out of date with the library database. Please contact the library desk.';
  }
  return 'Your account was created, but the library profile could not be saved. Please contact the library desk so we can complete your registration.';
}
