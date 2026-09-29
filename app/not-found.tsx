'use client';

import dynamic from 'next/dynamic';

const NotFoundClient = dynamic(() => import('@/NotFoundClient'), { ssr: false });

export default function NotFound() {
  return <NotFoundClient />;
}
