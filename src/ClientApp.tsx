'use client';

import App from '@/App';
import { installCsrfFetch } from '@/lib/csrfFetch';

installCsrfFetch();

export default function ClientApp() {
  return <App />;
}
