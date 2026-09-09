// This is the Next.js root page — it renders the full Vite/React SPA
// using a client component so that React Router, browser APIs, and all
// existing components work unchanged.
import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const ClientApp = nextDynamic(() => import('@/ClientApp'), { ssr: false });

export default function Page() {
  return <ClientApp />;
}
