'use client';

import React, { useMemo, useState } from 'react';
import { calculate, type Inputs, type Calculations } from './FinancialCalculator';
import EvidenceBadge from '../EvidenceBadge';

interface ScenarioComparisonProps {
  trendId?: string;
  baseInputs: Inputs;
}

interface ScenarioConfig {
  key: string;
  label: string;
  emoji: string;
  color: string;
  headerBg: string;
  // Multipliers relative to base
  priceMultiplier: number;
  churnMultiplier: number;
  customersMultiplier: number;
  growthMultiplier: number;
  cacMultiplier: number;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    key: 'pessimistic',
    label: 'Пессимистичный',
    emoji: '🔴',
    color: 'text-red-400',
    headerBg: 'bg-red-500/10 border-red-500/20',
    priceMultiplier: 0.6,
    churnMultiplier: 1.6,
    customersMultiplier: 0.5,
    growthMultiplier: 0.5,
    cacMultiplier: 1.3,
  },
  {
    key: 'base',
    label: 'Базовый',
    emoji: '🟡',
    color: 'text-yellow-400',
    headerBg: 'bg-yellow-500/10 border-yellow-500/20',
    priceMultiplier: 1.0,
    churnMultiplier: 1.0,
    customersMultiplier: 1.0,
    growthMultiplier: 1.0,
    cacMultiplier: 1.0,
  },
  {
    key: 'optimistic',
    label: 'Оптимистичный',
    emoji: '🟢',
    color: 'text-green-400',
    headerBg: 'bg-green-500/10 border-green-500/20',
    priceMultiplier: 1.4,
    churnMultiplier: 0.6,
    customersMultiplier: 2.0,
    growthMultiplier: 1.5,
    cacMultiplier: 0.8,
  },
];

