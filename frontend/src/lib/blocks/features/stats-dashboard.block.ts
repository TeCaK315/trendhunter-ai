import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/StatsDashboard.tsx': `'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, ArrowRight } from 'lucide-react';

interface KPI {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

interface ChartData {
  label: string;
  value: number;
}

interface StatsDashboardProps {
  kpis: KPI[];
  chartData?: ChartData[];
  chartTitle?: string;
  periods?: string[];
  onPeriodChange?: (period: string) => void;
}

export default function StatsDashboard({
  kpis,
  chartData = [],
  chartTitle = 'Динамика',
  periods = ['7 дней', '30 дней', '90 дней', 'Всё время'],
  onPeriodChange,
}: StatsDashboardProps) {
  const [activePeriod, setActivePeriod] = useState(periods[0] || '7 дней');

  function handlePeriod(p: string) {
    setActivePeriod(p);
    onPeriodChange?.(p);
  }

  const maxChart = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 1;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold" style={{ color: '${t.text}' }}>Статистика</h3>
        <div className="flex gap-1 border rounded-xl p-1" style={{ borderColor: '${t.primary40}' }}>
          {periods.map(p => (
            <button key={p} onClick={() => handlePeriod(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activePeriod === p ? '${t.primary}' : 'transparent',
                color: activePeriod === p ? '#fff' : '${t.text70}',
              }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="rounded-xl border p-4" style={{ borderColor: '${t.primary40}' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: '${t.text50}' }}>{kpi.label}</span>
              {kpi.icon && <span className="text-lg">{kpi.icon}</span>}
            </div>
            <p className="text-2xl font-bold" style={{ color: '${t.text}' }}>{kpi.value}</p>
            {kpi.change !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                {kpi.change > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                ) : kpi.change < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                ) : (
                  <Minus className="w-3.5 h-3.5" style={{ color: '${t.text50}' }} />
                )}
                <span className="text-xs font-medium" style={{ color: kpi.change > 0 ? '#22c55e' : kpi.change < 0 ? '#ef4444' : '${t.text50}' }}>
                  {kpi.change > 0 ? '+' : ''}{kpi.change}%
                </span>
                {kpi.changeLabel && <span className="text-xs" style={{ color: '${t.text50}' }}>{kpi.changeLabel}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: '${t.primary40}' }}>
          <h4 className="text-sm font-semibold mb-4" style={{ color: '${t.text}' }}>{chartTitle}</h4>
          <div className="flex items-end gap-2 h-40">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium" style={{ color: '${t.text70}' }}>
                  {d.value}
                </span>
                <div className="w-full rounded-t transition-all hover:opacity-80"
                  style={{
                    height: maxChart > 0 ? (d.value / maxChart * 100) + '%' : '5%',
                    background: '${t.gradientPrimary}',
                    minHeight: 4,
                  }} />
                <span className="text-xs truncate w-full text-center" style={{ color: '${t.text50}' }}>
                  {d.label}
                </span>
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
