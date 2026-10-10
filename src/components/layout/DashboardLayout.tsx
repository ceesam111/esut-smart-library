import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { isAdminDashboardRole } from '@/config/roles.config';

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

const navItems: { labelKey: TranslationKey; href: string; icon: string; show?: boolean }[] = [
  { labelKey: 'dashboard.overview',       href: '/dashboard',                  icon: '⊞' },
  { labelKey: 'dashboard.myAccount',     href: '/dashboard/account',          icon: '👤' },
  { labelKey: 'dashboard.libraryCard',   href: '/dashboard/library-card',     icon: '🪪' },
  { labelKey: 'dashboard.myLoans',       href: '/dashboard/loans',            icon: '📚' },
  { labelKey: 'dashboard.illRequests',   href: '/dashboard/ill',              icon: '📦' },
  { labelKey: 'dashboard.readingLists',  href: '/dashboard/reading-lists',    icon: '📋' },
  { labelKey: 'dashboard.myThesis',      href: '/dashboard/thesis',           icon: '📄', show: institutionConfig.features.thesisPortal },
  { labelKey: 'dashboard.mySubmissions', href: '/dashboard/workflows',        icon: '📤' },
  { labelKey: 'dashboard.courseReserves',href: '/dashboard/course-reserves',  icon: '📖', show: institutionConfig.features.courseReserves },
  { labelKey: 'dashboard.myReservations',href: '/dashboard/requests',        icon: '🔖' },
  { labelKey: 'dashboard.settings',        href: '/dashboard/settings',          icon: '⚙️' },
  { labelKey: 'dashboard.researchProfile', href: '/dashboard/lecturer-profile',  icon: '🔬' },
];

const supervisorItems: { labelKey: TranslationKey; href: string; icon: string }[] = [
  { labelKey: 'dashboard.supervisedTheses', href: '/supervisor/theses', icon: '🎓' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { loading, can, hasRole, isApproved, hasMainLibraryAccess, profile, role } = useAuth();
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void supabase.auth.signOut().then(() => navigate('/login'));
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">{t('dashboard.loading')}</div>;

  if (isAdminDashboardRole(role)) {
    return <Navigate to="/admin" replace />;
  }

  if (!hasMainLibraryAccess) {
    const needsEmail = !profile?.email_verified_at;
    const resendVerification = async () => {
      setVerificationNotice(t('dashboard.sendingVerification'));
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setVerificationNotice(t('dashboard.signInAgain'));
      const res = await fetch('/api/registration/send-verification', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setVerificationNotice(t('dashboard.couldNotSendVerification'));
      setVerificationNotice(
        json.sent
          ? t('dashboard.verificationSent')
          : json.autoVerified
            ? t('dashboard.autoVerified')
            : t('dashboard.verificationBusy'),
      );
    };
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-primary-900 mb-2">{needsEmail ? t('dashboard.verificationRequired') : t('dashboard.registrationPending')}</h1>
          <p className="text-sm text-neutral-600 mb-4">
            {profile?.status === 'suspended'
              ? t('dashboard.suspendedNote')
              : needsEmail
                ? t('dashboard.verificationNote')
                : t('dashboard.pendingNote')}
          </p>
          {verificationNotice && <div className="mb-4 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">{verificationNotice}</div>}
          <div className="flex flex-col gap-2">
            {needsEmail && <button type="button" onClick={resendVerification} className="btn-primary text-sm">{t('dashboard.resendVerification')}</button>}
            <Link to={needsEmail ? '/login' : '/'} className="btn-outline text-sm">{needsEmail ? t('dashboard.backToLogin') : t('dashboard.returnHome')}</Link>
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
          aria-label={t('dashboard.toggleSidebar')}
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
          &bull; {hasRole('super_admin') ? t('dashboard.superAdminDashboard') : isStaff ? t('dashboard.staffDashboard') : isLecturer ? t('dashboard.researcherDashboard') : t('dashboard.patronDashboard')}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {!isApproved && profile?.main_library_access_at && (
            <span className="hidden sm:inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {t('dashboard.branchApprovalPending')}
            </span>
          )}
          <Link to="/ai-librarian" className="text-white/80 hover:text-white text-xs font-medium transition-colors">
            {t('dashboard.askAiLibrarian', { name: institutionConfig.librarianName })}
          </Link>
          <div className="relative group">
            <button className="flex items-center gap-2 text-white/90 hover:text-white transition-colors" aria-label={t('dashboard.userMenu')} aria-haspopup="true">
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
                {profile?.full_name?.[0] || profile?.email?.[0] || 'U'}
              </span>
              <span className="hidden sm:block text-sm font-medium">{profile?.full_name || profile?.email || 'User'}</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 hidden group-hover:block z-50">
              <Link to="/dashboard" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">{t('dashboard.myDashboard')}</Link>
              <Link to="/dashboard/account" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">{t('nav.myProfile')}</Link>
              <Link to="/dashboard/settings" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">{t('dashboard.settings')}</Link>
              <hr className="my-1 border-neutral-100" />
              <button
                onClick={async () => { await supabase.auth.signOut(); await navigate('/login'); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                {t('dashboard.signOut')}
              </button>
            </div>
          </div>
          <LanguageSwitcher id="lang-switcher-dashboard" />
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
              {t('dashboard.patron')}
            </div>
            {navItems
              .filter((i) => i.show !== false && (i.labelKey !== 'dashboard.researchProfile' || isLecturer))
              .map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/dashboard'}
                  className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
                >
                  <span className="text-base">{item.icon}</span>
                  {t(item.labelKey)}
                </NavLink>
              ))}

            {isLecturer && (
              <>
                <div className="border-t border-neutral-100 my-3" />
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 pb-2">
                  {t('dashboard.supervisor')}
                </div>
                {supervisorItems.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
                  >
                    <span className="text-base">{item.icon}</span>
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-neutral-100 space-y-1">
            {can('approvals') && (
              <Link to="/admin/approvals" className="sidebar-link text-xs">
                <span className="text-base">✅</span> {t('dashboard.approvals')}
              </Link>
            )}
            {can('adminPanel') && (
              <Link to="/admin" className="sidebar-link text-xs">
                <span className="text-base">⚙</span> {t('dashboard.staffAdmin')}
              </Link>
            )}
            <LanguageSwitcher id="lang-switcher-dashboard-sidebar" className="w-full justify-center mt-2" />
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
