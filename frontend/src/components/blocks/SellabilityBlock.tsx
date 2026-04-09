'use client';

import React, { useState, useEffect } from 'react';
import PriceRangeBar from './PriceRangeBar';
import DealCycleTimeline from './DealCycleTimeline';
import FlowingConnector from './FlowingConnector';

// ── Types ────────────────────────────────────────────────────

interface SellabilityBlockData {
  diagnosis: string;
  score: number;
  key_metric?: string;
  key_factors?: string[];
  who_pays?: {
    buyer_discussions: Array<{ text: string; source: string; source_url?: string; data_type?: string }>;
    buyer_profiles: Array<{ text: string; source: string; data_type?: string }>;
    total_data_points: number;
  };
  market_segment?: { segment_type: string; confidence: number };
  average_ticket?: {
    competitor_prices: Array<{ competitor: string; price: string; plan_type: string }>;
    median_price: number | null;
    price_range: string | null;
    price_min: number | null;
    price_premium: number | null;
    psychological_threshold: number | null;
    payment_model: string | null;
    has_trial_period: boolean | null;
  };
  sales_cycle?: {
    complexity: string;
    reasoning: string;
    days: number | null;
    budget_exists: boolean | null;
    budget_signals?: { competitors_are_paid?: boolean; commercial_intent_high?: boolean; reddit_mentions_budget?: boolean } | null;
    market_type: string | null;
    has_trial_period: boolean | null;
    pain_type: string | null;
  };
  path_to_money?: {
    path_to_first_payment: string | null;
    time_to_first_revenue_days: number | null;
    market_readiness_score: number | null;
    main_barrier: string | null;
  };
  communities?: Array<{ name: string; channel_type: string; url: string; member_count: number; mentioned_frequency: number }>;
  traffic_interception_points?: Array<{ type: string; keyword: string; difficulty: string; tactics: string[] }>;
  verdict?: { value: number; formula: string; confidence: number; label: string };
  _raw_diagnosis?: string;
  _block_context?: any;
  intelligence?: any;
  [key: string]: unknown;
}

interface Props {
  data: SellabilityBlockData | null;
  loading?: boolean;
  error?: string;
  trendTitle?: string;
}

// ── Helpers ──────────────────────────────────────────────────

