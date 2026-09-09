import { useState, useEffect } from 'react';

const STORAGE_KEY = 'esut_cookie_consent';

type ConsentLevel = 'all' | 'essential' | null;

interface ConsentState {
  level: ConsentLevel;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
}

function getStored(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsentState) : null;
  } catch {
    return null;
  }
}

function save(state: ConsentState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function hasAnalyticsConsent(): boolean {
  const s = getStored();
  return s?.analytics === true;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!getStored()) setVisible(true);
  }, []);

  const acceptAll = () => {
    save({ level: 'all', analytics: true, marketing: true, savedAt: new Date().toISOString() });
    setVisible(false);
  };

  const essentialOnly = () => {
    save({ level: 'essential', analytics: false, marketing: false, savedAt: new Date().toISOString() });
    setVisible(false);
  };

  const savePreferences = () => {
    save({ level: 'all', analytics, marketing, savedAt: new Date().toISOString() });
    setShowModal(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Banner */}
      <div
        role="dialog"
        aria-label="Cookie consent"
        className="fixed bottom-0 inset-x-0 z-[9999] bg-neutral-900 text-white shadow-2xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 text-sm text-neutral-200 leading-relaxed">
            <span className="font-semibold text-white">We use cookies</span> to improve your experience and comply with
            the <span className="font-medium">Nigerian Data Protection Act 2023</span>. Essential cookies are always
            active. Analytics cookies help us understand usage patterns.{' '}
            <a href="/privacy" className="underline text-primary-300 hover:text-primary-200">
              Privacy Policy
            </a>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 rounded text-xs font-medium border border-neutral-600 text-neutral-300 hover:border-neutral-400 hover:text-white transition-colors"
            >
              Manage Preferences
            </button>
            <button
              onClick={essentialOnly}
              className="px-3 py-1.5 rounded text-xs font-medium border border-neutral-500 text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Essential Only
            </button>
            <button
              onClick={acceptAll}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-colors"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>

      {/* Preferences Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-neutral-100">
              <h2 className="text-lg font-semibold text-neutral-900">Cookie Preferences</h2>
              <p className="text-sm text-neutral-500 mt-1">
                Choose which cookies you allow. Your choice is stored for 12 months.
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Essential */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-neutral-800">Essential Cookies</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Required for the site to function: authentication, security, session management.
                  </div>
                </div>
                <div className="shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-neutral-400 bg-neutral-100 px-2 py-1 rounded">Always On</span>
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-neutral-800">Analytics Cookies</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Help us understand how patrons use the library. No personal data shared externally.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                </label>
              </div>

              {/* Marketing */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-neutral-800">Marketing Cookies</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Used to personalise newsletter content and event recommendations.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                </label>
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePreferences}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
