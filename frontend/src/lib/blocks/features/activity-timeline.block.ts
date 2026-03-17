import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/ActivityTimeline.tsx': `'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Activity, Clock, Filter, Loader2 } from 'lucide-react';

interface TimelineEvent {
  id: string;
  action: string;
  description: string;
  type: string;
  metadata?: any;
  created_at: string;
}

interface ActivityTimelineProps {
  limit?: number;
  showFilter?: boolean;
}

export default function ActivityTimeline({ limit = 20, showFilter = true }: ActivityTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const supabase = createClient();

  useEffect(() => {
    loadEvents();
  }, [filter]);

  async function loadEvents() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filter !== 'all') {
      query = query.eq('type', filter);
    }

    const { data } = await query;
    setEvents(data || []);
    setLoading(false);
  }

  const typeColors: Record<string, string> = {
    analysis: '${t.primary}',
    payment: '#22c55e',
    auth: '${t.secondary}',
    settings: '#f59e0b',
    error: '#ef4444',
  };

  const types = ['all', ...Array.from(new Set(events.map(e => e.type)))];

  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return mins + ' мин назад';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' ч назад';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + ' дн назад';
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '${t.primary}' }} />
      </div>
    );
  }

  return (
    <div>
      {showFilter && types.length > 2 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {types.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === type ? '${t.primary}' : '${t.primary10}',
                color: filter === type ? 'white' : '${t.text70}',
              }}
            >
              {type === 'all' ? 'Все' : type}
            </button>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '${t.text50}' }}>Нет событий</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: '${t.primary20}' }} />
          <div className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="flex gap-4 relative">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                  style={{ background: typeColors[event.type] || '${t.primary}' }}
                >
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-medium" style={{ color: '${t.text}' }}>{event.action}</p>
                  {event.description && (
                    <p className="text-xs mt-0.5" style={{ color: '${t.text70}' }}>{event.description}</p>
                  )}
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '${t.text50}' }}>
                    <Clock className="w-3 h-3" /> {relativeTime(event.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
`,
  };
}