function diagnosisColor(d: string) {
  if (d === 'green') return { text: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-400/20', dim: 'bg-emerald-400/8' };
  if (d === 'yellow') return { text: 'text-amber-400', bg: 'bg-amber-400', border: 'border-amber-400/20', dim: 'bg-amber-400/8' };
  return { text: 'text-red-400', bg: 'bg-red-400', border: 'border-red-400/20', dim: 'bg-red-400/8' };
}

function diagnosisPill(d: string) {
  if (d === 'green') return 'GO';
  if (d === 'yellow') return 'WAIT';
  return 'NO';
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-[#3E6480] uppercase tracking-wider mb-2.5" style={{ fontFamily: 'Syne, sans-serif' }}>
      {children}
    </div>
  );
}

function cycleBadge(days: number | null) {
  if (!days || days <= 7) return { label: 'FAST', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  if (days <= 30) return { label: 'NORMAL', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
  return { label: 'SLOW', color: 'text-red-400 bg-red-400/10 border-red-400/20' };
}

function activeStepFromData(saleCycle: Props['data'] extends null ? never : NonNullable<Props['data']>['sales_cycle']): number {
  if (!saleCycle) return 2;
  if (saleCycle.has_trial_period) return 3;
  if (saleCycle.days && saleCycle.days <= 3) return 4;
  return 2;
}

// ── Component ────────────────────────────────────────────────

// Map sellability-v2 (Block3Output) format to component format
function normalizeData(raw: any): SellabilityBlockData {
  // If already in old adapter format (has average_ticket) — use as-is
  if (raw.average_ticket || raw.sales_cycle || raw.who_pays) return raw;

  // sellability-v2 format → normalize
  const d = raw;
  const diag = d.monetization_verdict === 'CLEAR' ? 'green'
    : d.monetization_verdict === 'PARTIAL' ? 'yellow'
    : d.monetization_verdict === 'NONE' ? 'red' : 'yellow';

  return {
    diagnosis: diag,
    score: d.monetization_verdict === 'CLEAR' ? 8
      : d.monetization_verdict === 'PARTIAL' ? 5
      : d.monetization_verdict === 'UNCLEAR' ? 3 : 1,
    key_metric: d.monetization_diagnosis,
    key_factors: [
      `Архетип: ${d.monetization_archetype}`,
      `Качество: ${d.monetization_quality}`,
      `Трение: ${d.friction_score}`,
      `Данные: ${(d.competitor_monetization || []).filter((c: any) => c.price_usd).length} pricing pages · ${Math.round((d.monetization_confidence ?? 0) * 100)}% уверенность`,
    ],
    _raw_diagnosis: diag,
    average_ticket: {
      competitor_prices: (d.competitor_monetization || []).map((c: any) => ({
        competitor: c.name,
        price: c.price_usd ? `$${c.price_usd}` : (c.requires_sales ? 'Contact Sales' : 'Нет данных'),
        plan_type: d.billing_model || 'subscription',
      })),
      median_price: d.entry_price_usd,
      price_range: d.entry_price_usd ? `$${d.entry_price_usd}` : null,
      price_min: d.entry_price_usd ? Math.round(d.entry_price_usd * 0.5) : null,
      price_premium: d.entry_price_usd ? Math.round(d.entry_price_usd * 3) : null,
      psychological_threshold: d.entry_price_usd,
      payment_model: d.billing_model,
      has_trial_period: d.has_free_trial ?? null,
    },
    sales_cycle: {
      complexity: d.friction_score === 'LOW' ? 'Быстрая' : d.friction_score === 'MEDIUM' ? 'Средняя' : 'Длинная',
      reasoning: d.monetization_diagnosis || '',
      days: d.friction_score === 'LOW' ? 3 : d.friction_score === 'MEDIUM' ? 14 : 45,
      budget_exists: null,
      budget_signals: null,
      market_type: d.monetization_archetype?.includes('ENTERPRISE') ? 'B2B' : null,
      has_trial_period: d.has_free_trial ?? null,
      pain_type: d.block_context?.pain_type || d.pain_type || null,
    },
    path_to_money: {
      path_to_first_payment: d.monetization_diagnosis,
      time_to_first_revenue_days: d.friction_score === 'LOW' ? 7 : d.friction_score === 'MEDIUM' ? 21 : 60,
      market_readiness_score: Math.round((d.monetization_confidence ?? 0.5) * 10),
      main_barrier: d.monetization_risks?.[0]?.message || null,
    },
    communities: [],
    traffic_interception_points: [],
  };
}

export default function SellabilityBlock({ data, loading, error, trendTitle }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [revenueCount, setRevenueCount] = useState(0);

  const normalized = data ? normalizeData(data) : null;
  const revenueDays = normalized?.path_to_money?.time_to_first_revenue_days ?? 0;
  useEffect(() => {
    if (!revenueDays) return;
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setRevenueCount(Math.round(progress * revenueDays));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [revenueDays]);

  if (loading || !data || !normalized) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-[180px] bg-zinc-800/60 rounded-2xl" />
        <div className="h-[120px] bg-zinc-800/60 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-[160px] bg-zinc-800/60 rounded-xl" />
          <div className="h-[160px] bg-zinc-800/60 rounded-xl" />
          <div className="h-[160px] bg-zinc-800/60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-400 text-sm">{error}</div>;

  const d = normalized;
  const diag = d._raw_diagnosis || d.diagnosis || 'yellow';
  const dc = diagnosisColor(diag);
  const intel = d.intelligence;
  const bc = d._block_context || {};
  const at = d.average_ticket;
  const sc = d.sales_cycle;
  const ptm = d.path_to_money;
  const rawScore = typeof d.score === 'number' && Number.isFinite(d.score) ? d.score : (d.verdict?.value ?? 5);
  const score = Math.round(rawScore * 10) / 10;

  const signals: string[] = d.key_factors ? [...d.key_factors] : [];
  if (signals.length === 0) {
    if (at?.payment_model) signals.push(`Модель: ${at.payment_model}`);
    if (sc?.days) signals.push(`Цикл продажи: ${sc.days} дней`);
    if (at?.psychological_threshold) signals.push(`Порог: $${at.psychological_threshold}`);
    if (signals.length === 0) signals.push(d.key_metric || 'Анализ завершён');
  }

  const communities = d.communities?.sort((a, b) => (b.mentioned_frequency ?? 0) - (a.mentioned_frequency ?? 0)) || [];
  const trafficPoints = d.traffic_interception_points || [];
  const budgetSignals = sc?.budget_signals;
  const cb = cycleBadge(sc?.days ?? null);
  const conclusion = diag === 'green' ? intel?.conclusion_green
    : diag === 'yellow' ? intel?.conclusion_yellow
    : intel?.conclusion_red;

  return (
    <div className="space-y-3">
      {/* ═══ C2 — VERDICT HERO ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #00F0A0, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 5s linear infinite' }} />

        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider ${dc.dim} border ${dc.border} ${dc.text} mb-3`}>
              <span className={`w-[7px] h-[7px] rounded-full ${dc.bg}`} />
              {diagnosisPill(diag)} · Продаваемость
            </span>

            <h2 className="text-2xl font-extrabold leading-tight text-white mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>
              {intel?.verdict_phrase || (ptm?.time_to_first_revenue_days
                ? `До первого платежа — ${ptm.time_to_first_revenue_days} дней`
                : data.key_metric || 'Продаваемость проанализирована')}
            </h2>
            {intel?.verdict_sub && (
              <p className="text-[13px] text-[#7AAAC8] mb-3">{intel.verdict_sub}</p>
            )}

            <div className="space-y-1.5">
              {signals.slice(0, 4).map((sig, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px]">
                  <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${
                    i < 3 ? `${dc.dim} ${dc.text}` : 'bg-amber-400/10 text-amber-400'
                  }`}>
                    {i < 3 ? '✓' : '△'}
                  </span>
                  <span className="text-[#7AAAC8]">{sig}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111D2A] border border-[#1A2E42] rounded-xl px-5 py-4 text-center shrink-0 w-[160px]">
            <div className="text-[10px] text-[#3E6480] uppercase tracking-widest mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Score</div>
            <div className={`text-[54px] font-extrabold leading-none ${dc.text}`} style={{ fontFamily: 'Syne, sans-serif' }}>
              {score}
            </div>
            <span className="text-[16px] text-[#3E6480]" style={{ fontFamily: 'Syne, sans-serif' }}>/10</span>
            <div className="mt-3 h-[5px] bg-[#1A2E42] rounded-full overflow-hidden">
              <div className={`h-full ${dc.bg} rounded-full`}
                style={{ width: `${score * 10}%`, animation: 'barIn 1s ease-out 0.6s both' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ C3 — THREE STAT CARDS ═══ */}
      <div className="grid grid-cols-3 gap-3">
        {/* Card A: Market Type */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Тип рынка</SectionHeader>
          <div className="text-3xl font-extrabold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            {sc?.market_type || 'B2C'}
          </div>
          <div className="space-y-1 text-[11px] text-[#7AAAC8]">
            <div>Боль: {sc?.pain_type || '—'}</div>
            <div>Модель: {at?.payment_model || '—'}</div>
            <div>Trial: {at?.has_trial_period ? 'Да' : at?.has_trial_period === false ? 'Нет' : '—'}</div>
          </div>
        </div>

        {/* Card B: Price */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Ценовой порог</SectionHeader>
          <div className="text-3xl font-extrabold text-emerald-400 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {at?.psychological_threshold ? `$${at.psychological_threshold}` : '—'}
          </div>
          {at?.price_min != null && at?.price_premium != null && at?.psychological_threshold != null && (
            <PriceRangeBar
              min={at.price_min}
              median={at.median_price ?? at.price_min}
              premium={at.price_premium}
              threshold={at.psychological_threshold}
            />
          )}
          <div className="space-y-0.5 text-[10px] text-[#3E6480]">
            {at?.competitor_prices?.slice(0, 3).map((cp, i) => (
              <div key={i}>{cp.competitor}: <span className={cp.price.startsWith('$') ? 'text-[#7AAAC8]' : 'text-[#3E6480] italic'}>{cp.price}</span></div>
            ))}
          </div>
          {(at?.competitor_prices?.length ?? 0) > 0 && at?.competitor_prices?.every(cp => !cp.price.startsWith('$')) && (
            <p className="text-[11px] text-[#3E6480] italic mt-2">
              Цены не найдены публично — возможно Enterprise модель или закрытое ценообразование
            </p>
          )}
        </div>

        {/* Card C: Sale Cycle */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Цикл продажи</SectionHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl font-extrabold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              {sc?.days ?? '—'}<span className="text-[16px] text-[#3E6480]">д</span>
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${cb.color}`}>
              {cb.label}
            </span>
          </div>
          <DealCycleTimeline activeStep={activeStepFromData(sc)} />
          <div className="mt-2 space-y-0.5 text-[10px] text-[#3E6480]">
            <div>{sc?.complexity}</div>
            {sc?.reasoning && <div className="truncate">{sc.reasoning.slice(0, 60)}...</div>}
          </div>
        </div>
      </div>

      <FlowingConnector />

      {/* ═══ C4 — PRICING ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <SectionHeader>Ценообразование</SectionHeader>

        {at?.price_min != null && at?.price_premium != null && at?.psychological_threshold != null && (
          <PriceRangeBar
            min={at.price_min}
            median={at.median_price ?? at.price_min}
            premium={at.price_premium}
            threshold={at.psychological_threshold}
          />
        )}

        {/* Budget chips */}
        {budgetSignals && (
          <div className="flex gap-2 mt-3 mb-3">
            {[
              { key: 'competitors_are_paid', label: 'Конкуренты платные' },
              { key: 'commercial_intent_high', label: 'Высокий интент' },
              { key: 'reddit_mentions_budget', label: 'Reddit о бюджете' },
            ].map((chip, i) => {
              const active = (budgetSignals as any)[chip.key];
              return (
                <span key={i} className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${
                  active
                    ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                    : 'bg-[#1A2E42] text-[#3E6480] border-[#243A52]'
                }`} style={{ animation: `chipIn 0.3s ease-out ${0.3 + i * 0.15}s both` }}>
                  {active ? '✓' : '○'} {chip.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <div className="text-[#7AAAC8]">
            <span className="text-[#3E6480]">Модель: </span>
            {at?.payment_model || '—'}
          </div>
          <div className="text-[#7AAAC8]">
            <span className="text-[#3E6480]">Trial: </span>
            {at?.has_trial_period ? 'Доступен' : 'Нет данных'}
          </div>
          <div className="text-[#7AAAC8]">
            <span className="text-[#3E6480]">Диапазон: </span>
            {at?.price_range || '—'}
          </div>
        </div>
      </div>

      {/* ═══ C5 — WHERE TO FIND BUYERS ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <SectionHeader>Где найти покупателей</SectionHeader>

        {communities.length > 0 ? (
          <div className="space-y-2 mb-3">
            {communities.slice(0, 3).map((comm, i) => (
              <a key={i} href={comm.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 bg-[#111D2A] rounded-lg border border-[#1A2E42] hover:border-[#243A52] transition-colors">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 shrink-0">
                  {comm.channel_type}
                </span>
                <span className="text-[12px] text-[#EAF2FF] flex-1 truncate">{comm.name}</span>
                <span className="text-[10px] text-[#3E6480] font-mono shrink-0">
                  {comm.member_count > 0 ? `${(comm.member_count / 1000).toFixed(1)}K` : '—'}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[#3E6480] italic mb-3">
            Сообщества не найдены. Рекомендуем: ProductHunt, LinkedIn Groups, тематические subreddits.
          </p>
        )}

        {trafficPoints.length > 0 && (
          <div className="space-y-1.5">
            {trafficPoints.slice(0, 3).map((tp, i) => {
              const typeColors: Record<string, string> = {
                problem_search: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
                community: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                alternative_search: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
              };
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${typeColors[tp.type] || 'text-[#3E6480] bg-[#1A2E42] border-[#243A52]'}`}>
                    {tp.type === 'problem_search' ? 'PROBLEM' : tp.type === 'community' ? 'COMMUNITY' : tp.type === 'alternative_search' ? 'ALT' : tp.type.toUpperCase()}
                  </span>
                  <span className="text-[#EAF2FF] flex-1 truncate">{tp.keyword}</span>
                  <span className="text-[10px] text-[#3E6480] shrink-0">{tp.difficulty}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FlowingConnector />

      {/* ═══ C6 — PATH TO FIRST MONEY ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <SectionHeader>Путь к первым деньгам</SectionHeader>

        <div className="grid grid-cols-3 gap-4">
          {/* Revenue days */}
          <div className="text-center">
            <div className="text-[40px] font-extrabold text-emerald-400 leading-none" style={{ fontFamily: 'Syne, sans-serif', animation: 'numIn 0.6s ease-out' }}>
              {revenueCount}
            </div>
            <div className="text-[10px] text-[#3E6480] mt-1">дней до первой оплаты</div>
          </div>

          {/* Market readiness */}
          <div className="text-center">
            <div className="text-[40px] font-extrabold text-cyan-400 leading-none" style={{ fontFamily: 'Syne, sans-serif' }}>
              {ptm?.market_readiness_score ?? '—'}
            </div>
            <div className="text-[10px] text-[#3E6480] mt-1">готовность рынка /10</div>
            <div className="mt-2 h-[5px] bg-[#1A2E42] rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full"
                style={{ width: `${(ptm?.market_readiness_score ?? 0) * 10}%`, animation: 'barIn 1s ease-out 0.5s both' }} />
            </div>
          </div>

          {/* Main barrier */}
          <div>
            <div className="text-[11px] text-[#3E6480] mb-1">Основной барьер</div>
            <div className="text-[12px] text-[#7AAAC8]">
              {ptm?.main_barrier || 'Не обнаружен'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ C7 — CONCLUSION + INTELLIGENCE ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <SectionHeader>Итог анализа</SectionHeader>

        <div className={intel?.first_money_interpretation ? 'grid grid-cols-2 gap-4' : ''}>
          <div>
            {conclusion && (
              <p className="text-[13px] text-[#EAF2FF] leading-relaxed mb-3">{conclusion}</p>
            )}
            {!conclusion && ptm?.path_to_first_payment && (
              <p className="text-[13px] text-[#EAF2FF] leading-relaxed mb-3">{ptm.path_to_first_payment}</p>
            )}

            {/* Flow pills */}
            <div className="flex flex-wrap gap-1.5">
              {sc?.pain_type && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1A2E42] text-[#7AAAC8] border border-[#243A52]">
                  {sc.pain_type}
                </span>
              )}
              {sc?.market_type && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1A2E42] text-[#7AAAC8] border border-[#243A52]">
                  {sc.market_type} · {sc.days ?? '?'}д
                </span>
              )}
              {at?.has_trial_period && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                  trial
                </span>
              )}
              {at?.payment_model && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1A2E42] text-[#7AAAC8] border border-[#243A52]">
                  {at.payment_model}
                </span>
              )}
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/20">
                → Блок 5 · Экономика
              </span>
            </div>
          </div>

          {intel?.first_money_interpretation && (
            <div className="border-l border-[#1A2E42] pl-4">
              <div className="text-[10px] text-[#3E6480] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>
                Intelligence
              </div>
              <p className="text-[12px] text-[#7AAAC8] leading-relaxed">
                {intel.first_money_interpretation}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ C8 — SOURCES ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl overflow-hidden">
        <button
          onClick={() => setSourcesOpen(!sourcesOpen)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <span className="text-[10px] text-[#3E6480] uppercase tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>
            Источники · {at?.competitor_prices?.length ?? 0} pricing pages · {communities.length} сообществ
          </span>
          <span className="text-[#3E6480] text-xs">{sourcesOpen ? '−' : '+'}</span>
        </button>
        {sourcesOpen && (
          <div className="px-3 pb-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-emerald-400 shrink-0" />
              SerpAPI — {at?.competitor_prices?.length ?? 0} pricing pages
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-cyan-400 shrink-0" />
              Reddit — budget mentions
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-purple-400 shrink-0" />
              Communities — {communities.length} найдено
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-amber-400 shrink-0" />
              Haiku — classification + deal cycle
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
