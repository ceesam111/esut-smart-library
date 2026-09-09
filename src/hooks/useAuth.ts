import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { roleCan, type AppRole, type Feature } from '@/config/roles.config';

export interface AuthProfile {
  id: string;
  user_id: string;
  patron_id: string;
  full_name: string;
  surname: string | null;
  other_names: string | null;
  email: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  patron_category: string;
  account_role: string | null;
  student_type: string | null;
  institution: string | null;
  faculty_name: string | null;
  faculty_code: string | null;
  department: string | null;
  programme: string | null;
  duration_years: number | null;
  current_level: string | null;
  level: string | null;
  matric_number: string | null;
  staff_id: string | null;
  academic_rank: string | null;
  rank: string | null;
  research_interests: string[] | null;
  highest_qualification: string | null;
  professional_qualification: string | null;
  short_bio: string | null;
  preferred_branch: string | null;
  library_section: string | null;
  job_title: string | null;
  profile_photo_url: string | null;
  library_number: string | null;
  status: string;
  approved_at: string | null;
  email_verified_at: string | null;
  main_library_access_at: string | null;
  branch_approved_at: string | null;
  membership_expires_at: string | null;
}

interface AuthState {
  loading: boolean;
  user: User | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  /** primary effective role used for feature gating */
  role: AppRole | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    profile: null,
    roles: [],
    role: null,
  });

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState({ loading: false, user: null, profile: null, roles: [], role: null });
      return;
    }

    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from('patrons').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
    ]);

    const active = !profile || profile.status === 'active';
    const hasMainLibraryAccess = active || !!profile?.main_library_access_at;
    const roles = hasMainLibraryAccess ? (roleRows ?? []).map((r: { role: AppRole }) => r.role) : [];
    const profileRole = profile?.account_role as AppRole | undefined;
    const privilegedRoles: AppRole[] = ['super_admin', 'catalog_admin', 'ir_admin', 'dept_ir_officer', 'librarian', 'faculty_librarian'];
    // effective role: approved user_roles first; approved non-privileged patron role as fallback
    const priority: AppRole[] = [
      'super_admin', 'catalog_admin', 'ir_admin', 'dept_ir_officer', 'librarian', 'faculty_librarian',
      'researcher_lecturer', 'student', 'admin_staff', 'guest',
    ];
    let role: AppRole | null =
      priority.find((p) => roles.includes(p)) ??
      (hasMainLibraryAccess && profileRole && !privilegedRoles.includes(profileRole) ? profileRole : null);
    if (!role && user) role = 'guest';

    setState({
      loading: false,
      user,
      profile: (profile as AuthProfile) ?? null,
      roles,
      role,
    });
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        load();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const hasRole = useCallback(
    (...check: AppRole[]) => state.roles.some((r) => check.includes(r)) || (state.role ? check.includes(state.role) : false),
    [state.roles, state.role],
  );

  const can = useCallback(
    (feature: Feature) => roleCan(state.role, feature),
    [state.role],
  );

  const isApproved = !state.profile || state.profile.status === 'active';
  const hasMainLibraryAccess = isApproved || !!state.profile?.main_library_access_at;

  return { ...state, hasRole, can, isApproved, hasMainLibraryAccess, reload: load };
}
