import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import ShareButtons from '@/components/ShareButtons';
import { OPAC_URL } from '@/config/libraryResources.config';

const GOLD = '#D4A017';

const QUICK_LINKS = [
  { label: 'Home',                    href: '/' },
  { label: 'Search Catalogue',        href: '/catalogue' },
  { label: 'Browse Repository',       href: '/repository' },
  { label: 'Ask Lexis (AI Assistant)',href: '/ai-librarian' },
  { label: 'Newspapers',              href: '/newspapers' },
  { label: 'Events & Workshops',      href: '/events' },
  { label: 'Newsletter',              href: '/newsletter' },
  { label: 'Contact Us',              href: '/contact' },
];

const SERVICES_LINKS = [
  { label: 'Borrow & Return',     href: '/catalogue' },
  { label: 'Request a Resource',  href: '/dashboard/requests' },
  { label: 'Research Guides',     href: '/blog?category=research-guide' },
  { label: 'Subscribed Databases', href: '/subscribed-databases' },
  { label: 'Open Access Databases', href: '/open-access-databases' },
  { label: 'Database Access',     href: '/databases' },
  { label: 'Tutorial Guides',     href: '/tutorial' },
  { label: 'Privacy Policy',      href: '/privacy' },
  { label: 'Terms',               href: '/terms' },
];

const colStyle: React.CSSProperties = {
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
};

const headingStyle: React.CSSProperties = {
  color: GOLD,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: 16,
  display: 'block',
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'static', zIndex: 1 }}>

      {/* ── Layer 1: Main body ──────────────────────────────────── */}
      <div style={{ background: '#2A0B12', flexGrow: 1 }} className="text-white">
        <div style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '60px 24px 48px',
          boxSizing: 'border-box',
        }}>
          {/* Responsive 4-col grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 40,
            width: '100%',
            boxSizing: 'border-box',
            alignItems: 'start',
          }} className="footer-grid">
            <style>{`
              @media (max-width: 1024px) {
                .footer-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 32px !important; }
              }
              @media (max-width: 640px) {
                .footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
              }
            `}</style>

            {/* Col 1 — About */}
            <div style={colStyle}>
              <div className="text-xl font-bold text-white mb-1">ESUT Library</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 6 }}>
                Enugu State University of Science and Technology
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>
                Your gateway to knowledge, research and discovery.
              </div>
              <div className="flex gap-4 mt-5">
                <a href="tel:+2348039473344" title="+234 803 947 3344"
                  className="text-xl transition-opacity hover:opacity-75" style={{ color: GOLD }}>
                  📞
                </a>
                <a href="https://wa.me/2348039473344" target="_blank" rel="noopener noreferrer"
                  title="WhatsApp: +234 803 947 3344"
                  className="text-xl transition-opacity hover:opacity-75" style={{ color: GOLD }}>
                  💬
                </a>
                <a href="mailto:library@esut.edu.ng" title="library@esut.edu.ng"
                  className="text-xl transition-opacity hover:opacity-75" style={{ color: GOLD }}>
                  ✉️
                </a>
              </div>
            </div>

            {/* Col 2 — Quick Links */}
            <div style={colStyle}>
              <span style={headingStyle}>Quick Links</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {QUICK_LINKS.map((l) => (
                  <Link key={l.href} to={l.href}
                    style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, padding: '5px 0', display: 'block', lineHeight: 1.5, wordBreak: 'break-word' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)')}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Col 3 — Our Libraries */}
            <div style={{ ...colStyle, overflow: 'visible', maxHeight: 'none' }}>
              <span style={headingStyle}>Our Libraries</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FooterLibLink href={`/library/${institutionConfig.mainLibrary.slug}`}>
                  {institutionConfig.mainLibrary.name}
                </FooterLibLink>
                {institutionConfig.libraryMode === 'multi' && institutionConfig.branchLibraries.length > 0 && (
                  <>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontStyle: 'italic', padding: '4px 0' }}>
                      ─── Branch Libraries
                    </div>
                    {institutionConfig.branchLibraries.map((l) => (
                      <FooterLibLink key={l.slug} href={`/library/${l.slug}`}>
                        {l.name}
                      </FooterLibLink>
                    ))}
                  </>
                )}
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontStyle: 'italic', padding: '4px 0', marginTop: 4 }}>
                  ─── Faculty Libraries
                </div>
                {institutionConfig.facultyLibraries.map((l) => (
                  <FooterLibLink key={l.slug} href={`/library/${l.slug}`}>
                    {l.name}
                  </FooterLibLink>
                ))}
              </div>
            </div>

            {/* Col 4 — Services + Contact */}
            <div style={{ ...colStyle, overflow: 'visible' }}>
              <span style={headingStyle}>Services</span>
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 28 }}>
                {SERVICES_LINKS.map((l) => (
                  <Link key={l.href} to={l.href}
                    style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, padding: '4px 0', display: 'block', lineHeight: 1.5 }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')}
                  >
                    {l.label}
                  </Link>
                ))}
                <a
                  href={OPAC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, padding: '4px 0', display: 'block', lineHeight: 1.5 }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')}
                >
                  OPAC ↗
                </a>
              </div>

              <span style={headingStyle}>Contact</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6 }}>
                   📍 Enugu State University of Science and Technology
                </span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6 }}>
                  📍 Enugu, Enugu State, Nigeria
                </span>
                <a href="tel:+2348039473344"
                  style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6, display: 'block' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
                >
                  📞 +234 803 947 3344
                </a>
                <a href="https://wa.me/2348039473344" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6, display: 'block' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
                >
                  💬 WhatsApp Us
                </a>
                <a href="mailto:library@esut.edu.ng"
                  style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6, display: 'block' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GOLD)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
                >
                  ✉️ library@esut.edu.ng
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Layer 2: Share bar ──────────────────────────────────── */}
      <div style={{
        background: '#2A0B12',
        borderTop: '1px solid rgba(201,168,76,0.18)',
        padding: '18px 24px',
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
      }} className="flex flex-wrap items-center justify-center gap-3">
        <span style={{ color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Share this site
        </span>
        <ShareButtons
          title="ESUT Library — Enugu State University of Science and Technology"
          text="Explore the ESUT Library: catalogue, e-books, research and more."
          url={typeof window !== 'undefined' ? window.location.origin : 'https://virtuallibrary.esut.edu.ng'}
        />
      </div>

      {/* ── Layer 2b: Divider ───────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid rgba(201,168,76,0.18)',
        background: '#2A0B12',
        flexShrink: 0,
        width: '100%',
      }} />

      {/* ── Layer 3: Copyright bar ──────────────────────────────── */}
      <div style={{
        background: '#6B1D2A',
        padding: '16px 24px',
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
        position: 'static',
        clear: 'both',
      }} className="flex flex-wrap items-center justify-between gap-2">
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
          &copy; {year} ESUT Library. Enugu State University of Science and Technology. All rights reserved.
        </span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          Powered by{' '}
          <a
            href="mailto:scholarsuite25@gmail.com"
            style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
          >
            Scholar Suite
          </a>
        </span>
      </div>

    </footer>
  );
}

function FooterLibLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      to={href}
      style={{
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        display: 'block',
        padding: '3px 0',
        lineHeight: 1.5,
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GOLD)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)')}
    >
      {children}
    </Link>
  );
}
