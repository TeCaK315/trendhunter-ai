'use client';

import { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Trend } from '@/types/trend';

interface BubbleChartProps {
  trends: Trend[];
  onSelect: (trend: Trend) => void;
}

const categoryColors: Record<string, string> = {
  'SaaS': '#3b82f6',
  'E-commerce': '#10b981',
  'Mobile Apps': '#8b5cf6',
  'EdTech': '#f59e0b',
  'HealthTech': '#22c55e',
  'AI/ML': '#6366f1',
  'AI & ML': '#6366f1',
  'FinTech': '#eab308',
  'Technology': '#64748b',
  'Business': '#3b82f6',
  'Healthcare': '#ef4444',
  'Finance': '#22c55e',
  'Education': '#f97316',
};

const competitionToNum = (level?: string) =>
  level === 'low' ? 1 : level === 'medium' ? 2 : level === 'high' ? 3 : 2;

interface BubbleData {
  x: number; // competition (1-3)
  y: number; // growth rate
  z: number; // players count (bubble size)
  name: string;
  category: string;
  color: string;
  trend: Trend;
}

export default function BubbleChart({ trends, onSelect }: BubbleChartProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const data = useMemo<BubbleData[]>(() =>
    trends
      .filter(t => t.enriched_at) // only enriched trends have meaningful data
      .map(t => ({
        x: competitionToNum(t.competition_level) + (Math.random() * 0.4 - 0.2), // jitter
        y: t.growth_rate || 0,
        z: Math.max((t.top_players_count || 1) * 40, 60),
        name: t.title,
        category: t.category,
        color: categoryColors[t.category] || '#6366f1',
        trend: t,
      })),
    [trends]
  );

  const categories = useMemo(() =>
    [...new Set(data.map(d => d.category))],
    [data]
  );

  const filteredData = hoveredCategory
    ? data.filter(d => d.category === hoveredCategory)
    : data;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload as BubbleData;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl max-w-[200px]">
        <p className="text-white font-semibold text-sm mb-1">{d.name}</p>
        <p className="text-zinc-400 text-xs mb-2">{d.category}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Рост:</span>
            <span className="text-green-400 font-medium">+{d.y}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Конкуренция:</span>
            <span className={`font-medium ${
              d.trend.competition_level === 'low' ? 'text-green-400' :
              d.trend.competition_level === 'medium' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {d.trend.competition_level === 'low' ? 'Низкая' :
               d.trend.competition_level === 'medium' ? 'Средняя' : 'Высокая'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Игроки:</span>
            <span className="text-zinc-300">{d.trend.top_players_count ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Вход:</span>
            <span className="text-zinc-300">{d.trend.entry_cost_estimate || '—'}</span>
          </div>
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl mb-4">📊</span>
        <p className="text-zinc-400">Недостаточно обогащённых данных для визуализации</p>
        <p className="text-zinc-500 text-sm mt-1">Bubble chart требует данных о конкуренции и игроках</p>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4 px-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setHoveredCategory(hoveredCategory === cat ? null : cat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              hoveredCategory === cat
                ? 'border-indigo-500/40 bg-indigo-500/15 text-white'
                : hoveredCategory && hoveredCategory !== cat
                  ? 'border-zinc-800 bg-zinc-900/50 text-zinc-600'
                  : 'border-zinc-700/30 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/70'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: categoryColors[cat] || '#6366f1' }}
            />
            {cat}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
            <XAxis
              type="number"
              dataKey="x"
              domain={[0.5, 3.5]}
              ticks={[1, 2, 3]}
              tickFormatter={(v) => v === 1 ? 'Низкая' : v === 2 ? 'Средняя' : 'Высокая'}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 12 }}
              label={{ value: 'Конкуренция →', position: 'bottom', offset: 15, style: { fill: '#52525b', fontSize: 11 } }}
            />
            <YAxis
              type="number"
              dataKey="y"
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
              label={{ value: '← Рост', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#52525b', fontSize: 11 } }}
            />
            <ZAxis type="number" dataKey="z" range={[40, 400]} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Scatter
              data={filteredData}
              onClick={(entry: any) => {
                if (entry?.trend) onSelect(entry.trend);
              }}
              cursor="pointer"
            >
              {filteredData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.color}
                  fillOpacity={0.6}
                  stroke={entry.color}
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Подсказка */}
      <div className="text-center mt-2">
        <p className="text-xs text-zinc-600">
          Размер пузырька = количество игроков • Нажмите на пузырёк для анализа • Ось X = конкуренция, Y = рост тренда
        </p>
      </div>
    </div>
  );
}
