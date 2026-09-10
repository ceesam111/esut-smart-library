export const dynamic = 'force-static';

export function GET() {
  return Response.json({
    name: 'ESUT Library',
    short_name: 'ESUT Library',
    description: 'ESUT Library - Enugu State University of Science and Technology. Access academic resources from your phone, works offline.',
    start_url: '/',
    display: 'standalone',
    background_color: '#6B1D2A',
    theme_color: '#6B1D2A',
    lang: 'en-NG',
    orientation: 'portrait-primary',
    categories: ['education', 'books'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Search Catalogue', short_name: 'Catalogue', description: 'Search the library catalogue', url: '/catalogue', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Ask Lexis AI', short_name: 'Lexis AI', description: 'Ask our AI Reference Librarian', url: '/ai-librarian', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'My Dashboard', short_name: 'Dashboard', description: 'View your library account', url: '/dashboard', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Events', short_name: 'Events', description: 'Upcoming library events', url: '/events', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
    screenshots: [
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', form_factor: 'narrow', label: 'ESUT Library home screen' },
    ],
  }, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
