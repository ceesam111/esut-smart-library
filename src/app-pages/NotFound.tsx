import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-lg w-full">
        {/* Book illustration */}
        <div className="flex justify-center mb-6">
          <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
            <rect x="12" y="18" width="46" height="60" rx="4" fill="#E8F5EE" stroke="#1A4731" strokeWidth="2.5"/>
            <rect x="16" y="22" width="38" height="52" rx="2" fill="#fff"/>
            <line x1="22" y1="34" x2="48" y2="34" stroke="#1A4731" strokeWidth="2" strokeLinecap="round"/>
            <line x1="22" y1="42" x2="48" y2="42" stroke="#C8DFD2" strokeWidth="2" strokeLinecap="round"/>
            <line x1="22" y1="50" x2="40" y2="50" stroke="#C8DFD2" strokeWidth="2" strokeLinecap="round"/>
            <rect x="52" y="24" width="32" height="54" rx="4" fill="#1A4731" stroke="#1A4731" strokeWidth="2"/>
            <line x1="58" y1="36" x2="78" y2="36" stroke="#ffffff40" strokeWidth="2" strokeLinecap="round"/>
            <line x1="58" y1="44" x2="78" y2="44" stroke="#ffffff40" strokeWidth="2" strokeLinecap="round"/>
            <line x1="58" y1="52" x2="70" y2="52" stroke="#ffffff40" strokeWidth="2" strokeLinecap="round"/>
            <text x="58" y="70" fill="#E8F5EE" fontSize="10" fontWeight="700">?</text>
          </svg>
        </div>

        {/* Large 404 */}
        <div
          className="text-8xl md:text-9xl font-bold leading-none mb-4 select-none"
          style={{ color: '#1A4731' }}
        >
          404
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-3">
          Page Not Found
        </h1>

        <p className="text-neutral-500 mb-8 leading-relaxed">
          We couldn't find the page you're looking for. It may have been moved,
          deleted, or the URL may be incorrect. Try searching the catalogue instead.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="btn-primary"
          >
            Go to Homepage
          </Link>
          <Link
            to="/catalogue"
            className="btn-outline"
          >
            Search the Library
          </Link>
        </div>

        <p className="mt-10 text-xs text-neutral-400">
          If you believe this is an error, please{' '}
          <Link to="/contact" className="underline hover:text-neutral-600">
            contact the library
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
