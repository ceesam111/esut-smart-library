import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardLabel, roleCan } from '@/config/roles.config';

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

type NavItem = { label: string; href: string; icon: string; show?: boolean; accountManager?: boolean; module?: 'catalog' | 'ir' };
const adminNav: { group: string; items: NavItem[] }[] = [
  { group: 'Overview',  items: [
    { label: 'Dashboard',          href: '/admin',                       icon: '⊞' },
    { label: 'Analytics',          href: '/admin/analytics',             icon: '📊', show: institutionConfig.features.analytics },
  ]},
  { group: 'Patrons', items: [
    { label: 'Patron Directory',   href: '/admin/patrons',               icon: '👥' },
    { label: 'Bulk Import',        href: '/admin/patrons/import',        icon: '📥' },
  ]},
  { group: 'Collections', items: [
    { label: 'Library Catalog',    href: '/admin/catalogue',             icon: '📚', module: 'catalog' },
    { label: 'Add Catalog Item',   href: '/admin/catalog/add',           icon: '➕', module: 'catalog' },
    { label: 'CSV Import',         href: '/admin/catalogue/import',      icon: '📥', module: 'catalog' },
    { label: 'Import Staging',     href: '/admin/catalogue/staging',     icon: '✅', module: 'catalog' },
    { label: 'Adopt (Union)',      href: '/admin/catalogue/adopt',       icon: '🔁', module: 'catalog' },
    { label: 'Camera Scan',        href: '/admin/catalogue/scan',        icon: '📷', module: 'catalog' },
    { label: 'Barcodes',           href: '/admin/barcodes',              icon: '▌▌', module: 'catalog' },
    { label: 'Shelf Registry',     href: '/admin/shelves',               icon: '🗂️', module: 'catalog' },
    { label: 'IR Review Queue',    href: '/admin/repository',            icon: '🗄️', module: 'ir' },
    { label: 'Deposit to IR',      href: '/admin/ir/deposit',            icon: '⬆️', module: 'ir' },
    { label: 'Licensed Databases', href: '/admin/databases',             icon: '🔗' },
    { label: 'Acquisitions',       href: '/admin/acquisitions',          icon: '🛒' },
    { label: 'Serials',            href: '/admin/serials',               icon: '📰' },
    { label: 'Newspaper Index',    href: '/admin/newspaper-index',       icon: '🗞️' },
  ]},
  { group: 'Academic', items: [
    { label: 'Course Reserves',    href: '/admin/course-reserves',       icon: '📖', show: institutionConfig.features.courseReserves },
    { label: 'ILL Management',     href: '/admin/ill',                   icon: '📦' },
    { label: 'Researchers',        href: '/admin/researchers',           icon: '🔬', show: institutionConfig.features.researcherProfiles },
    { label: 'Academic Calendar',  href: '/admin/calendar',              icon: '📅' },
  ]},
  { group: 'Content', items: [
    { label: 'Blog',               href: '/admin/blog',                  icon: '✍️' },
    { label: 'Newsletter',         href: '/admin/newsletter',            icon: '📧' },
    { label: 'Events',             href: '/admin/events',                icon: '🎪' },
    { label: 'CMS Pages',          href: '/admin/cms',                   icon: '📄' },
    { label: 'Library Manual',     href: '/admin/library-manual',        icon: '📘' },
    { label: 'Team Members',       href: '/admin/team',                  icon: '🧑‍💼' },
    { label: 'AI Content Engine',  href: '/admin/content-engine',        icon: '🤖' },
    { label: 'AI Agent Workers',   href: '/admin/agents',                icon: '⚙️' },
  ]},
  { group: 'Reporting', items: [
    { label: 'Reports',            href: '/admin/reports',               icon: '📋' },
    { label: 'Webometrics',        href: '/admin/webometrics',           icon: '🌐', show: institutionConfig.features.webometrics },
    { label: 'Data Migration',     href: '/admin/migration',             icon: '🔄' },
  ]},
  { group: 'Consortium', items: [
    { label: 'Consortium Partners', href: '/admin/consortium',           icon: '🤝' },
  ]},
  { group: 'System', items: [
    { label: 'Account Management', href: '/admin/accounts',              icon: '🔐', accountManager: true },
  ]},
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { loading, role, isApproved } = useAuth();
  const isSuper = role === 'super_admin';
  const isAccountManager = isSuper || role === 'librarian';
  const canSeeCatalog = isSuper || role === 'catalog_admin' || role === 'librarian' || role === 'faculty_librarian';
  const canSeeIr = isSuper || role === 'ir_admin' || role === 'dept_ir_officer' || role === 'librarian' || role === 'faculty_librarian';
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  if (!isApproved || !roleCan(role, 'adminPanel')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-primary-900 mb-2">Admin Access Restricted</h1>
          <p className="text-sm text-neutral-600 mb-4">Your account must be approved and assigned a staff role before using the admin area.</p>
          <Link to="/dashboard" className="btn-primary text-sm">Back to Dashboard</Link>
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
            ← Public Site
          </Link>
          <div className="w-7 h-7 rounded-full bg-primary-700 flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
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
                (i) => i.show !== false && (!i.accountManager || isAccountManager) && (!i.module || (i.module === 'catalog' ? canSeeCatalog : canSeeIr)),
              );
              if (!visibleItems.length) return null;
              return (
              <div key={group.group}>
                <div className="text-[10px] font-semibold text-primary-400 uppercase tracking-widest px-3 pb-1.5">
                  {group.group}
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
                      {item.label}
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
