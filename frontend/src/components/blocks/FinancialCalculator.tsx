'use client';

import React, { useState, useMemo } from 'react';
import EvidenceBadge from '../EvidenceBadge';

interface FinancialCalculatorProps {
  /** Trend ID for persisting inputs in localStorage */
  trendId?: string;
  /** Pre-filled defaults from Evidence data */
  defaults?: {
    monthlyPrice?: number;
    estimatedCac?: number;
    businessModel?: string;
  };
}

export interface Inputs {
  monthlyPrice: number;
  annualDiscount: number; // % discount for annual plan
  monthlyChurnRate: number; // %
  cac: number; // Cost to Acquire Customer
  monthlyFixedCosts: number; // Rent, salaries, tools
  initialInvestment: number; // Startup capital
  customersMonth1: number; // Starting customers
  monthlyGrowthRate: number; // % monthly customer growth
}

export interface Calculations {
  // Unit Economics
  arpu: number; // Average Revenue Per User (monthly)
  ltv: number; // Lifetime Value
  ltvCacRatio: number;
  cacPaybackMonths: number;
  grossMarginPerCustomer: number;

  // Revenue Projections (12 months)
  projections: MonthProjection[];

  // Break-even
  breakEvenMonth: number | null; // null = never within 24 months
  breakEvenCustomers: number;

  // Runway
  runwayMonths: number | null; // null = profitable or infinite
}

export interface MonthProjection {
  month: number;
  customers: number;
  newCustomers: number;
  churnedCustomers: number;
  mrr: number;
  arr: number;
  totalCosts: number; // fixed + CAC for new customers
  netProfit: number;
  cumulativeProfit: number;
  cashRemaining: number;
}

export function calculate(inputs: Inputs): Calculations {
  const {
    monthlyPrice,
    annualDiscount,
    monthlyChurnRate,
    cac,
    monthlyFixedCosts,
    initialInvestment,
    customersMonth1,
    monthlyGrowthRate,
  } = inputs;

  // Unit Economics
  const churnRate = monthlyChurnRate / 100;
  const growthRate = monthlyGrowthRate / 100;
  const effectiveArpu = monthlyPrice * (1 - annualDiscount / 100 * 0.3); // ~30% of users on annual
  const avgLifetimeMonths = churnRate > 0 ? 1 / churnRate : 120; // cap at 10 years
  const ltv = effectiveArpu * Math.min(avgLifetimeMonths, 120);
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;
  const cacPaybackMonths = effectiveArpu > 0 ? cac / effectiveArpu : 0;
  const grossMarginPerCustomer = effectiveArpu - (cac / Math.max(avgLifetimeMonths, 1));

  // 24-month projection
  const projections: MonthProjection[] = [];
  let customers = customersMonth1;
  let cumulativeProfit = -initialInvestment;
  let cashRemaining = initialInvestment;
  let breakEvenMonth: number | null = null;

  for (let month = 1; month <= 24; month++) {
    const churnedCustomers = Math.floor(customers * churnRate);
    const newCustomers = month === 1
      ? 0 // month 1 starts with customersMonth1
      : Math.max(1, Math.floor(customers * growthRate));

    if (month > 1) {
      customers = customers - churnedCustomers + newCustomers;
    }

    const mrr = customers * effectiveArpu;
    const arr = mrr * 12;
    const cacCosts = newCustomers * cac;
    const totalCosts = monthlyFixedCosts + cacCosts;
    const netProfit = mrr - totalCosts;
    cumulativeProfit += netProfit;
    cashRemaining = initialInvestment + cumulativeProfit;

    if (breakEvenMonth === null && cumulativeProfit >= 0) {
      breakEvenMonth = month;
    }

    projections.push({
      month,
      customers,
      newCustomers,
      churnedCustomers,
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      totalCosts: Math.round(totalCosts),
      netProfit: Math.round(netProfit),
      cumulativeProfit: Math.round(cumulativeProfit),
      cashRemaining: Math.round(cashRemaining),
    });
  }

  // Break-even customers (monthly)
  const breakEvenCustomers = monthlyFixedCosts > 0 && effectiveArpu > 0
    ? Math.ceil(monthlyFixedCosts / effectiveArpu)
    : 0;

  // Runway
  let runwayMonths: number | null = null;
  if (projections.length > 0 && projections[0].netProfit < 0) {
    const neg = projections.findIndex(p => p.cashRemaining < 0);
    runwayMonths = neg >= 0 ? neg + 1 : null; // null = cash lasts > 24 months
  }

  return {
    arpu: Math.round(effectiveArpu * 100) / 100,
    ltv: Math.round(ltv),
    ltvCacRatio: Math.round(ltvCacRatio * 10) / 10,
    cacPaybackMonths: Math.round(cacPaybackMonths * 10) / 10,
    grossMarginPerCustomer: Math.round(grossMarginPerCustomer * 100) / 100,
    projections,
    breakEvenMonth,
    breakEvenCustomers,
    runwayMonths,
  };
}

