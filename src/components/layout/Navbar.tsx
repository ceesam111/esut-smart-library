import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import NotificationBell from '@/components/NotificationBell';
import { getDashboardLabel, getDashboardPath, type AppRole } from '@/config/roles.config';
import { OPAC_URL } from '@/config/libraryResources.config';

// ── Nav structure ─────────────────────────────────────────────────────────────

const hasBranches = institutionConfig.libraryMode === 'multi' && institutionConfig.branchLibraries.length > 0;

const LIBRARIES_MENU = {
  main: {
    label: institutionConfig.mainLibrary.name,
    href: `/library/${institutionConfig.mainLibrary.slug}`,
  },
  branch: institutionConfig.branchLibraries.map((l) => ({
    label: l.name,
    href: `/library/${l.slug}`,
  })),
  faculty: institutionConfig.facultyLibraries.map((l) => ({
    label: l.name,
    href: `/library/${l.slug}`,
  })),
};

const NAV_ITEMS = [
  {
    label: 'Libraries',
    dropdown: 'libraries',
  },
  {
    label: 'Library Catalog',
    dropdown: 'catalogue',
    links: [
      { label: 'Search Books & Journals', href: '/catalog' },
      { label: 'New Arrivals',           href: '/catalogue?filter=new' },
      { label: 'Browse by Subject',      href: '/categories' },
      { label: 'OPAC',                   href: OPAC_URL, external: true },
      { label: 'Reference Services',      href: '/course-reserves' },
      { label: 'Request a Resource',     href: '/dashboard/requests' },
    ],
  },
  {
    label: 'Institutional Repository',
    dropdown: 'repository',
    links: [
      { label: 'Search Research & Theses', href: '/repository' },
      { label: 'Submit a Work',          href: '/repository/submit' },
      { label: 'Theses & Dissertations', href: '/theses' },
      { label: 'Projects & Reports',     href: '/theses' },
      { label: 'Open Access Databases',  href: '/open-access-databases' },
    ],
  },
  {
    label: 'Research',
    dropdown: 'research',
    links: [
      { label: 'Ask Lexis — AI Reference Librarian', href: '/ai-librarian' },
      { label: 'Library AI Tools',          href: '/ai-tools' },
      { label: 'Federated Search',          href: '/search/global' },
      { label: 'Subscribed Databases',      href: '/subscribed-databases' },
      { label: 'Open Access Databases',     href: '/open-access-databases' },
      { label: 'Licensed Databases',        href: '/databases' },
      { label: 'OPAC',                      href: OPAC_URL, external: true },
      { label: 'Newspapers',                href: '/newspapers' },
      { label: 'Theses & Projects',         href: '/theses' },
      { label: 'Our Researchers',           href: '/lecturers' },
    ],
  },
  {
    label: 'Events',
    dropdown: 'events',
    links: [
      { label: 'Events & Workshops',     href: '/events' },
      { label: 'Media Centre',           href: '/media' },
      { label: 'Library Blog',           href: '/blog' },
      { label: 'Newsletter',             href: '/newsletter' },
    ],
  },
  {
    label: 'Community',
    dropdown: 'community',
    links: [
      { label: 'Community & Wellbeing',  href: '/community' },
      { label: 'Community Feed',         href: '/feed' },
      { label: 'Wellbeing Corner',       href: '/wellbeing' },
      { label: 'Discussion Forum',       href: '/forum' },
      { label: 'Book Clubs',             href: '/book-clubs' },
    ],
  },
  {
    label: 'Services',
    dropdown: 'services',
    links: [
      { label: 'Borrow & Return',        href: '/catalogue' },
      { label: 'Request a Resource',     href: '/dashboard/requests' },
      { label: 'Academic Integrity',     href: '/academic-integrity' },
      { label: 'Events & Workshops',     href: '/events' },
      { label: 'Community Forum',        href: '/forum' },
      { label: 'Library Blog',           href: '/blog' },
      { label: 'Newsletter',             href: '/newsletter' },
      { label: 'Tutorial Guides',        href: '/tutorial' },
      { label: 'Contact Library',        href: '/contact' },
    ],
  },
  {
    label: 'About',
    dropdown: 'about',
    links: [
      { label: 'About ESUT Library',   href: '/about' },
      { label: 'Our Team',              href: '/team' },
      { label: 'Contact Us',            href: '/contact' },
      { label: 'FAQ',                   href: '/faq' },
      { label: 'Accessibility',         href: '/accessibility' },
      { label: 'Privacy Policy',        href: '/privacy' },
      { label: 'Terms of Use',          href: '/terms' },
    ],
  },
];

