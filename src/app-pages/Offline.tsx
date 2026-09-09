import { useState, useEffect } from 'react';
import { institutionConfig } from '@config/institution.config';

export default function Offline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    window.location.href = '/';
    return null;
  }

  return (
    <div className="page flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md">
        <div className="mb-8">
          {institutionConfig.logo ? (
            <img
              src={institutionConfig.logo}
              alt={institutionConfig.name}
              className="w-20 h-20 mx-auto rounded-lg shadow"
            />
          ) : (
            <div className="w-20 h-20 mx-auto bg-primary rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {institutionConfig.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">You're Offline</h1>

        <p className="text-gray-600 mb-4">
          {institutionConfig.name} requires an internet connection to access our digital library.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-amber-800">
            Your browser has lost connection to the internet. Please check your connection and try again.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            Try Again
          </button>

          <p className="text-xs text-gray-500 mt-6">
            If the problem persists, check your internet connection or contact technical support.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            {institutionConfig.name}
          </p>
          {institutionConfig.primaryDomain && (
            <p className="text-xs text-gray-500">
              {institutionConfig.primaryDomain}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
