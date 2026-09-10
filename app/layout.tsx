import type { Metadata } from 'next';
import '../src/styles.css';

export const metadata: Metadata = {
  title: 'ESUT Smart Library',
  description:
    'The official digital library platform of Enugu State University of Science and Technology — powering research, catalogues, repositories, AI-librarian services, and academic resources.',
  keywords: ['ESUT', 'library', 'university library', 'academic library', 'digital library', 'Enugu', 'Nigeria', 'smart library'],
  openGraph: {
    title: 'ESUT Smart Library',
    description: 'Powering academic research and library services at Enugu State University of Science and Technology.',
    type: 'website',
    locale: 'en_NG',
    siteName: 'ESUT Smart Library',
  },
  icons: {
    icon: '/assets/esut-favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" id="theme-color" content="#6B1D2A" />
        <link rel="manifest" href="/api/manifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
