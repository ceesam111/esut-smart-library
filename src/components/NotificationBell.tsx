import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardLabel, getDashboardPath } from '@/config/roles.config';

const TYPE_ICONS: Record<string, string> = {
  event: '📅',
  blog: '📰',
  loan: '📚',
  system: '🔔',
  new_arrival: '✨',
};

const GREEN = '#6B1D2A';
const GOLD  = '#D4A017';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { role } = useAuth();

  const {
    permission,
    supported,
    notifications,
    unreadCount,
    loading,
    requestPermission,
    markAllRead,
    markRead,
  } = useNotifications();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleEnable() {
    const granted = await requestPermission();
    if (granted) {
      // Show a confirmation notification (local, in-app — no VAPID/web-push).
      new Notification('ESUT Library', {
        body: 'Notifications are now enabled! You will be notified about new events, blog posts, and library updates.',
        icon: '/icons/icon-192.png',
      });
    }
  }

  function handleNotifClick(id: string, url: string | null) {
    markRead(id);
    setOpen(false);
    if (url) navigate(url);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
        className="relative p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1"
            style={{ background: '#E53E3E' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-neutral-100 z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <span className="font-semibold text-sm text-neutral-900">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary-700 hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Enable notifications prompt */}
          {supported && permission !== 'granted' && permission !== 'denied' && (
            <div className="mx-3 my-2 rounded-lg p-3 text-sm" style={{ background: '#F0F9F4', border: '1px solid #BBF7D0' }}>
              <p className="font-medium text-green-900 mb-1">Stay up to date</p>
              <p className="text-green-700 text-xs mb-2">Enable push notifications for new events, blog posts, and library updates.</p>
              <button
                onClick={handleEnable}
                className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                Enable Notifications
              </button>
            </div>
          )}

          {permission === 'denied' && (
            <div className="mx-3 my-2 rounded-lg p-3 text-xs text-amber-800 bg-amber-50 border border-amber-200">
              Notifications are blocked in your browser. You can re-enable them in your browser settings.
            </div>
          )}

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm text-neutral-500">No notifications yet.</p>
                <p className="text-xs text-neutral-400 mt-1">We'll let you know about events, new arrivals and more.</p>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif.id, notif.url)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0 ${
                    !notif.is_read ? 'bg-primary-50/50' : ''
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[notif.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!notif.is_read ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: GREEN }} />
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2 leading-snug">{notif.body}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {new Date(notif.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-100 px-4 py-2.5 flex items-center justify-between bg-neutral-50">
            <Link
              to={getDashboardPath(role)}
              onClick={() => setOpen(false)}
              className="text-xs text-primary-700 hover:underline font-medium"
            >
              {getDashboardLabel(role)} →
            </Link>
            {supported && permission === 'granted' && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Push enabled
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