export default function FinancialCalculator({ trendId, defaults }: FinancialCalculatorProps) {
  const storageKey = trendId ? `th_calc_${trendId}` : null;

  const [inputs, setInputs] = useState<Inputs>(() => {
    // Restore from localStorage if available
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved) as Inputs;
      } catch { /* ignore */ }
    }
    return {
      monthlyPrice: defaults?.monthlyPrice || 49,
      annualDiscount: 20,
      monthlyChurnRate: 5,
      cac: defaults?.estimatedCac || 150,
      monthlyFixedCosts: 3000,
      initialInvestment: 10000,
      customersMonth1: 10,
      monthlyGrowthRate: 15,
    };
  });

  const results = useMemo(() => calculate(inputs), [inputs]);

  const update = (field: keyof Inputs, value: number) => {
    setInputs(prev => {
      const next = { ...prev, [field]: value };
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  };

  // Health indicators
  const ltvCacHealth = results.ltvCacRatio >= 3 ? 'good' : results.ltvCacRatio >= 1.5 ? 'ok' : 'bad';
  const paybackHealth = results.cacPaybackMonths <= 6 ? 'good' : results.cacPaybackMonths <= 12 ? 'ok' : 'bad';
  const breakEvenHealth = results.breakEvenMonth !== null && results.breakEvenMonth <= 12 ? 'good' : results.breakEvenMonth !== null && results.breakEvenMonth <= 18 ? 'ok' : 'bad';

  const healthColor = (h: string) => h === 'good' ? 'text-green-400' : h === 'ok' ? 'text-yellow-400' : 'text-red-400';
  const healthBg = (h: string) => h === 'good' ? 'bg-green-500/10 border-green-500/20' : h === 'ok' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20';

  // Mini chart data (MRR projection)
  const maxMrr = Math.max(...results.projections.map(p => p.mrr), 1);
  const maxCash = Math.max(...results.projections.map(p => Math.abs(p.cashRemaining)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <EvidenceBadge type="calculated" label="100% клиентские расчёты" />
        {defaults?.monthlyPrice && (
          <EvidenceBadge type="real_data" label="Defaults из Evidence" />
        )}
      </div>

      {/* Input Panel + KPI Cards */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white">Параметры</h3>

          <InputField label="Цена/мес ($)" value={inputs.monthlyPrice} onChange={v => update('monthlyPrice', v)} min={1} max={10000} step={1} />
          <InputField label="Скидка за год (%)" value={inputs.annualDiscount} onChange={v => update('annualDiscount', v)} min={0} max={50} step={5} />
          <InputField label="Churn/мес (%)" value={inputs.monthlyChurnRate} onChange={v => update('monthlyChurnRate', v)} min={0} max={30} step={0.5} />
          <InputField label="CAC ($)" value={inputs.cac} onChange={v => update('cac', v)} min={0} max={5000} step={10} />
          <InputField label="Фикс. расходы/мес ($)" value={inputs.monthlyFixedCosts} onChange={v => update('monthlyFixedCosts', v)} min={0} max={100000} step={500} />
          <InputField label="Начальный капитал ($)" value={inputs.initialInvestment} onChange={v => update('initialInvestment', v)} min={0} max={1000000} step={1000} />
          <InputField label="Клиентов в 1-й мес" value={inputs.customersMonth1} onChange={v => update('customersMonth1', v)} min={1} max={1000} step={1} />
          <InputField label="Рост клиентов/мес (%)" value={inputs.monthlyGrowthRate} onChange={v => update('monthlyGrowthRate', v)} min={0} max={50} step={1} />
        </div>

        {/* KPI Cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Top KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              label="LTV/CAC"
              value={`${results.ltvCacRatio}x`}
              health={ltvCacHealth}
              hint={results.ltvCacRatio >= 3 ? 'Отлично (>3x)' : results.ltvCacRatio >= 1.5 ? 'Норма (1.5-3x)' : 'Опасно (<1.5x)'}
            />
            <KPICard
              label="CAC Payback"
              value={`${results.cacPaybackMonths} мес`}
              health={paybackHealth}
              hint={results.cacPaybackMonths <= 6 ? 'Быстро (<6 мес)' : results.cacPaybackMonths <= 12 ? 'Норма (6-12 мес)' : 'Долго (>12 мес)'}
            />
            <KPICard
              label="Break-even"
              value={results.breakEvenMonth !== null ? `${results.breakEvenMonth} мес` : '>24 мес'}
              health={breakEvenHealth}
              hint={`Нужно ${results.breakEvenCustomers} клиентов`}
            />
            <KPICard
              label="LTV"
              value={`$${results.ltv.toLocaleString()}`}
              health="neutral"
              hint={`ARPU: $${results.arpu}/мес`}
            />
          </div>

          {/* Revenue / Cash chart */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">MRR прогноз (24 мес)</h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1 bg-indigo-500 rounded" /> MRR
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1 bg-emerald-500 rounded" /> Cash
                </span>
              </div>
            </div>
            {/* Mini bar chart */}
            <div className="flex items-end gap-[2px] h-32">
              {results.projections.map((p) => {
                const mrrH = (p.mrr / maxMrr) * 100;
                const cashH = (Math.max(0, p.cashRemaining) / maxCash) * 100;
                return (
                  <div key={p.month} className="flex-1 flex flex-col items-center gap-[1px] group relative">
                    <div className="w-full bg-indigo-500/80 rounded-t-sm" style={{ height: `${mrrH}%`, minHeight: p.mrr > 0 ? '2px' : 0 }} />
                    <div className="w-full bg-emerald-500/40 rounded-b-sm" style={{ height: `${cashH * 0.3}%`, minHeight: p.cashRemaining > 0 ? '1px' : 0 }} />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-300 whitespace-nowrap z-10 shadow-lg">
                      <div className="font-medium text-white">Мес {p.month}</div>
                      <div>MRR: ${p.mrr.toLocaleString()}</div>
                      <div>Клиенты: {p.customers}</div>
                      <div>Расходы: ${p.totalCosts.toLocaleString()}</div>
                      <div className={p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                        P&L: ${p.netProfit.toLocaleString()}
                      </div>
                      <div>Cash: ${p.cashRemaining.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>1</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
            </div>
          </div>

          {/* Key milestones */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MilestoneCard
              label="MRR через 6 мес"
              value={`$${results.projections[5]?.mrr.toLocaleString() || 0}`}
              sub={`${results.projections[5]?.customers || 0} клиентов`}
            />
            <MilestoneCard
              label="MRR через 12 мес"
              value={`$${results.projections[11]?.mrr.toLocaleString() || 0}`}
              sub={`${results.projections[11]?.customers || 0} клиентов`}
            />
            <MilestoneCard
              label="ARR через 12 мес"
              value={`$${results.projections[11]?.arr.toLocaleString() || 0}`}
              sub={`P&L: $${results.projections[11]?.netProfit.toLocaleString() || 0}/мес`}
            />
          </div>

          {/* Runway warning */}
          {results.runwayMonths !== null && results.runwayMonths <= 12 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
              <span className="text-red-400 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium text-red-300">
                  Runway: {results.runwayMonths} мес
                </p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  При текущих параметрах деньги закончатся через {results.runwayMonths} мес. Рассмотрите снижение CAC или фиксированных расходов.
                </p>
              </div>
            </div>
          )}

          {/* Profit zone indicator */}
          {results.breakEvenMonth !== null && results.breakEvenMonth <= 24 && (
            <div className={`rounded-xl p-3 flex items-start gap-2 ${healthBg(breakEvenHealth)} border`}>
              <span className="text-lg">{breakEvenHealth === 'good' ? '🟢' : '🟡'}</span>
              <div>
                <p className={`text-sm font-medium ${healthColor(breakEvenHealth)}`}>
                  Выход в прибыль: месяц {results.breakEvenMonth}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  При {results.breakEvenCustomers} клиентах MRR покрывает фиксированные расходы (${ inputs.monthlyFixedCosts.toLocaleString()}/мес)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed table (collapsible) */}
      <ProjectionTable projections={results.projections} />
    </div>
  );
}

// === Sub-components ===

function InputField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  const handleTextChange = (raw: string) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => handleTextChange(e.target.value)}
          className="w-20 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-right text-white font-medium text-xs focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
}

function KPICard({
  label,
  value,
  health,
  hint,
}: {
  label: string;
  value: string;
  health: string;
  hint: string;
}) {
  const color = health === 'good' ? 'text-green-400' : health === 'ok' ? 'text-yellow-400' : health === 'bad' ? 'text-red-400' : 'text-white';
  const bg = health === 'good' ? 'bg-green-500/10 border-green-500/20' : health === 'ok' ? 'bg-yellow-500/10 border-yellow-500/20' : health === 'bad' ? 'bg-red-500/10 border-red-500/20' : 'bg-zinc-800/50 border-zinc-700/50';

  return (
    <div className={`rounded-xl p-3 border ${bg}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-lg font-bold ${color} mt-0.5`}>{value}</div>
      <div className="text-[10px] text-zinc-500 mt-0.5">{hint}</div>
    </div>
  );
}

function MilestoneCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-bold text-white mt-0.5">{value}</div>
      <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>
    </div>
  );
}

function ProjectionTable({ projections }: { projections: MonthProjection[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>📊</span>
          <span className="font-medium text-white">Детальная таблица (24 мес)</span>
        </div>
        <span className="text-zinc-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t border-zinc-800 text-zinc-500">
                <th className="px-3 py-2 text-left font-medium">Мес</th>
                <th className="px-3 py-2 text-right font-medium">Клиенты</th>
                <th className="px-3 py-2 text-right font-medium">Новые</th>
                <th className="px-3 py-2 text-right font-medium">Churn</th>
                <th className="px-3 py-2 text-right font-medium">MRR</th>
                <th className="px-3 py-2 text-right font-medium">Расходы</th>
                <th className="px-3 py-2 text-right font-medium">P&L</th>
                <th className="px-3 py-2 text-right font-medium">Cash</th>
              </tr>
            </thead>
            <tbody>
              {projections.map(p => (
                <tr key={p.month} className="border-t border-zinc-800/50 hover:bg-zinc-800/20">
                  <td className="px-3 py-1.5 text-zinc-400">{p.month}</td>
                  <td className="px-3 py-1.5 text-right text-white">{p.customers}</td>
                  <td className="px-3 py-1.5 text-right text-green-400">+{p.newCustomers}</td>
                  <td className="px-3 py-1.5 text-right text-red-400">-{p.churnedCustomers}</td>
                  <td className="px-3 py-1.5 text-right text-white">${p.mrr.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-400">${p.totalCosts.toLocaleString()}</td>
                  <td className={`px-3 py-1.5 text-right ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${p.netProfit.toLocaleString()}
                  </td>
                  <td className={`px-3 py-1.5 text-right ${p.cashRemaining >= 0 ? 'text-white' : 'text-red-400'}`}>
                    ${p.cashRemaining.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
