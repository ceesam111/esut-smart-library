import type { Metadata } from 'next';
import '../src/styles.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || 'https://virtuallibrary.esut.edu.ng'),
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
      </head>
      <body>{children}</body>
    </html>
  );
}
