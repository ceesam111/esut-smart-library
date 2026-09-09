import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type NotifPermission = 'default' | 'granted' | 'denied';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  url: string | null;
  type: 'event' | 'blog' | 'loan' | 'system' | 'new_arrival';
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotifPermission>('default');
  const [supported, setSupported] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSupported('Notification' in window && 'serviceWorker' in navigator);
    if ('Notification' in window) {
      setPermission(Notification.permission as NotifPermission);
    }
    loadNotifications();
  }, []);

  async function loadNotifications() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    const notifs = (data ?? []) as AppNotification[];
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.is_read).length);
    setLoading(false);
  }

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
    return result === 'granted';
  }, []);

  const showLocalNotification = useCallback((title: string, body: string, url = '/') => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });
    n.onclick = () => { window.focus(); if (url) window.location.href = url; };
  }, []);

  const markAllRead = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  return {
    permission,
    supported,
    notifications,
    unreadCount,
    loading,
    requestPermission,
    showLocalNotification,
    markAllRead,
    markRead,
    reload: loadNotifications,
  };
}
