'use client';

import React, { useState } from 'react';
import SplitBar from './SplitBar';
import AdSquares from './AdSquares';
import DemandMap from './DemandMap';

// ── Types ────────────────────────────────────────────────────

interface TimelinePoint {
  date: string;
  value: number;
}

interface SearchKeyword {
  query: string;
  source: 'top' | 'rising';
  volume?: number;
  intent: 'commercial' | 'informational' | 'mixed';
  intent_confidence: 'high' | 'medium' | 'low';
}

interface GeoPoint {
  region: string;
  label: string;
  value: number;
}

interface Seasonality {
  monthly_avg: number[];
  peak_months: number[];
  low_months: number[];
  has_seasonality: boolean;
  current_phase: 'peak' | 'rising' | 'declining' | 'low';
  interpretation: string;
}

interface BuyingStage {
  awareness: number;
  consideration: number;
  decision: number;
  dominant_stage: 'awareness' | 'consideration' | 'decision';
  interpretation: string;
}

interface CompetitorTrend {
  name: string;
  domain: string;
  growth: number | null;
  direction: 'up' | 'down' | 'stable';
}

interface DemandIntelligence {
  verdict_phrase?: string;
  verdict_sub?: string;
  intent_interpretation?: string;
  ad_density_interpretation?: string;
  trend_interpretation?: string;
  competitors_interpretation?: string;
  seasonality_interpretation?: string;
  buying_stage_interpretation?: string;
  competitor_trend_interpretation?: string;
  key_factors?: string[];
  block3_connection?: string;
  conclusion_green?: string;
  conclusion_yellow?: string;
  conclusion_red?: string;
  hype_warning?: string;
}

interface DemandBlockData {
  diagnosis: 'green' | 'yellow' | 'red';
  score: number;
  key_metric?: string;
  key_factors?: string[];
  top_keywords?: SearchKeyword[];
  rising_keywords?: SearchKeyword[];
  timeline_5y?: TimelinePoint[];
  timeline_3m?: TimelinePoint[];
  growth_5y?: number | null;
  growth_3m?: number | null;
  commercial_intent_ratio?: number;
  geo_breakdown?: GeoPoint[];
  seasonality?: Seasonality | null;
  buying_stage?: BuyingStage | null;
  competitor_trends?: CompetitorTrend[];
  competitors_found?: Array<{
    name: string;
    domain: string;
    source: string;
    position?: number;
    query?: string;
  }>;
  layer3?: {
    rising_queries_ratio?: number;
    has_momentum?: boolean;
    [key: string]: unknown;
  };
  block_context?: {
    niche?: string;
    demand_index?: number;
    commercial_intent_ratio?: number;
    has_hype_risk?: boolean;
    has_declining_signal?: boolean;
    serp_ad_density?: number;
    rising_queries_ratio?: number;
    historical_volume_ratio?: number;
    diagnosis_reason?: string;
    competitors_found?: Array<{
      name: string;
      domain: string;
      source: string;
      position?: number;
    }>;
    data_quality?: {
      total_keywords?: number;
      classified_successfully?: number;
      classification_confidence?: string;
      cross_validated_with_serp?: boolean;
    };
    [key: string]: unknown;
  };
  intelligence?: DemandIntelligence;
  [key: string]: unknown;
}

