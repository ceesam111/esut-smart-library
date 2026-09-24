import { Link } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import LibraryResourceCard from '@/components/LibraryResourceCard';
import { usePageTitle } from '@/hooks/usePageTitle';
import { SUBSCRIBED_DATABASES } from '@/config/subscribedDatabases.data';
import {
  LIBRARIAN_WHATSAPP_URL,
  OPAC_URL,
} from '@/config/libraryResources.config';

export default function SubscribedDatabases() {
  usePageTitle('Subscribed Databases');

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <BackButton />

      <div className="mb-8">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: '#D4A017' }}
        >
          Library Resources
        </p>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Subscribed Databases</h1>
        <p className="text-neutral-500 max-w-2xl">
          Subscription-based and institutionally entitled academic databases available to ESUT
          Library users. Explore our subscribed database collection below.
        </p>
      </div>

      {/* Access notice + WhatsApp CTA */}
      <div
        className="mb-10 rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        style={{ background: '#FDF6E9', borderColor: 'rgba(212,160,23,0.35)' }}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 mb-1">
            Need login details?
          </p>
          <p className="text-sm text-neutral-600">
            To get the password or access details for subscribed databases, please reach out to the
            Librarian. Non-members of the ESUT family can obtain login details the same way.
          </p>
        </div>
        <a
          href={LIBRARIAN_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: '#25D366' }}
        >
          💬 WhatsApp the Librarian
        </a>
      </div>

      {/* OPAC strip */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
        <div>
          <p className="font-semibold text-neutral-900 text-sm">Looking for print holdings?</p>
          <p className="text-sm text-neutral-500">
            Search the ESUT Library Online Public Access Catalogue (OPAC).
          </p>
        </div>
        <a
          href={OPAC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary shrink-0 text-xs px-4 py-2"
        >
          Open OPAC →
        </a>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {SUBSCRIBED_DATABASES.map((db) => (
          <LibraryResourceCard key={db.id} resource={db} ctaLabel="Access Database" />
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-neutral-200 p-5 text-sm text-neutral-600 space-y-2">
        <p>
          <strong className="text-neutral-900">Access note:</strong> Entitlements for Research4Life
          programmes (Hinari, AGORA, OARE, ARDI, GOALI) vary by institution, country and publisher.
          Content available through each programme is shown as independent resources.
        </p>
        <p>
          Also available:{' '}
          <Link to="/databases" className="text-primary-700 font-medium hover:underline">
            Research Databases
          </Link>
          ,{' '}
          <Link to="/open-access-databases" className="text-primary-700 font-medium hover:underline">
            Open Access Databases
          </Link>
          , or the{' '}
          <a
            href={OPAC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-700 font-medium hover:underline"
          >
            OPAC
          </a>
          .
        </p>
      </div>
    </div>
  );
}
