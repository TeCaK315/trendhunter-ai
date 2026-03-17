'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart as BarChartIcon, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, PieChart, StatCard, DataTable } from '@/components/ChartComponents';

export default function AnalyticsPage() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (period !== 'all') {
        const days = period === '7d' ? 7 : 30;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        query = query.gte('created_at', since);
      }

      const { data } = await query.limit(200);
      setAnalyses(data || []);
      setLoading(false);
    }
    load();
  }, [period, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f23' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  // Aggregate data
  const totalAnalyses = analyses.length;
  const avgTokens = totalAnalyses > 0
    ? Math.round(analyses.reduce((s, a) => s + (a.tokens_used || 0), 0) / totalAnalyses)
    : 0;

  // Group by date
  const byDate: Record<string, number> = {};
  analyses.forEach(a => {
    const date = new Date(a.created_at).toLocaleDateString('ru-RU');
    byDate[date] = (byDate[date] || 0) + 1;
  });
  const dateChart = Object.entries(byDate)
    .slice(-10)
    .map(([label, value]) => ({ label, value }));

  // Group by input type
  const byType: Record<string, number> = {};
  analyses.forEach(a => {
    const type = a.input_type || 'text';
    byType[type] = (byType[type] || 0) + 1;
  });
  const typeChart = Object.entries(byType).map(([label, value]) => ({ label, value }));

  // Recent table
  const recentRows = analyses.slice(0, 10).map(a => [
    (a.input || '').substring(0, 50) + ((a.input || '').length > 50 ? '...' : ''),
    a.input_type || 'text',
    a.tokens_used || 0,
    new Date(a.created_at).toLocaleDateString('ru-RU'),
  ]);

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#0f0f23' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BarChartIcon className="w-7 h-7" style={{ color: '#6366f1' }} />
            <h1 className="text-2xl font-heading font-bold" style={{ color: '#e2e8f0' }}>
              Аналитика
            </h1>
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: period === p ? '#6366f1' : '#6366f110',
                  color: period === p ? 'white' : '#e2e8f070',
                }}
              >
                {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : 'Всё время'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Всего ai-powered market analysis report" value={totalAnalyses} icon={<TrendingUp className="w-5 h-5" />} />
          <StatCard label="Среднее токенов" value={avgTokens} icon={<BarChartIcon className="w-5 h-5" />} />
          <StatCard
            label="Последний анализ"
            value={analyses[0] ? new Date(analyses[0].created_at).toLocaleDateString('ru-RU') : 'Нет'}
            icon={<Clock className="w-5 h-5" />}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl border p-6" style={{ borderColor: '#6366f140' }}>
            <BarChart data={dateChart} title="Анализы по дням" />
          </div>
          <div className="rounded-2xl border p-6" style={{ borderColor: '#6366f140' }}>
            <PieChart data={typeChart} title="По типу ввода" />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border p-6" style={{ borderColor: '#6366f140' }}>
          <DataTable
            title="Последние анализы"
            headers={['Ввод', 'Тип', 'Токены', 'Дата']}
            rows={recentRows}
          />
        </div>
      </div>
    </div>
  );
}
