import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/FinancialCalculator.tsx': `'use client';

import { useState } from 'react';
import { Calculator, DollarSign, Percent, TrendingUp, RotateCcw } from 'lucide-react';

type CalcMode = 'loan' | 'roi' | 'margin' | 'compound';

interface CalcResult {
  label: string;
  value: string;
  highlight?: boolean;
}

export default function FinancialCalculator() {
  const [mode, setMode] = useState<CalcMode>('loan');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [results, setResults] = useState<CalcResult[]>([]);

  function setInput(key: string, val: string) {
    setInputs(prev => ({ ...prev, [key]: val }));
  }

  function num(key: string): number {
    return parseFloat(inputs[key] || '0') || 0;
  }

  function calcLoan() {
    const principal = num('principal');
    const rate = num('rate') / 100 / 12;
    const months = num('months');
    if (!principal || !rate || !months) return;
    const payment = principal * (rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    const total = payment * months;
    const interest = total - principal;
    setResults([
      { label: 'Ежемесячный платёж', value: payment.toFixed(2), highlight: true },
      { label: 'Общая сумма выплат', value: total.toFixed(2) },
      { label: 'Переплата (проценты)', value: interest.toFixed(2) },
      { label: 'Эффективная ставка', value: ((interest / principal) * 100).toFixed(1) + '%' },
    ]);
  }

  function calcROI() {
    const investment = num('investment');
    const revenue = num('revenue');
    if (!investment) return;
    const profit = revenue - investment;
    const roi = (profit / investment) * 100;
    setResults([
      { label: 'Прибыль', value: profit.toFixed(2), highlight: true },
      { label: 'ROI', value: roi.toFixed(1) + '%', highlight: true },
      { label: 'Инвестиция', value: investment.toFixed(2) },
      { label: 'Выручка', value: revenue.toFixed(2) },
    ]);
  }

  function calcMargin() {
    const cost = num('cost');
    const price = num('price');
    if (!price) return;
    const profit = price - cost;
    const margin = (profit / price) * 100;
    const markup = cost > 0 ? (profit / cost) * 100 : 0;
    setResults([
      { label: 'Прибыль с единицы', value: profit.toFixed(2), highlight: true },
      { label: 'Маржа', value: margin.toFixed(1) + '%', highlight: true },
      { label: 'Наценка', value: markup.toFixed(1) + '%' },
    ]);
  }

  function calcCompound() {
    const principal = num('c_principal');
    const rate = num('c_rate') / 100;
    const years = num('c_years');
    const monthly = num('c_monthly');
    if (!principal && !monthly) return;
    let total = principal;
    for (let y = 0; y < years; y++) {
      total = total * (1 + rate) + monthly * 12;
    }
    const invested = principal + monthly * 12 * years;
    const earned = total - invested;
    setResults([
      { label: 'Итоговая сумма', value: total.toFixed(2), highlight: true },
      { label: 'Вложено всего', value: invested.toFixed(2) },
      { label: 'Заработано на процентах', value: earned.toFixed(2), highlight: true },
    ]);
  }

  function calculate() {
    if (mode === 'loan') calcLoan();
    else if (mode === 'roi') calcROI();
    else if (mode === 'margin') calcMargin();
    else calcCompound();
  }

  function reset() {
    setInputs({});
    setResults([]);
  }

  const modes: { id: CalcMode; label: string; icon: any }[] = [
    { id: 'loan', label: 'Кредит', icon: DollarSign },
    { id: 'roi', label: 'ROI', icon: TrendingUp },
    { id: 'margin', label: 'Маржа', icon: Percent },
    { id: 'compound', label: 'Сложный %', icon: Calculator },
  ];

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-2 flex-wrap">
        {modes.map(m => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setResults([]); setInputs({}); }}
              className="px-4 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all"
              style={{
                borderColor: mode === m.id ? '${t.primary}' : '${t.primary40}',
                background: mode === m.id ? '${t.primary10}' : 'transparent',
                color: mode === m.id ? '${t.primary}' : '${t.text70}',
              }}
            >
              <Icon className="w-3.5 h-3.5" /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mode === 'loan' && (
          <>
            <InputField label="Сумма кредита" value={inputs.principal || ''} onChange={v => setInput('principal', v)} placeholder="1000000" suffix="₽" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
            <InputField label="Годовая ставка" value={inputs.rate || ''} onChange={v => setInput('rate', v)} placeholder="12" suffix="%" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
            <InputField label="Срок" value={inputs.months || ''} onChange={v => setInput('months', v)} placeholder="24" suffix="мес" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
          </>
        )}
        {mode === 'roi' && (
          <>
            <InputField label="Инвестиция" value={inputs.investment || ''} onChange={v => setInput('investment', v)} placeholder="100000" suffix="₽" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
            <InputField label="Выручка" value={inputs.revenue || ''} onChange={v => setInput('revenue', v)} placeholder="150000" suffix="₽" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
          </>
        )}
        {mode === 'margin' && (
          <>
            <InputField label="Себестоимость" value={inputs.cost || ''} onChange={v => setInput('cost', v)} placeholder="500" suffix="₽" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
            <InputField label="Цена продажи" value={inputs.price || ''} onChange={v => setInput('price', v)} placeholder="1000" suffix="₽" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
          </>
        )}
        {mode === 'compound' && (
          <>
            <InputField label="Начальная сумма" value={inputs.c_principal || ''} onChange={v => setInput('c_principal', v)} placeholder="100000" suffix="₽" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
            <InputField label="Годовая ставка" value={inputs.c_rate || ''} onChange={v => setInput('c_rate', v)} placeholder="10" suffix="%" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
            <InputField label="Срок" value={inputs.c_years || ''} onChange={v => setInput('c_years', v)} placeholder="10" suffix="лет" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
            <InputField label="Ежемесячное пополнение" value={inputs.c_monthly || ''} onChange={v => setInput('c_monthly', v)} placeholder="10000" suffix="₽" t="${t.primary40}" tc="${t.text}" tl="${t.text70}" bg="${t.bg}" />
          </>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={calculate}
          className="flex-1 py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          style={{ background: '${t.gradientPrimary}' }}
        >
          <Calculator className="w-4 h-4" /> Рассчитать
        </button>
        <button
          onClick={reset}
          className="px-4 py-3 rounded-xl border text-sm flex items-center gap-1"
          style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {results.map((r, i) => (
            <div
              key={i}
              className="rounded-xl border p-4"
              style={{
                borderColor: r.highlight ? '${t.primary}' : '${t.primary40}',
                background: r.highlight ? '${t.primary10}' : 'transparent',
              }}
            >
              <p className="text-xs" style={{ color: '${t.text50}' }}>{r.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: r.highlight ? '${t.primary}' : '${t.text}' }}>
                {r.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, suffix, t, tc, tl, bg }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; suffix: string; t: string; tc: string; tl: string; bg: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block" style={{ color: tl }}>{label}</label>
      <div className="flex items-center border rounded-xl overflow-hidden" style={{ borderColor: t }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2.5 text-sm outline-none"
          style={{ background: bg, color: tc }}
        />
        <span className="px-3 text-xs font-medium" style={{ color: tl }}>{suffix}</span>
      </div>
    </div>
  );
}
`,
  };
}