interface Props {
  data: DemandBlockData | null;
  loading?: boolean;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────

function diagnosisColor(d: string) {
  if (d === 'green') return { text: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-400/20', dim: 'bg-emerald-400/8', ring: 'ring-emerald-400/20' };
  if (d === 'yellow') return { text: 'text-amber-400', bg: 'bg-amber-400', border: 'border-amber-400/20', dim: 'bg-amber-400/8', ring: 'ring-amber-400/20' };
  return { text: 'text-red-400', bg: 'bg-red-400', border: 'border-red-400/20', dim: 'bg-red-400/8', ring: 'ring-red-400/20' };
}

function diagnosisPill(d: string) {
  if (d === 'green') return 'GO · Спрос подтверждён';
  if (d === 'yellow') return 'MAYBE · Проверить';
  return 'NO · Спрос слабый';
}

const REASON_LABELS: Record<string, string> = {
  commercial_market: 'Коммерческий рынок подтверждён',
  micro_b2b_market: 'Нишевый B2B рынок обнаружен',
  informational_market: 'Информационный рынок — низкий интент покупки',
  declining_market: 'Рынок в стадии снижения',
  hype_without_foundation: 'Хайп без фундамента — временный интерес',
  grey_zone: 'Серая зона — данных недостаточно для вердикта',
  insufficient_volume: 'Недостаточный объём поиска',
};

const PHASE_LABELS: Record<string, { label: string; cls: string }> = {
  peak: { label: 'ПИК', cls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  rising: { label: 'РОСТ', cls: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20' },
  declining: { label: 'СПАД', cls: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  low: { label: 'МИНИМУМ', cls: 'bg-slate-600/30 text-slate-400 border-slate-600' },
};

const STAGE_LABELS: Record<string, string> = {
  awareness: 'ОСВЕДОМЛЁННОСТЬ',
  consideration: 'СРАВНЕНИЕ',
  decision: 'РЕШЕНИЕ',
};

function buildSparklinePath(points: TimelinePoint[], width: number, height: number): string {
  if (points.length < 2) return '';
  const values = points.map(p => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  return points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p.value - min) / range) * (height - 4);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function confidenceDot(c: string) {
  if (c === 'high') return 'bg-emerald-400';
  if (c === 'medium') return 'bg-amber-400';
  return 'bg-slate-500';
}

// Section header helper
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-[#3E6480] uppercase tracking-wider mb-2.5" style={{ fontFamily: 'Syne, sans-serif' }}>
      {children}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────

export default function DemandBlock({ data, loading, error }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // Loading skeleton
  if (loading || !data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-[180px] bg-zinc-800/60 rounded-2xl" />
        <div className="h-[260px] bg-zinc-800/60 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[100px] bg-zinc-800/60 rounded-xl" />
          <div className="h-[100px] bg-zinc-800/60 rounded-xl" />
        </div>
        <div className="h-[120px] bg-zinc-800/60 rounded-xl" />
        <div className="h-[80px] bg-zinc-800/60 rounded-xl" />
        <div className="h-[160px] bg-zinc-800/60 rounded-xl" />
        <div className="h-[120px] bg-zinc-800/60 rounded-xl" />
        <div className="h-[100px] bg-zinc-800/60 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">{error}</div>;
  }

  const dc = diagnosisColor(data.diagnosis);
  const bc = data.block_context || {};
  const intel = data.intelligence;

  // demand_index — нормализация для визуальных компонентов (0-100)
  const rawDemandIndex = bc.demand_index ?? 50;
  const demandIndex = Math.round(
    (rawDemandIndex <= 100
      ? rawDemandIndex
      : Math.min(100, Math.max(0, (typeof data.score === 'number' ? data.score : 5) * 10))
    ) * 10
  ) / 10;

  const commercialRatio = bc.commercial_intent_ratio ?? data.commercial_intent_ratio ?? 0.5;
  const serpAdDensity = bc.serp_ad_density ?? 0;
  const competitors = bc.competitors_found ?? data.competitors_found ?? [];
  const dq = bc.data_quality;
  const topKeywords = data.top_keywords ?? [];
  const risingKeywords = data.rising_keywords ?? [];
  const timeline3m = data.timeline_3m ?? [];
  const timeline5y = data.timeline_5y ?? [];
  const geoBreakdown = data.geo_breakdown ?? [];
  const seasonality = data.seasonality ?? null;
  const buyingStage = data.buying_stage ?? null;
  const competitorTrends = data.competitor_trends ?? [];
  const risingRatio = bc.rising_queries_ratio ?? data.layer3?.rising_queries_ratio ?? 0;
  const hasMomentum = data.layer3?.has_momentum ?? false;

  const rawScore = typeof data.score === 'number' && Number.isFinite(data.score) ? data.score : 0;
  const score = Math.round(rawScore * 10) / 10;

  // Generate signals from data if intelligence key_factors missing
  const signals: string[] = intel?.key_factors ? [...intel.key_factors] : [];
  if (signals.length === 0) {
    if (bc.has_hype_risk) signals.push('Обнаружен хайп-риск — спрос может быть временным');
    if (bc.has_declining_signal) signals.push('Сигнал снижения — исторический объём выше текущего');
    if (dq?.cross_validated_with_serp) signals.push('Подтверждено SERP — найдена платная реклама');
    if (signals.length === 0) signals.push(data.key_metric ?? 'Анализ завершён');
  }

  // Sparkline data for C4
  let sparkData = timeline3m;
  if (sparkData.length < 2) {
    const prev = (bc.prev3m_avg as number) ?? demandIndex * 0.9;
    const last = (bc.last3m_avg as number) ?? demandIndex;
    sparkData = Array.from({ length: 7 }, (_, i) => ({
      date: `w${i + 1}`,
      value: prev + ((last - prev) * i) / 6,
    }));
  }

  const commercialKeywords = topKeywords.filter(k => k.intent === 'commercial');
  const conclusion =
    data.diagnosis === 'green' ? intel?.conclusion_green :
    data.diagnosis === 'yellow' ? intel?.conclusion_yellow :
    intel?.conclusion_red;

  return (
    <div className="space-y-3">
      {/* ═══ C1 — HERO ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-40" />

        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            {/* Diagnosis pill */}
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider ${dc.dim} border ${dc.border} ${dc.text} mb-3`}>
              <span className={`w-[7px] h-[7px] rounded-full ${dc.bg}`} />
              {diagnosisPill(data.diagnosis)}
            </span>

            {/* Title — Bug 1 fix: приоритет verdict_phrase → key_metric → REASON_LABELS */}
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-white mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>
              {intel?.verdict_phrase || data.key_metric || REASON_LABELS[bc.diagnosis_reason as string] || 'Спрос проанализирован'}
            </h2>
            {intel?.verdict_sub && (
              <p className="text-[13px] text-[#7AAAC8] mb-3 leading-relaxed">{intel.verdict_sub}</p>
            )}

            {/* Signals */}
            <div className="space-y-1.5">
              {signals.slice(0, 3).map((sig, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px]">
                  <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${
                    i < 2 ? `${dc.dim} ${dc.text}` : 'bg-amber-400/10 text-amber-400'
                  }`}>
                    {i < 2 ? '↑' : '!'}
                  </span>
                  <span className="text-[#7AAAC8]">{sig}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Score box */}
          <div className="bg-[#111D2A] border border-[#1A2E42] rounded-xl px-5 py-4 text-center shrink-0 w-[160px]">
            <div className="text-[10px] text-[#3E6480] uppercase tracking-widest mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Score
            </div>
            <div className={`text-[54px] font-extrabold leading-none ${dc.text}`} style={{ fontFamily: 'Syne, sans-serif' }}>
              {score}
            </div>
            <span className="text-[16px] text-[#3E6480]" style={{ fontFamily: 'Syne, sans-serif' }}>/10</span>
            <div className="mt-3 h-[5px] bg-[#1A2E42] rounded-full overflow-hidden">
              <div
                className={`h-full ${dc.bg} rounded-full transition-all duration-1000`}
                style={{ width: `${score * 10}%` }}
              />
            </div>
            <div className="text-[11px] text-[#3E6480] text-right mt-1 font-mono">
              {score * 10}%
            </div>
          </div>
        </div>
      </div>

      {/* ═══ C2 — DEMAND MAP ═══ */}
      <DemandMap
        demandIndex={demandIndex}
        commercialRatio={commercialRatio}
        title={bc.niche ?? 'Ваша ниша'}
      />

      {/* ═══ C3 — INTENT & AD DENSITY ═══ */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Интент запросов</SectionHeader>
          <SplitBar commercialRatio={commercialRatio} />
          {intel?.intent_interpretation && (
            <p className="text-[11px] text-[#7AAAC8] mt-2 leading-relaxed">{intel.intent_interpretation}</p>
          )}
        </div>

        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Реклама в SERP</SectionHeader>
          <AdSquares density={serpAdDensity} />
          <div className="text-[11px] text-[#3E6480] mt-2 font-mono">
            {(() => {
              const paidCount = Math.round(serpAdDensity * 10);
              const pct = Math.round(serpAdDensity * 100);
              if (paidCount === 0) return 'Платной рекламы в выдаче не обнаружено';
              if (paidCount <= 2) return `${pct}% платной выдачи — низкая конкуренция`;
              if (paidCount <= 5) return `${pct}% платной выдачи — умеренная конкуренция`;
              return `${pct}% платной выдачи — высокая конкуренция`;
            })()}
          </div>
        </div>
      </div>

      {/* ═══ C3b — Momentum cards ═══ */}
      {(data.growth_3m != null || data.growth_5y != null) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4 text-center">
            <SectionHeader>Индекс спроса</SectionHeader>
            <div className="text-3xl font-extrabold text-emerald-400" style={{ fontFamily: 'Syne, sans-serif' }}>
              {rawDemandIndex <= 100 ? rawDemandIndex : demandIndex}
            </div>
            <div className="text-[10px] text-[#3E6480] mt-0.5">
              из 100
            </div>
          </div>

          <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4 text-center">
            <SectionHeader>3 месяца</SectionHeader>
            <div className={`text-3xl font-extrabold ${(data.growth_3m ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`} style={{ fontFamily: 'Syne, sans-serif' }}>
              {data.growth_3m != null ? `${data.growth_3m >= 0 ? '+' : ''}${Math.round(data.growth_3m)}%` : '—'}
            </div>
          </div>

          <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4 text-center">
            <SectionHeader>5 лет</SectionHeader>
            <div className={`text-3xl font-extrabold ${(data.growth_5y ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`} style={{ fontFamily: 'Syne, sans-serif' }}>
              {data.growth_5y != null ? `${data.growth_5y >= 0 ? '+' : ''}${Math.round(data.growth_5y)}%` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* ═══ C4 — SPARKLINE ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader>Динамика (3 мес)</SectionHeader>
          <div className="flex gap-1.5">
            {bc.has_declining_signal && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">
                DECLINING
              </span>
            )}
            {bc.has_hype_risk && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                HYPE RISK
              </span>
            )}
          </div>
        </div>
        <svg viewBox="0 0 400 80" className="w-full h-20" preserveAspectRatio="none">
          <path
            d={buildSparklinePath(sparkData, 400, 80)}
            fill="none"
            stroke={data.diagnosis === 'green' ? '#00F0A0' : data.diagnosis === 'yellow' ? '#FFB340' : '#FF4E5B'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {intel?.trend_interpretation && (
          <p className="text-[11px] text-[#7AAAC8] mt-1.5 leading-relaxed">{intel.trend_interpretation}</p>
        )}
      </div>

      {/* ═══ C4b — HYPE OR STABLE ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader>Хайп или устойчивый</SectionHeader>
          <div className="flex gap-1.5">
            {bc.has_hype_risk ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                HYPE RISK
              </span>
            ) : (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                STABLE
              </span>
            )}
            {hasMomentum && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                MOMENTUM
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#7AAAC8]">Растущих запросов</span>
              <span className={`text-[13px] font-bold font-mono ${
                risingRatio > 0.7 ? 'text-amber-400' : risingRatio > 0.4 ? 'text-emerald-400' : 'text-[#7AAAC8]'
              }`}>
                {Math.round(risingRatio * 100)}%
              </span>
            </div>
            <div className="h-[6px] bg-[#1A2E42] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  risingRatio > 0.7 ? 'bg-amber-400' : risingRatio > 0.4 ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
                style={{ width: `${Math.min(100, risingRatio * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-[#3E6480] mt-1">
              {risingRatio > 0.7
                ? 'Слишком много новых запросов — возможен хайп'
                : risingRatio > 0.4
                ? 'Здоровый рост — появляются новые запросы'
                : 'Стабильный набор запросов — зрелый рынок'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ C5 — KEYWORDS ═══ */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Коммерческие запросы</SectionHeader>
          {commercialKeywords.length > 0 ? (
            <div className="space-y-1.5">
              {commercialKeywords.slice(0, 6).map((kw, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[#EAF2FF] flex-1 truncate">{kw.query}</span>
                  {kw.volume != null && (
                    <div className="w-12 h-1.5 bg-[#1A2E42] rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-emerald-400/60 rounded-full"
                        style={{ width: `${Math.min(100, kw.volume)}%` }}
                      />
                    </div>
                  )}
                  <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${confidenceDot(kw.intent_confidence)}`} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#3E6480] italic">Данные запросов недоступны</p>
          )}
        </div>

        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Растущие запросы</SectionHeader>
          {risingKeywords.length > 0 ? (
            <div className="space-y-1.5">
              {risingKeywords.slice(0, 5).map((kw, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="text-cyan-400 text-[10px] font-bold shrink-0">↑</span>
                  <span className="text-[#EAF2FF] flex-1 truncate">{kw.query}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    kw.intent === 'commercial'
                      ? 'bg-emerald-400/10 text-emerald-400'
                      : kw.intent === 'informational'
                      ? 'bg-blue-400/10 text-blue-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {kw.intent === 'commercial' ? '$' : kw.intent === 'informational' ? 'i' : '?'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#3E6480] italic">Растущих запросов не обнаружено</p>
          )}
        </div>
      </div>

      {/* ═══ C5b — GEOGRAPHY ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <SectionHeader>География спроса</SectionHeader>
        {geoBreakdown.length > 0 ? (
          <div className="space-y-2">
            {(() => {
              const maxVal = Math.max(...geoBreakdown.map(g => g.value), 1);
              return geoBreakdown.slice(0, 5).map((geo, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#7AAAC8] w-28 shrink-0 truncate">{geo.label}</span>
                  <div className="flex-1 h-[6px] bg-[#1A2E42] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        i === 0 ? 'bg-emerald-400' : 'bg-slate-500'
                      }`}
                      style={{ width: `${Math.min(100, (geo.value / maxVal) * 100)}%`, opacity: 1 - i * 0.12 }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-[#7AAAC8] w-8 text-right shrink-0">{geo.value}</span>
                </div>
              ));
            })()}
            <div className="text-[10px] text-[#3E6480] mt-1">
              Относительный интерес по регионам (Google Trends, 100 = макс.)
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[#3E6480] italic">Географические данные недоступны</p>
        )}
      </div>

      {/* ═══ C6 — COMPETITORS IN SERP ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <SectionHeader>Конкуренты в SERP</SectionHeader>
        {competitors.length > 0 ? (
          <div className="space-y-1.5">
            {competitors.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1 text-[12px]">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  c.source === 'paid'
                    ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                    : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}>
                  {c.source === 'paid' ? 'PAID' : 'ORG'}
                </span>
                <span className="text-[#EAF2FF] flex-1 truncate">{c.name || c.domain}</span>
                <span className="text-[11px] text-[#3E6480] font-mono shrink-0">{c.domain}</span>
                {c.position && (
                  <span className="text-[10px] text-[#243A52] font-mono shrink-0">#{c.position}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[#3E6480] italic">Платной рекламы в SERP не обнаружено</p>
        )}
      </div>

      {/* ═══ C6b — COMPETITOR TRENDS ═══ */}
      {competitorTrends.length > 0 && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Тренды конкурентов</SectionHeader>
          <div className="space-y-1.5">
            {competitorTrends.map((ct, i) => (
              <div key={i} className="flex items-center gap-3 py-1 text-[12px]">
                <span className={`text-lg shrink-0 ${
                  ct.direction === 'up' ? 'text-emerald-400' : ct.direction === 'down' ? 'text-red-400' : 'text-slate-500'
                }`}>
                  {ct.direction === 'up' ? '↑' : ct.direction === 'down' ? '↓' : '→'}
                </span>
                <span className="text-[#EAF2FF] flex-1 truncate">{ct.name}</span>
                <span className="text-[11px] text-[#3E6480] font-mono shrink-0">{ct.domain}</span>
                <span className={`text-[12px] font-bold font-mono w-14 text-right shrink-0 ${
                  ct.growth != null
                    ? ct.growth >= 0 ? 'text-emerald-400' : 'text-red-400'
                    : 'text-slate-500'
                }`}>
                  {ct.growth != null ? `${ct.growth >= 0 ? '+' : ''}${ct.growth}%` : 'н/д'}
                </span>
              </div>
            ))}
          </div>
          {intel?.competitor_trend_interpretation && (
            <p className="text-[11px] text-[#7AAAC8] mt-2 italic">{intel.competitor_trend_interpretation}</p>
          )}
          <div className="text-[10px] text-[#3E6480] mt-1">
            Динамика поискового интереса за 12 мес (Google Trends)
          </div>
        </div>
      )}

      {/* ═══ C7 — SEASONALITY ═══ */}
      {seasonality && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <SectionHeader>Сезонность</SectionHeader>
            {(() => {
              const phase = PHASE_LABELS[seasonality.current_phase] ?? PHASE_LABELS.low;
              return (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${phase.cls}`}>
                  {phase.label}
                </span>
              );
            })()}
          </div>

          {seasonality.has_seasonality ? (
            <>
              {/* Monthly bars */}
              {(() => {
                const maxMonth = Math.max(...seasonality.monthly_avg, 1);
                const MONTH_SHORT = ['Я','Ф','М','А','М','И','И','А','С','О','Н','Д'];
                const MONTH_FULL = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
                return (
                  <div className="flex items-end gap-1 mb-2" style={{ height: 64 }}>
                    {seasonality.monthly_avg.map((val, i) => {
                      const isPeak = seasonality.peak_months.includes(i);
                      const isLow = seasonality.low_months.includes(i);
                      const barPct = Math.round((val / maxMonth) * 100);
                      const barH = Math.max(8, Math.round((barPct / 100) * 52)); // 52px max bar + 12px label
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: 64 }}>
                          <div
                            className={`w-full rounded-t-sm ${
                              isPeak ? 'bg-emerald-400' : isLow ? 'bg-slate-600' : 'bg-slate-500/60'
                            }`}
                            style={{ height: barH }}
                            title={`${MONTH_FULL[i]}: ${Math.round(val)}`}
                          />
                          <span className="text-[8px] text-[#3E6480] mt-0.5">
                            {MONTH_SHORT[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="flex gap-3 text-[10px] text-[#3E6480] mb-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" /> Пик
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-slate-600 inline-block" /> Спад
                </span>
              </div>
              <p className="text-[11px] text-[#7AAAC8] leading-relaxed">{seasonality.interpretation}</p>
              {intel?.seasonality_interpretation && (
                <p className="text-[11px] text-[#7AAAC8] mt-1 italic">{intel.seasonality_interpretation}</p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-[#3E6480] italic">Выраженной сезонности нет</p>
          )}
        </div>
      )}

      {/* ═══ C7b — BUYING STAGE ═══ */}
      {buyingStage && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader>Стадия покупки</SectionHeader>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
              buyingStage.dominant_stage === 'decision'
                ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                : buyingStage.dominant_stage === 'consideration'
                ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                : 'bg-blue-400/10 text-blue-400 border-blue-400/20'
            }`}>
              {STAGE_LABELS[buyingStage.dominant_stage]}
            </span>
          </div>

          {/* 3-segment bar */}
          <div className="h-[8px] bg-[#1A2E42] rounded-full overflow-hidden flex mb-2">
            <div
              className="bg-blue-400 h-full transition-all"
              style={{ width: `${buyingStage.awareness}%` }}
              title={`Осведомлённость: ${buyingStage.awareness}%`}
            />
            <div
              className="bg-amber-400 h-full transition-all"
              style={{ width: `${buyingStage.consideration}%` }}
              title={`Сравнение: ${buyingStage.consideration}%`}
            />
            <div
              className="bg-emerald-400 h-full transition-all"
              style={{ width: `${buyingStage.decision}%` }}
              title={`Решение: ${buyingStage.decision}%`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-[#3E6480]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              Осведомлённость {buyingStage.awareness}%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Сравнение {buyingStage.consideration}%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Решение {buyingStage.decision}%
            </span>
          </div>

          <p className="text-[11px] text-[#7AAAC8] mt-2 leading-relaxed">{buyingStage.interpretation}</p>
          {intel?.buying_stage_interpretation && (
            <p className="text-[11px] text-[#7AAAC8] mt-1 italic">{intel.buying_stage_interpretation}</p>
          )}
        </div>
      )}

      {/* ═══ C8 — INTELLIGENCE LAYER ═══ */}
      {intel && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Итог анализа</SectionHeader>

          {conclusion && (
            <p className="text-[13px] text-[#EAF2FF] leading-relaxed mb-2.5">{conclusion}</p>
          )}

          {intel.hype_warning && intel.hype_warning.length > 0 && (
            <div className="bg-amber-400/8 border border-amber-400/20 rounded-lg px-3 py-2 mb-2.5">
              <p className="text-[11px] text-amber-400 leading-relaxed">{intel.hype_warning}</p>
            </div>
          )}

          {intel.block3_connection && (
            <p className="text-[11px] text-[#3E6480] italic">→ Блок 3: {intel.block3_connection}</p>
          )}
        </div>
      )}

      {/* ═══ C9 — SOURCES ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl overflow-hidden">
        <button
          onClick={() => setSourcesOpen(!sourcesOpen)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <span className="text-[10px] text-[#3E6480] uppercase tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>
            Источники данных
          </span>
          <span className="text-[#3E6480] text-xs">{sourcesOpen ? '−' : '+'}</span>
        </button>
        {sourcesOpen && (
          <div className="px-3 pb-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-emerald-400 shrink-0" />
              Google Trends 5л — {timeline5y.length} точек
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-emerald-400 shrink-0" />
              Google Trends 3м — {timeline3m.length} точек
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-cyan-400 shrink-0" />
              SerpAPI SERP — {competitors.length} конкурентов
            </div>
            {dq && (
              <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
                <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${confidenceDot(dq.classification_confidence ?? 'low')}`} />
                Haiku classification — {dq.classified_successfully ?? 0} из {dq.total_keywords ?? 0}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