// ── Colour constants ──────────────────────────────────────────────────────────
const GREEN = '#6B1D2A';
const GOLD  = '#D4A017';

// ── Desktop dropdown ──────────────────────────────────────────────────────────

function DesktopDropdown({
  open,
  onEnter,
  onLeave,
  children,
}: {
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  children: React.ReactNode;
}) {
  return (
    /* 8px invisible bridge fills the gap between trigger and panel so mouse movement doesn't close it */
    <div
      className={`absolute left-0 z-[1000] transition-all duration-150 origin-top pt-2
        ${open ? 'opacity-100 scale-y-100 pointer-events-auto' : 'opacity-0 scale-y-95 pointer-events-none'}`}
      style={{ top: '100%' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid rgba(0,0,0,0.06)',
          padding: '6px 0',
          minWidth: 260,
          overflow: 'visible',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DropdownItem({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm font-medium transition-colors duration-100"
        style={{
          display: 'block',
          padding: '10px 20px',
          fontSize: 14,
          color: '#1A1A1A',
          background: 'transparent',
          borderRadius: 6,
          margin: '1px 6px',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = GREEN;
          el.style.color = '#ffffff';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = 'transparent';
          el.style.color = '#1A1A1A';
        }}
      >
        {children} <span aria-hidden="true" style={{ fontSize: 10 }}>↗</span>
      </a>
    );
  }
  return (
    <NavLink
      to={href}
      className="block text-sm font-medium transition-colors duration-100"
      style={({ isActive }) => ({
        display: 'block',
        padding: '10px 20px',
        fontSize: 14,
        color: isActive ? '#ffffff' : '#1A1A1A',
        background: isActive ? GREEN : 'transparent',
        borderRadius: 6,
        margin: '1px 6px',
      })}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = GREEN;
        el.style.color = '#ffffff';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        const isActive = el.getAttribute('aria-current') === 'page';
        el.style.background = isActive ? GREEN : 'transparent';
        el.style.color = isActive ? '#ffffff' : '#1A1A1A';
      }}
    >
      {children}
    </NavLink>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: GOLD,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '10px 20px 4px',
        pointerEvents: 'none',
        cursor: 'default',
        background: 'transparent',
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        borderTop: '1px solid rgba(0,0,0,0.07)',
        margin: '4px 0',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Main Navbar ───────────────────────────────────────────────────────────────

export default function Navbar() {
  const [scrolled, setScrolled]       = useState(false);
  const [openMenu, setOpenMenu]       = useState<string | null>(null);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [user, setUser]               = useState<any>(null);
  const [patron, setPatron]           = useState<any>(null);
  const [role, setRole]               = useState<AppRole | null>(null);
  const [userDropOpen, setUserDropOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close everything on route change
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
    setUserDropOpen(false);
  }, [location]);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auth state
  useEffect(() => {
    const loadAccount = async (userId: string) => {
      const [{ data: patronData }, { data: roleRows }] = await Promise.all([
        supabase.from('patrons').select('full_name, patron_category, profile_photo_url, status, account_role, main_library_access_at')
          .eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);
      setPatron(patronData);
      const hasAccess = !patronData || patronData.status === 'active' || !!patronData.main_library_access_at;
      const roles = hasAccess ? (roleRows ?? []).map((row: { role: AppRole }) => row.role) : [];
      const priority: AppRole[] = ['super_admin', 'librarian', 'faculty_librarian', 'researcher_lecturer', 'student', 'admin_staff', 'guest'];
      setRole(priority.find((candidate) => roles.includes(candidate)) ?? (hasAccess ? (patronData?.account_role as AppRole | null) : null) ?? null);
    };

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (u) loadAccount(u.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadAccount(session.user.id);
      if (!session?.user) {
        setPatron(null);
        setRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const dashboardPath = getDashboardPath(role);
  const dashboardLabel = getDashboardLabel(role);
  const accountMenuItems = [
    { label: dashboardLabel, href: dashboardPath },
    ...(dashboardPath === '/admin' ? [] : [
      { label: 'My Library Card', href: '/dashboard/library-card' },
      { label: 'My Profile', href: '/dashboard/my-profile' },
      { label: 'My Loans', href: '/dashboard/loans' },
      { label: 'My Requests', href: '/dashboard/requests' },
    ]),
  ];

  const openDropdown = (key: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpenMenu(key);
  };

  const scheduleClose = () => {
    timerRef.current = setTimeout(() => setOpenMenu(null), 120);
  };

  const keepOpen = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-50 transition-shadow duration-200"
        style={{
          background: GREEN,
          boxShadow: scrolled ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2 xl:gap-4 min-w-0">

            {/* ── Logo + wordmark ──────────────────────────────────── */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 min-w-0">
              <img
                src="/assets/esut-logo.png"
                alt="ESUT Library"
                className="w-9 h-9 rounded-lg object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-white font-bold text-base leading-tight hidden sm:block whitespace-nowrap">
                ESUT Library
              </span>
            </Link>

            {/* ── Desktop nav ──────────────────────────────────────── */}
            <nav className="hidden xl:flex items-center gap-0.5 flex-1 justify-center min-w-0 overflow-visible">
              {/* Libraries dropdown */}
              <div className="relative">
                <button
                  onMouseEnter={() => openDropdown('libraries')}
                  onMouseLeave={scheduleClose}
                  className="flex items-center gap-1 px-2 2xl:px-3 py-2 rounded-md text-[13px] 2xl:text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-100 whitespace-nowrap"
                >
                  Libraries
                  <svg className="w-3.5 h-3.5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <DesktopDropdown
                  open={openMenu === 'libraries'}
                  onEnter={keepOpen}
                  onLeave={scheduleClose}
                >
                  <SectionLabel>Our Libraries</SectionLabel>
                  <DropdownItem href={LIBRARIES_MENU.main.href}>
                    {LIBRARIES_MENU.main.label}
                  </DropdownItem>
                  {hasBranches && (
                    <>
                      <Divider />
                      <SectionLabel>Branch Libraries</SectionLabel>
                      {LIBRARIES_MENU.branch.map((l) => (
                        <DropdownItem key={l.href} href={l.href}>{l.label}</DropdownItem>
                      ))}
                    </>
                  )}
                  <Divider />
                  <SectionLabel>Faculty Libraries</SectionLabel>
                  <DropdownItem href="/faculty-libraries">All Faculty Libraries</DropdownItem>
                  {LIBRARIES_MENU.faculty.map((l) => (
                    <DropdownItem key={l.href} href={l.href}>{l.label}</DropdownItem>
                  ))}

                </DesktopDropdown>
              </div>

              {/* Other menu items */}
              {NAV_ITEMS.filter((n) => n.dropdown !== 'libraries').map((item) => (
                <div key={item.label} className="relative">
                  <button
                    onMouseEnter={() => openDropdown(item.dropdown)}
                    onMouseLeave={scheduleClose}
                    className="flex items-center gap-1 px-2 2xl:px-3 py-2 rounded-md text-[13px] 2xl:text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-100 whitespace-nowrap"
                  >
                    {item.label}
                    <svg className="w-3.5 h-3.5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {item.links && (
                    <DesktopDropdown
                      open={openMenu === item.dropdown}
                      onEnter={keepOpen}
                      onLeave={scheduleClose}
                    >
                      {item.links.map((link) => (
                        <DropdownItem
                          key={link.label}
                          href={link.href}
                          external={'external' in link ? link.external : undefined}
                        >
                          {link.label}
                        </DropdownItem>
                      ))}
                    </DesktopDropdown>
                  )}
                </div>
              ))}
            </nav>

            {/* ── Right actions ────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Search */}
              <Link
                to="/search/global"
                className="p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </Link>

              {/* Lexis */}
              <Link
                to="/ai-librarian"
                className="hidden xl:flex items-center gap-1.5 px-2 2xl:px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 text-white/90 hover:text-white hover:bg-white/10 whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="hidden 2xl:inline">Ask Lexis</span>
              </Link>

              {user ? (
                /* Authenticated: notification bell + avatar + dropdown */
                <>
                  <NotificationBell />
                  <div className="relative">
                  <button
                    onClick={() => setUserDropOpen(!userDropOpen)}
                    className="flex items-center gap-2 focus:outline-none"
                    aria-label="User menu"
                  >
                    {patron?.profile_photo_url ? (
                      <img src={patron.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white/30" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white/30 text-neutral-800"
                        style={{ background: GOLD }}
                      >
                        {patron?.full_name?.slice(0, 2).toUpperCase() ?? 'ME'}
                      </div>
                    )}
                  </button>
                  {userDropOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-neutral-100 py-2 z-50">
                      {patron?.full_name && (
                        <>
                          <div className="px-4 py-2 text-xs text-neutral-500 font-medium truncate">
                            {patron.full_name}
                          </div>
                          <Divider />
                        </>
                      )}
                      {accountMenuItems.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          className="block px-4 py-2.5 text-sm text-neutral-700 hover:text-white transition-colors duration-100"
                          style={{ ['--hover-bg' as string]: GREEN }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = GREEN; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
                        >
                          {item.label}
                        </Link>
                      ))}
                      <Divider />
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-100"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden xl:block px-3 2xl:px-4 py-1.5 rounded-md text-xs font-semibold border border-white/50 text-white hover:bg-white/10 transition-all duration-150 whitespace-nowrap"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="hidden xl:block px-3 2xl:px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 text-neutral-900 hover:opacity-90 whitespace-nowrap"
                    style={{ background: GOLD }}
                  >
                    Sign Up
                  </Link>
                </>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="xl:hidden p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 xl:hidden"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer */}
          <div
            className="fixed top-0 left-0 h-full w-80 max-w-[85vw] z-50 xl:hidden flex flex-col overflow-y-auto"
            style={{ background: GREEN }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <span className="text-white font-bold text-base">ESUT Library</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-white/70 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 py-3">
              {/* Libraries section */}
              <MobileSection
                label="Libraries"
                open={mobileSection === 'libraries'}
                onToggle={() => setMobileSection(mobileSection === 'libraries' ? null : 'libraries')}
              >
                <div className="px-5 py-1 text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                  Our Libraries
                </div>
                <MobileLink href={LIBRARIES_MENU.main.href}>{LIBRARIES_MENU.main.label}</MobileLink>
                {hasBranches && (
                  <>
                    <div className="px-5 py-1 text-xs text-white/40 font-semibold mt-1">Branch Libraries</div>
                    {LIBRARIES_MENU.branch.map((l) => (
                      <MobileLink key={l.href} href={l.href}>{l.label}</MobileLink>
                    ))}
                  </>
                )}
                <div className="px-5 py-1 text-xs text-white/40 font-semibold mt-1">Faculty Libraries</div>
                <MobileLink href="/faculty-libraries">All Faculty Libraries</MobileLink>
                {LIBRARIES_MENU.faculty.map((l) => (
                  <MobileLink key={l.href} href={l.href}>{l.label}</MobileLink>
                ))}

              </MobileSection>

              {NAV_ITEMS.filter((n) => n.dropdown !== 'libraries').map((item) => (
                <MobileSection
                  key={item.label}
                  label={item.label}
                  open={mobileSection === item.dropdown}
                  onToggle={() => setMobileSection(mobileSection === item.dropdown ? null : item.dropdown)}
                >
                  {item.links?.map((link) => (
                    <MobileLink
                      key={link.label}
                      href={link.href}
                      external={'external' in link ? link.external : undefined}
                    >
                      {link.label}
                    </MobileLink>
                  ))}
                </MobileSection>
              ))}
            </div>

            {/* Drawer footer */}
            <div className="border-t border-white/10 px-5 py-4 space-y-3">
              <div className="flex gap-2">
                {user ? (
                  <Link
                    to={dashboardPath}
                    className="flex-1 text-center py-2 rounded-md text-sm font-semibold text-neutral-900 hover:opacity-90 transition-opacity"
                    style={{ background: GOLD }}
                  >
                    {dashboardLabel}
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="flex-1 text-center py-2 rounded-md text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="flex-1 text-center py-2 rounded-md text-sm font-semibold text-neutral-900 hover:opacity-90 transition-opacity"
                      style={{ background: GOLD }}
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4 pt-1">
                <a
                  href="tel:+2348039473344"
                  className="flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: GOLD }}
                >
                  📞 +234 803 947 3344
                </a>
              </div>
              <a
                href="https://wa.me/2348039473344"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: GOLD }}
              >
                💬 WhatsApp Us
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Mobile sub-components ─────────────────────────────────────────────────────

function MobileSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-white/90 hover:text-white hover:bg-white/5 transition-colors"
      >
        {label}
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="bg-black/10">
          {children}
        </div>
      )}
    </div>
  );
}

function MobileLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-7 py-2.5 text-sm text-white/75 hover:text-white transition-colors duration-100"
      >
        {children} <span aria-hidden="true" style={{ fontSize: 10 }}>↗</span>
      </a>
    );
  }
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        `block px-7 py-2.5 text-sm transition-colors duration-100
         ${isActive ? 'text-white font-semibold' : 'text-white/75 hover:text-white'}`
      }
    >
      {children}
    </NavLink>
  );
}
