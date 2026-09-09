import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="text-8xl font-bold text-primary opacity-20 mb-4">404</div>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">Page Not Found</h1>

        <p className="text-gray-600 mb-8">
          We couldn't find the page you're looking for. It may have been moved, deleted,
          or you may have mistyped the URL.
        </p>

        <div className="space-y-3">
          <Link to="/" className="btn-primary block text-center">
            Go Home
          </Link>

          <Link to="/catalogue" className="btn-outline block text-center">
            Browse Catalogue
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            If you believe this is a mistake, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
