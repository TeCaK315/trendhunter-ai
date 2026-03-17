import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/NotificationCenter.tsx': `'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    loadNotifications();

    // Real-time subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadNotifications() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    setNotifications(data || []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function deleteNotification(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  const typeColors: Record<string, string> = {
    info: '${t.primary}',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg transition-all hover:opacity-80"
        style={{ color: '${t.text}' }}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center"
            style={{ background: '#ef4444' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto rounded-2xl border shadow-xl z-50"
          style={{ background: '${t.bg}', borderColor: '${t.primary40}' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '${t.primary20}' }}>
            <h3 className="font-semibold text-sm" style={{ color: '${t.text}' }}>Уведомления</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: '${t.primary}' }}>
                <CheckCheck className="w-3.5 h-3.5" /> Прочитать все
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '${t.text50}' }}>Нет уведомлений</p>
          ) : (
            <div>
              {notifications.map(n => (
                <div
                  key={n.id}
                  className="flex gap-3 px-4 py-3 border-b transition-all"
                  style={{
                    borderColor: '${t.primary10}',
                    background: n.read ? 'transparent' : '${t.primary10}',
                  }}
                >
                  <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: typeColors[n.type] || '${t.primary}' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '${t.text}' }}>{n.title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '${t.text70}' }}>{n.message}</p>
                    <p className="text-xs mt-1" style={{ color: '${t.text50}' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!n.read && (
                      <button onClick={() => markAsRead(n.id)} className="p-1 rounded hover:opacity-70" style={{ color: '${t.primary}' }}>
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteNotification(n.id)} className="p-1 rounded hover:opacity-70" style={{ color: '${t.text50}' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
`,
  };
}
