import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const metricLabel = ctx.safe.primaryOutput || 'Анализы';

  return {
    'src/components/ChartComponents.tsx': `'use client';

/* ─── Bar Chart (CSS-only) ─── */
interface BarChartProps {
  data: { label: string; value: number }[];
  title?: string;
  maxVal?: number;
}

export function BarChart({ data, title, maxVal }: BarChartProps) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);

  return (
    <div>
      {title && (
        <h3 className="font-heading font-semibold mb-4" style={{ color: '${t.text}' }}>{title}</h3>
      )}
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <span className="text-sm truncate" style={{ color: '${t.text80}' }}>{item.label}</span>
              <span className="text-sm font-bold ml-2" style={{ color: '${t.primary}' }}>{item.value}</span>
            </div>
            <div className="w-full h-5 rounded-lg" style={{ background: '${t.primary20}' }}>
              <div
                className="h-5 rounded-lg transition-all duration-700"
                style={{ width: \`\${Math.max((item.value / max) * 100, 2)}%\`, background: '${t.gradientPrimary}' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pie Chart (CSS conic-gradient) ─── */
interface PieChartProps {
  data: { label: string; value: number; color?: string }[];
  title?: string;
  size?: number;
}

const PIE_COLORS = ['${t.primary}', '${t.secondary}', '${t.accent}', '#f59e0b', '#ef4444', '#22c55e', '#6366f1', '#ec4899'];

export function PieChart({ data, title, size = 180 }: PieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let accumulated = 0;

  const segments = data.map((d, i) => {
    const start = accumulated;
    const percent = (d.value / total) * 100;
    accumulated += percent;
    return {
      ...d,
      percent,
      start,
      color: d.color || PIE_COLORS[i % PIE_COLORS.length],
    };
  });

  const gradient = segments
    .map(s => \`\${s.color} \${s.start}% \${s.start + s.percent}%\`)
    .join(', ');

  return (
    <div>
      {title && (
        <h3 className="font-heading font-semibold mb-4" style={{ color: '${t.text}' }}>{title}</h3>
      )}
      <div className="flex items-center gap-6 flex-wrap">
        <div
          className="rounded-full flex-shrink-0"
          style={{
            width: size,
            height: size,
            background: \`conic-gradient(\${gradient})\`,
          }}
        />
        <div className="space-y-2">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
              <span style={{ color: '${t.text80}' }}>{s.label}</span>
              <span className="font-bold" style={{ color: '${t.text}' }}>{Math.round(s.percent)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
interface StatCardProps {
  label: string;
  value: string | number;
  change?: number; // percent change, e.g. +12 or -5
  icon?: React.ReactNode;
}

export function StatCard({ label, value, change, icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: '${t.primary10}', borderColor: '${t.primary40}' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: '${t.text70}' }}>{label}</span>
        {icon && <span style={{ color: '${t.primary}' }}>{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color: '${t.text}' }}>{value}</span>
        {change != null && (
          <span
            className="text-sm font-medium mb-0.5"
            style={{ color: change >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Data Table ─── */
interface DataTableProps {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
}

export function DataTable({ headers, rows, title }: DataTableProps) {
  return (
    <div>
      {title && (
        <h3 className="font-heading font-semibold mb-4" style={{ color: '${t.text}' }}>{title}</h3>
      )}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '${t.primary40}' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '${t.primary10}' }}>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 text-left font-semibold" style={{ color: '${t.text}' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t" style={{ borderColor: '${t.primary20}' }}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-3" style={{ color: '${t.text80}' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`,

    'src/app/dashboard/analytics/page.tsx': `'use client';

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '${t.bg}' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '${t.primary}' }} />
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
    <div className="min-h-screen p-6 md:p-8" style={{ background: '${t.bg}' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BarChartIcon className="w-7 h-7" style={{ color: '${t.primary}' }} />
            <h1 className="text-2xl font-heading font-bold" style={{ color: '${t.text}' }}>
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
                  background: period === p ? '${t.primary}' : '${t.primary10}',
                  color: period === p ? 'white' : '${t.text70}',
                }}
              >
                {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : 'Всё время'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Всего ${metricLabel.toLowerCase()}" value={totalAnalyses} icon={<TrendingUp className="w-5 h-5" />} />
          <StatCard label="Среднее токенов" value={avgTokens} icon={<BarChartIcon className="w-5 h-5" />} />
          <StatCard
            label="Последний анализ"
            value={analyses[0] ? new Date(analyses[0].created_at).toLocaleDateString('ru-RU') : 'Нет'}
            icon={<Clock className="w-5 h-5" />}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl border p-6" style={{ borderColor: '${t.primary40}' }}>
            <BarChart data={dateChart} title="Анализы по дням" />
          </div>
          <div className="rounded-2xl border p-6" style={{ borderColor: '${t.primary40}' }}>
            <PieChart data={typeChart} title="По типу ввода" />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border p-6" style={{ borderColor: '${t.primary40}' }}>
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
`,
  };
}