function applyScenario(base: Inputs, scenario: ScenarioConfig): Inputs {
  return {
    ...base,
    monthlyPrice: Math.round(base.monthlyPrice * scenario.priceMultiplier),
    monthlyChurnRate: Math.round(base.monthlyChurnRate * scenario.churnMultiplier * 10) / 10,
    customersMonth1: Math.max(1, Math.round(base.customersMonth1 * scenario.customersMultiplier)),
    monthlyGrowthRate: Math.round(base.monthlyGrowthRate * scenario.growthMultiplier * 10) / 10,
    cac: Math.round(base.cac * scenario.cacMultiplier),
  };
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export default function ScenarioComparison({ trendId, baseInputs }: ScenarioComparisonProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const results = useMemo(() => {
    return SCENARIOS.map(sc => ({
      scenario: sc,
      inputs: applyScenario(baseInputs, sc),
      calc: calculate(applyScenario(baseInputs, sc)),
    }));
  }, [baseInputs]);

  // Find max MRR across all scenarios for chart scaling
  const globalMaxMrr = Math.max(
    ...results.flatMap(r => r.calc.projections.map(p => p.mrr)),
    1
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <EvidenceBadge type="calculated" label="Сценарный анализ" />
        <span className="text-xs text-zinc-500">
          На основе параметров из Калькулятора
        </span>
      </div>

      {/* Scenario parameter comparison */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white">Вводные параметры</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Пессимистичный и оптимистичный рассчитываются автоматически от базовых</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Параметр</th>
                {results.map(r => (
                  <th key={r.scenario.key} className={`px-4 py-2.5 text-center font-medium ${r.scenario.color}`}>
                    {r.scenario.emoji} {r.scenario.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ParamRow label="Цена/мес" values={results.map(r => `$${r.inputs.monthlyPrice}`)} />
              <ParamRow label="Churn/мес" values={results.map(r => `${r.inputs.monthlyChurnRate}%`)} />
              <ParamRow label="Клиентов (старт)" values={results.map(r => `${r.inputs.customersMonth1}`)} />
              <ParamRow label="Рост/мес" values={results.map(r => `${r.inputs.monthlyGrowthRate}%`)} />
              <ParamRow label="CAC" values={results.map(r => `$${r.inputs.cac}`)} />
              <ParamRow label="Фикс. расходы" values={results.map(r => `$${r.inputs.monthlyFixedCosts.toLocaleString()}`)} />
              <ParamRow label="Начальный капитал" values={results.map(r => `$${r.inputs.initialInvestment.toLocaleString()}`)} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Key metrics comparison */}
      <div className="grid grid-cols-3 gap-4">
        {results.map(r => (
          <div key={r.scenario.key} className={`rounded-xl border p-4 space-y-3 ${r.scenario.headerBg}`}>
            <div className="text-center">
              <div className={`text-sm font-semibold ${r.scenario.color}`}>
                {r.scenario.emoji} {r.scenario.label}
              </div>
            </div>

            <MetricItem
              label="LTV/CAC"
              value={`${r.calc.ltvCacRatio}x`}
              health={r.calc.ltvCacRatio >= 3 ? 'good' : r.calc.ltvCacRatio >= 1.5 ? 'ok' : 'bad'}
            />
            <MetricItem
              label="CAC Payback"
              value={`${r.calc.cacPaybackMonths} мес`}
              health={r.calc.cacPaybackMonths <= 6 ? 'good' : r.calc.cacPaybackMonths <= 12 ? 'ok' : 'bad'}
            />
            <MetricItem
              label="Break-even"
              value={r.calc.breakEvenMonth !== null ? `мес ${r.calc.breakEvenMonth}` : '>24 мес'}
              health={r.calc.breakEvenMonth !== null && r.calc.breakEvenMonth <= 12 ? 'good' : r.calc.breakEvenMonth !== null && r.calc.breakEvenMonth <= 18 ? 'ok' : 'bad'}
            />
            <MetricItem
              label="LTV"
              value={fmt(r.calc.ltv)}
              health="neutral"
            />

            <div className="border-t border-white/10 pt-3 space-y-2">
              <MilestoneRow label="MRR (6 мес)" value={fmt(r.calc.projections[5]?.mrr || 0)} />
              <MilestoneRow label="MRR (12 мес)" value={fmt(r.calc.projections[11]?.mrr || 0)} />
              <MilestoneRow label="ARR (12 мес)" value={fmt(r.calc.projections[11]?.arr || 0)} />
              <MilestoneRow
                label="P&L (12 мес)"
                value={fmt(r.calc.projections[11]?.netProfit || 0)}
                highlight={r.calc.projections[11]?.netProfit >= 0 ? 'green' : 'red'}
              />
            </div>

            {r.calc.runwayMonths !== null && r.calc.runwayMonths <= 24 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
                <span className="text-xs text-red-400">
                  Runway: {r.calc.runwayMonths} мес
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MRR chart comparison */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-1">MRR по сценариям (24 мес)</h3>
        <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
          {SCENARIOS.map(sc => (
            <span key={sc.key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${sc.key === 'pessimistic' ? 'bg-red-500' : sc.key === 'base' ? 'bg-yellow-500' : 'bg-green-500'}`} />
              {sc.label}
            </span>
          ))}
        </div>

        {/* Overlay chart: 3 lines as stacked bars */}
        <div className="relative h-40">
          <div
            className="flex items-end h-full gap-[2px]"
            onMouseLeave={() => setHoveredMonth(null)}
          >
            {Array.from({ length: 24 }, (_, i) => {
              const month = i + 1;
              const pessH = ((results[0].calc.projections[i]?.mrr || 0) / globalMaxMrr) * 100;
              const baseH = ((results[1].calc.projections[i]?.mrr || 0) / globalMaxMrr) * 100;
              const optH = ((results[2].calc.projections[i]?.mrr || 0) / globalMaxMrr) * 100;

              return (
                <div
                  key={month}
                  className="flex-1 flex items-end justify-center relative group"
                  onMouseEnter={() => setHoveredMonth(month)}
                >
                  {/* Three bars side by side within each month */}
                  <div className="flex items-end gap-[1px] w-full h-full">
                    <div className="flex-1 bg-red-500/60 rounded-t-sm" style={{ height: `${pessH}%`, minHeight: pessH > 0 ? '1px' : 0 }} />
                    <div className="flex-1 bg-yellow-500/60 rounded-t-sm" style={{ height: `${baseH}%`, minHeight: baseH > 0 ? '1px' : 0 }} />
                    <div className="flex-1 bg-green-500/60 rounded-t-sm" style={{ height: `${optH}%`, minHeight: optH > 0 ? '1px' : 0 }} />
                  </div>

                  {/* Tooltip */}
                  {hoveredMonth === month && (
                    <div className="absolute bottom-full mb-2 bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-300 whitespace-nowrap z-10 shadow-lg left-1/2 -translate-x-1/2">
                      <div className="font-medium text-white mb-1.5">Месяц {month}</div>
                      {results.map(r => (
                        <div key={r.scenario.key} className="flex items-center gap-2">
                          <span>{r.scenario.emoji}</span>
                          <span className="text-zinc-400 w-24">{r.scenario.label}:</span>
                          <span className={r.scenario.color}>{fmt(r.calc.projections[i]?.mrr || 0)}</span>
                          <span className="text-zinc-600">({r.calc.projections[i]?.customers || 0} кл.)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
          <span>1</span>
          <span>6</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      </div>

      {/* Summary table: 12-month snapshot */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white">Сводка за 12 месяцев</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Метрика</th>
                {results.map(r => (
                  <th key={r.scenario.key} className={`px-4 py-2.5 text-center font-medium ${r.scenario.color}`}>
                    {r.scenario.emoji} {r.scenario.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SummaryRow
                label="Клиенты"
                values={results.map(r => `${r.calc.projections[11]?.customers || 0}`)}
              />
              <SummaryRow
                label="MRR"
                values={results.map(r => fmt(r.calc.projections[11]?.mrr || 0))}
              />
              <SummaryRow
                label="ARR"
                values={results.map(r => fmt(r.calc.projections[11]?.arr || 0))}
                bold
              />
              <SummaryRow
                label="Расходы/мес"
                values={results.map(r => fmt(r.calc.projections[11]?.totalCosts || 0))}
              />
              <SummaryRow
                label="P&L/мес"
                values={results.map(r => fmt(r.calc.projections[11]?.netProfit || 0))}
                colors={results.map(r => (r.calc.projections[11]?.netProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400')}
                bold
              />
              <SummaryRow
                label="Кумулятивный P&L"
                values={results.map(r => fmt(r.calc.projections[11]?.cumulativeProfit || 0))}
                colors={results.map(r => (r.calc.projections[11]?.cumulativeProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400')}
              />
              <SummaryRow
                label="Cash на счету"
                values={results.map(r => fmt(r.calc.projections[11]?.cashRemaining || 0))}
                colors={results.map(r => (r.calc.projections[11]?.cashRemaining || 0) >= 0 ? 'text-white' : 'text-red-400')}
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function ParamRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-b border-zinc-800/50">
      <td className="px-4 py-2 text-zinc-400">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`px-4 py-2 text-center text-white ${i === 1 ? 'font-semibold' : ''}`}>{v}</td>
      ))}
    </tr>
  );
}

function MetricItem({ label, value, health }: { label: string; value: string; health: string }) {
  const color = health === 'good' ? 'text-green-400' : health === 'ok' ? 'text-yellow-400' : health === 'bad' ? 'text-red-400' : 'text-white';
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

function MilestoneRow({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'red' }) {
  const color = highlight === 'green' ? 'text-green-400' : highlight === 'red' ? 'text-red-400' : 'text-white';
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className={`text-xs font-medium ${color}`}>{value}</span>
    </div>
  );
}

function SummaryRow({
  label,
  values,
  colors,
  bold,
}: {
  label: string;
  values: string[];
  colors?: string[];
  bold?: boolean;
}) {
  return (
    <tr className="border-b border-zinc-800/50">
      <td className={`px-4 py-2 text-zinc-400 ${bold ? 'font-medium' : ''}`}>{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-4 py-2 text-center ${bold ? 'font-bold' : 'font-medium'} ${colors?.[i] || 'text-white'}`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}
