import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getDashboardLabel, roleCan, type Feature } from '@/config/roles.config';
import { LIBRARY_ADMIN_ROLES, VISIBILITY_ADMIN_ROLES } from '@/server/auth/permissions';

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

type NavItem = { labelKey: TranslationKey; href: string; icon: string; show?: boolean; accountManager?: boolean; module?: 'catalog' | 'ir'; feature?: Feature; roles?: string[] };
const adminNav: { groupKey: TranslationKey; items: NavItem[] }[] = [
  { groupKey: 'admin.overview',  items: [
    { labelKey: 'admin.dashboard',          href: '/admin',                       icon: '⊞' },
    { labelKey: 'admin.analytics',          href: '/admin/analytics',             icon: '📊', show: institutionConfig.features.analytics },
  ]},
  { groupKey: 'admin.patrons', items: [
    { labelKey: 'admin.patronDirectory',   href: '/admin/patrons',               icon: '👥' },
    { labelKey: 'admin.approvals',          href: '/admin/approvals',             icon: '✅', feature: 'approvals' },
    { labelKey: 'admin.bulkImport',        href: '/admin/patrons/import',        icon: '📥' },
  ]},
  { groupKey: 'admin.collections', items: [
    { labelKey: 'admin.libraryCatalog',    href: '/admin/catalogue',             icon: '📚', module: 'catalog' },
    { labelKey: 'admin.addCatalogItemNav',   href: '/admin/catalog/add',           icon: '➕', module: 'catalog' },
    { labelKey: 'admin.csvImport',         href: '/admin/catalogue/import',      icon: '📥', module: 'catalog' },
    { labelKey: 'admin.importStaging',     href: '/admin/catalogue/staging',     icon: '✅', module: 'catalog' },
    { labelKey: 'admin.adoptUnion',      href: '/admin/catalogue/adopt',       icon: '🔁', module: 'catalog' },
    { labelKey: 'admin.cameraScan',        href: '/admin/catalogue/scan',        icon: '📷', module: 'catalog' },
    { labelKey: 'admin.barcodes',           href: '/admin/barcodes',              icon: '▌▌', module: 'catalog' },
    { labelKey: 'admin.shelfRegistry',     href: '/admin/shelves',               icon: '🗂️', module: 'catalog' },
    { labelKey: 'admin.irReviewQueue',    href: '/admin/repository',            icon: '🗄️', module: 'ir' },
    { labelKey: 'admin.depositToIr',      href: '/admin/ir/deposit',            icon: '⬆️', module: 'ir' },
    { labelKey: 'admin.licensedDatabases', href: '/admin/databases',             icon: '🔗' },
    { labelKey: 'admin.openAccessDatabases', href: '/admin/open-access-databases', icon: '🌐' },
    { labelKey: 'admin.subscribedDatabases',  href: '/admin/subscribed-databases',  icon: '💳' },
    { labelKey: 'admin.acquisitions',       href: '/admin/acquisitions',          icon: '🛒' },
    { labelKey: 'admin.serials',            href: '/admin/serials',               icon: '📰' },
    { labelKey: 'admin.newspaperIndex',    href: '/admin/newspaper-index',       icon: '🗞️' },
  ]},
  { groupKey: 'admin.academic', items: [
    { labelKey: 'admin.courseReserves',    href: '/admin/course-reserves',       icon: '📖', show: institutionConfig.features.courseReserves },
    { labelKey: 'admin.illManagement',     href: '/admin/ill',                   icon: '📦' },
    { labelKey: 'admin.submissionWorkflows', href: '/admin/workflows',           icon: '✅' },
    { labelKey: 'admin.bookRequests',      href: '/admin/requests',              icon: '🔖' },
    { labelKey: 'admin.researchers',        href: '/admin/researchers',           icon: '🔬', show: institutionConfig.features.researcherProfiles },
    { labelKey: 'admin.academicCalendar',  href: '/admin/calendar',              icon: '📅' },
  ]},
  { groupKey: 'admin.content', items: [
    { labelKey: 'admin.blog',               href: '/admin/blog',                  icon: '✍️' },
    { labelKey: 'admin.newsletter',         href: '/admin/newsletter',            icon: '📧' },
    { labelKey: 'admin.events',             href: '/admin/events',                icon: '🎪' },
    { labelKey: 'admin.cmsPages',          href: '/admin/cms',                   icon: '📄' },
    { labelKey: 'admin.libraryManual',     href: '/admin/library-manual',        icon: '📘' },
    { labelKey: 'admin.teamMembers',       href: '/admin/team',                  icon: '🧑‍💼' },
    { labelKey: 'admin.aiContentEngine',  href: '/admin/content-engine',        icon: '🤖' },
    { labelKey: 'admin.aiAgentWorkers',   href: '/admin/agents',                icon: '⚙️' },
    { labelKey: 'admin.noticeTemplates',   href: '/admin/notices',               icon: '🔔' },
    { labelKey: 'admin.deliveryHistory',   href: '/admin/notices/delivery',      icon: '📨' },
  ]},
  { groupKey: 'admin.reporting', items: [
    { labelKey: 'admin.reports',            href: '/admin/reports',               icon: '📋' },
    { labelKey: 'admin.webometrics',        href: '/admin/webometrics',           icon: '🌐', show: institutionConfig.features.webometrics },
    { labelKey: 'admin.visibilityIndexing', href: '/admin/visibility',            icon: '🧭', roles: VISIBILITY_ADMIN_ROLES },
    { labelKey: 'admin.dataMigration',     href: '/admin/migration',             icon: '🔄' },
  ]},
  { groupKey: 'admin.consortium', items: [
    { labelKey: 'admin.consortiumPartners', href: '/admin/consortium',           icon: '🤝' },
  ]},
  { groupKey: 'admin.circulation', items: [
    { labelKey: 'admin.circulationDeskNav',    href: '/admin/circulation',           icon: '🧾' },
    { labelKey: 'admin.offlineSync',        href: '/admin/offline-sync',          icon: '📶' },
    { labelKey: 'admin.sip2Terminals',      href: '/admin/sip2-terminals',        icon: '📟' },
  ]},
  { groupKey: 'slaas.navGroup', items: [
    { labelKey: 'slaas.dashboard',   href: '/admin/access',             icon: '🚪', roles: LIBRARY_ADMIN_ROLES },
    { labelKey: 'slaas.scanner',     href: '/admin/access/scanner',     icon: '📷', roles: LIBRARY_ADMIN_ROLES },
    { labelKey: 'slaas.visitors',    href: '/admin/access/visitors',    icon: '🪪', roles: LIBRARY_ADMIN_ROLES },
    { labelKey: 'slaas.branches',    href: '/admin/access/branches',    icon: '🏢', roles: LIBRARY_ADMIN_ROLES },
    { labelKey: 'slaas.visits',      href: '/admin/access/visits',      icon: '📋', roles: LIBRARY_ADMIN_ROLES },
  ]},
  { groupKey: 'admin.system', items: [
    { labelKey: 'admin.accountManagement', href: '/admin/accounts',              icon: '🔐', accountManager: true },
    { labelKey: 'admin.preservation',        href: '/admin/preservation',           icon: '◆' },
  ]},
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { loading, role, isApproved } = useAuth();
  const { t } = useI18n();
  const isSuper = role === 'super_admin';
  const isAccountManager = isSuper || role === 'librarian';
  const canSeeCatalog = isSuper || role === 'catalog_admin' || role === 'librarian' || role === 'faculty_librarian';
  const canSeeIr = isSuper || role === 'ir_admin' || role === 'dept_ir_officer' || role === 'librarian' || role === 'faculty_librarian';
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  if (!isApproved || !roleCan(role, 'adminPanel')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-primary-900 mb-2">{t('admin.accessRestricted')}</h1>
          <p className="text-sm text-neutral-600 mb-4">{t('admin.accessRestrictedDesc')}</p>
          <Link to="/dashboard" className="btn-primary text-sm">{t('admin.backToDashboard')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Top bar */}
      <div className="fixed top-0 inset-x-0 z-40 h-16 bg-primary-900 flex items-center px-4 gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden text-white p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to="/" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold font-mono"
            style={{ background: institutionConfig.secondaryColour }}
          >
            {institutionConfig.shortName.slice(0, 3)}
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">
            {institutionConfig.shortName} &mdash; {getDashboardLabel(role)}
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Link to="/" className="text-primary-300 hover:text-white text-xs transition-colors">
            ← {t('admin.publicSite')}
          </Link>
          <div className="w-7 h-7 rounded-full bg-primary-700 flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
          <LanguageSwitcher id="lang-switcher-admin" />
        </div>
      </div>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 left-0 z-30 h-[calc(100vh-4rem)] w-60 bg-primary-900
            flex-col overflow-y-auto scrollbar-thin transition-transform duration-200
            ${sidebarOpen ? 'flex translate-x-0' : 'hidden lg:flex'}`}
        >
          <nav className="p-3 space-y-4 flex-1">
            {adminNav.map((group) => {
              const visibleItems = group.items.filter(
                (i) => i.show !== false && (!i.feature || roleCan(role, i.feature)) && (!i.accountManager || isAccountManager) && (!i.module || (i.module === 'catalog' ? canSeeCatalog : canSeeIr)) && (!i.roles || (!!role && i.roles.includes(role))),
              );
              if (!visibleItems.length) return null;
              return (
              <div key={group.groupKey}>
                <div className="text-[10px] font-semibold text-primary-400 uppercase tracking-widest px-3 pb-1.5">
                  {t(group.groupKey)}
                </div>
                {visibleItems.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      end={item.href === '/admin'}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150
                         ${isActive
                          ? 'bg-primary-700 text-white'
                          : 'text-primary-200 hover:bg-primary-800 hover:text-white'}`
                      }
                    >
                      <span className="text-sm">{item.icon}</span>
                      {t(item.labelKey)}
                    </NavLink>
                  ))}
              </div>
              );
            })}
          </nav>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
