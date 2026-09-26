import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isAdminDashboardRole } from '@/config/roles.config';

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

const navItems = [
  { label: 'Overview',       href: '/dashboard',                  icon: '⊞' },
  { label: 'My Account',     href: '/dashboard/account',          icon: '👤' },
  { label: 'Library Card',   href: '/dashboard/library-card',     icon: '🪪' },
  { label: 'My Loans',       href: '/dashboard/loans',            icon: '📚' },
  { label: 'ILL Requests',   href: '/dashboard/ill',              icon: '📦' },
  { label: 'Reading Lists',  href: '/dashboard/reading-lists',    icon: '📋' },
  { label: 'My Thesis',      href: '/dashboard/thesis',           icon: '📄', show: institutionConfig.features.thesisPortal },
  { label: 'Course Reserves',href: '/dashboard/course-reserves',  icon: '📖', show: institutionConfig.features.courseReserves },
  { label: 'My Reservations',href: '/dashboard/requests',        icon: '🔖' },
  { label: 'Settings',        href: '/dashboard/settings',          icon: '⚙️' },
  { label: 'Research Profile', href: '/dashboard/lecturer-profile',  icon: '🔬' },
];

const supervisorItems = [
  { label: 'Supervised Theses', href: '/supervisor/theses', icon: '🎓' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { loading, can, hasRole, isApproved, hasMainLibraryAccess, profile, role } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
      navigate('/login');
    }, INACTIVITY_MS);
  }, [navigate]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Loading...</div>;

  if (isAdminDashboardRole(role)) {
    return <Navigate to="/admin" replace />;
  }

  if (!hasMainLibraryAccess) {
    const needsEmail = !profile?.email_verified_at;
    const resendVerification = async () => {
      setVerificationNotice('Sending verification email...');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setVerificationNotice('Please sign in again before requesting a new verification email.');
      const res = await fetch('/api/registration/send-verification', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      setVerificationNotice(res.ok ? 'Verification email sent. Please check your inbox.' : 'Could not send verification email. Contact the library desk if this continues.');
    };
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-primary-900 mb-2">{needsEmail ? 'Email Verification Required' : 'Registration Pending'}</h1>
          <p className="text-sm text-neutral-600 mb-4">
            {profile?.status === 'suspended'
              ? 'Your registration was not approved or your access is currently suspended.'
              : needsEmail
                ? 'Please verify your email address using the link sent to your inbox before accessing your dashboard.'
                : 'Your library registration is waiting for approval. You will be able to use the dashboard after approval.'}
          </p>
          {verificationNotice && <div className="mb-4 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">{verificationNotice}</div>}
          <div className="flex flex-col gap-2">
            {needsEmail && <button type="button" onClick={resendVerification} className="btn-primary text-sm">Resend Verification Email</button>}
            <Link to={needsEmail ? '/login' : '/'} className="btn-outline text-sm">{needsEmail ? 'Back to Login' : 'Return to Library Home'}</Link>
          </div>
        </div>
      </div>
    );
  }

  const isLecturer = hasRole('researcher_lecturer');
  const isStaff = hasRole('librarian') || hasRole('faculty_librarian') || hasRole('super_admin');

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top bar */}
      <div
        className="fixed top-0 inset-x-0 z-40 h-16 flex items-center px-4 sm:px-6 gap-4"
        style={{ background: 'var(--color-primary)' }}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden text-white p-1"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to="/" className="flex items-center gap-2 text-white">
          <span className="font-serif font-semibold text-sm">
            {institutionConfig.shortName} Library
          </span>
        </Link>
        <span className="text-white/50 text-sm hidden sm:block">
          &bull; {hasRole('super_admin') ? 'Super Admin Dashboard' : isStaff ? 'Staff Dashboard' : isLecturer ? 'Researcher Dashboard' : 'Patron Dashboard'}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {!isApproved && profile?.main_library_access_at && (
            <span className="hidden sm:inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Branch approval pending
            </span>
          )}
          <Link to="/ai-librarian" className="text-white/80 hover:text-white text-xs font-medium transition-colors">
            Ask {institutionConfig.librarianName}
          </Link>
        </div>
      </div>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 left-0 z-30 h-[calc(100vh-4rem)] w-64 bg-white border-r border-neutral-200
            flex-col overflow-y-auto transition-transform duration-200
            ${sidebarOpen ? 'flex translate-x-0' : 'hidden lg:flex'}`}
        >
          <nav className="p-4 space-y-1 flex-1">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 pb-2">
              Patron
            </div>
            {navItems
              .filter((i) => i.show !== false && (i.label !== 'Research Profile' || isLecturer))
              .map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/dashboard'}
                  className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}

            {isLecturer && (
              <>
                <div className="border-t border-neutral-100 my-3" />
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 pb-2">
                  Supervisor
                </div>
                {supervisorItems.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-neutral-100 space-y-1">
            {can('approvals') && (
              <Link to="/admin/approvals" className="sidebar-link text-xs">
                <span className="text-base">✅</span> Approvals
              </Link>
            )}
            {can('adminPanel') && (
              <Link to="/admin" className="sidebar-link text-xs">
                <span className="text-base">⚙</span> Staff Admin
              </Link>
            )}
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
