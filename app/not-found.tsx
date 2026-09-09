// app/not-found.tsx
// Renders the existing NotFound page for 404s
import dynamic from 'next/dynamic';

const NotFoundClient = dynamic(() => import('@/NotFoundClient'), { ssr: false });

export default function NotFound() {
  return <NotFoundClient />;
}
