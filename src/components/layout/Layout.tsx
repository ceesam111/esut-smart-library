import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import AILibrarianWidget from '@/components/ai/AILibrarianWidget';
import CookieConsent from '@/components/CookieConsent';
import PWAInstallBanner from '@/components/PWAInstallBanner';

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-800 focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 relative"
        style={{ zIndex: 2, paddingTop: isHome ? 0 : 64, paddingBottom: 0 }}
      >
        <Outlet />
      </main>
      <Footer />
      <AILibrarianWidget />
      <CookieConsent />
      <PWAInstallBanner />

      {/* Floating click-to-call — mobile only */}
      <a
        href="tel:+2347030162879"
        aria-label="Call Us"
        className="md:hidden fixed right-6 flex items-center justify-center w-13 h-13 rounded-full shadow-lg transition-opacity hover:opacity-90"
        style={{ bottom: '80px', zIndex: 39, background: '#1A4731', width: '52px', height: '52px' }}
        title="Call Us"
      >
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      </a>
    </div>
  );
}
