'use client';

import React, { useState } from 'react';
import RevenueRangeBar from './RevenueRangeBar';
import FlowingConnector from './FlowingConnector';
import MetricTooltip from '../MetricTooltip';

// ── Helpers ──────────────────────────────────────────────────

function formatMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n) || n === 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function diagnosisColor(d: string) {
  if (d === 'green') return { text: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-400/20', dim: 'bg-emerald-400/8', hex: '#00F0A0' };
  if (d === 'yellow') return { text: 'text-amber-400', bg: 'bg-amber-400', border: 'border-amber-400/20', dim: 'bg-amber-400/8', hex: '#FFB340' };
  return { text: 'text-red-400', bg: 'bg-red-400', border: 'border-red-400/20', dim: 'bg-red-400/8', hex: '#FF4E5B' };
}

function diagnosisPill(d: string) {
  if (d === 'green') return 'GO · Жизнеспособная экономика';
  if (d === 'yellow') return 'WAIT · Маржинальная';
  return 'NO GO · Не работает';
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-[14px] font-bold text-[#7AAAC8]" style={{ fontFamily: 'Syne, sans-serif' }}>{children}</span>
      <span className="flex-1 h-px bg-[#1A2E42]" />
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────

interface Props {
  data: any;
  loading?: boolean;
  error?: string;
  trendTitle?: string;
}

// ── Component ────────────────────────────────────────────────

export default function EconomicsBlock({ data, loading, error, trendTitle }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (loading || !data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-[200px] bg-zinc-800/60 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-[180px] bg-zinc-800/60 rounded-xl" />
          <div className="h-[180px] bg-zinc-800/60 rounded-xl" />
          <div className="h-[180px] bg-zinc-800/60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-400 text-sm">{error}</div>;

  // Normalize — support both old and new format
  const diag = data.diagnosis || data._raw_diagnosis || 'yellow';
  const dc = diagnosisColor(diag);
  const score = typeof data.score === 'number' && Number.isFinite(data.score) ? Math.round(data.score * 10) / 10 : 5;

  const revLow = data.revenue_low ?? data.revenue_range?.low ?? 0;
  const revMid = data.revenue_mid ?? data.revenue_range?.mid ?? 0;
  const revHigh = data.revenue_high ?? data.revenue_range?.high ?? 0;
  const mLow = data.monthly_revenue_low ?? data.monthly_revenue?.low ?? (revLow / 12);
  const mMid = data.monthly_revenue_mid ?? data.monthly_revenue?.mid ?? (revMid / 12);
  const mHigh = data.monthly_revenue_high ?? data.monthly_revenue?.high ?? (revHigh / 12);

  const confidence = (data.confidence || data.economics_confidence || 'medium').toLowerCase();
  const dataQuality = data.data_quality_score ?? 5;
  const viability = data.revenue_viability ?? (diag === 'green' ? 'viable' : diag === 'yellow' ? 'marginal' : 'not_viable');

  const cacRaw = data.cac_estimate ?? 0;
  const cacBest = data.cac_best as { mid: number; channel: string } | null | undefined;
  // If recommended CAC > $1000 and there's a cheaper channel — show the cheaper one
  const cac = (cacRaw > 1000 && cacBest && cacBest.mid < cacRaw) ? cacBest.mid : cacRaw;
  const cacSource = (cacRaw > 1000 && cacBest && cacBest.mid < cacRaw)
    ? cacBest.channel.toUpperCase()
    : (data.cac_source ?? data.cac_scenarios?.recommended ?? 'UNKNOWN');
  const cacIsAlternative = cacRaw > 1000 && cacBest && cacBest.mid < cacRaw;
  const monthsToRevenue = data.months_to_first_revenue ?? 0;

  const method1 = data.method1 ?? data.methods?.method_1 ?? null;
  const method2 = data.method2 ?? data.methods?.method_2 ?? null;
  const method3 = data.method3 ?? data.methods?.method_3 ?? null;

  const keyFactors = data.key_factors ?? [];
  const keyMetric = data.key_metric ?? '';
  const intel = data.intelligence_output ?? null;

  // CAC zone
  const serpAd = data.serp_ad_density_used ?? 0;
  const cacZone = serpAd > 0.3 ? 'HIGH' : serpAd > 0.1 ? 'MEDIUM' : 'LOW';

  return (
    <div className="space-y-3">
      {/* ═══ C2 — VERDICT HERO ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #00F0A0, #00D4FF, #FFB340, #00F0A0, transparent)', backgroundSize: '300%', animation: 'shimmer 5s linear infinite' }} />

        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider ${dc.dim} border ${dc.border} ${dc.text} mb-3`}>
              <span className={`w-[7px] h-[7px] rounded-full ${dc.bg}`} style={diag === 'green' ? { animation: 'pulse 2s infinite' } : undefined} />
              {diagnosisPill(diag)}
            </span>

            <h2 className="text-2xl font-extrabold leading-tight text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              {revHigh > 0 ? <>До <span style={{ color: dc.hex }}>{formatMoney(revHigh)}</span> в год — реалистичный сценарий</> : keyMetric || 'Экономика проанализирована'}
            </h2>
            <p className="text-[13px] text-[#7AAAC8] mb-2">
              {confidence !== 'low' && revMid > 0
                ? `Три независимых метода. ${confidence.toUpperCase()} confidence. ${monthsToRevenue > 0 ? `${monthsToRevenue.toFixed(1)} мес до первых денег.` : ''}`
                : keyMetric || 'Данные ограничены.'}
            </p>
            <p className="text-[11px] text-[#3E6480] italic mb-3">
              Блок 4 определил gap · Блок 5 считает: сколько на этом можно заработать?
            </p>

            <div className="space-y-1.5">
              {revMid > 0 && (
                <div className="flex items-start gap-2 text-[12.5px]">
                  <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${dc.dim} ${dc.text}`}>✓</span>
                  <span className="text-[#7AAAC8]"><b className="text-white">Revenue Range {formatMoney(revLow)} — {formatMoney(revHigh)}/год</b> · {confidence.toUpperCase()} confidence</span>
                </div>
              )}
              {cac > 0 && (
                <div className="flex items-start gap-2 text-[12.5px]">
                  <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${dc.dim} ${dc.text}`}>✓</span>
                  <span className="text-[#7AAAC8]"><b className="text-white">CAC estimate ${Math.round(cac)}</b> · {cacSource}</span>
                </div>
              )}
              {monthsToRevenue > 0 && (
                <div className="flex items-start gap-2 text-[12.5px]">
                  <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${dc.dim} ${dc.text}`}>✓</span>
                  <span className="text-[#7AAAC8]"><b className="text-white">{monthsToRevenue.toFixed(1)} месяца</b> до первой выручки</span>
                </div>
              )}
            </div>
          </div>

          {/* Score box */}
          <div className="bg-[#111D2A] border border-[#1A2E42] rounded-xl px-5 py-4 text-center shrink-0 w-[160px]">
            <div className="text-[10px] text-[#3E6480] uppercase tracking-widest mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Score</div>
            <div className={`text-[54px] font-extrabold leading-none ${dc.text}`} style={{ fontFamily: 'Syne, sans-serif', animation: 'numIn 0.9s 0.4s ease both', opacity: 0 }}>
              {score}
            </div>
            <span className="text-[16px] text-[#3E6480]" style={{ fontFamily: 'Syne, sans-serif' }}>/10</span>
            <div className="mt-2.5 h-[5px] bg-[#1A2E42] rounded-[3px] overflow-hidden">
              <div className={`h-full rounded-[3px]`} style={{ background: `linear-gradient(90deg, ${dc.hex}, #00D4FF)`, width: `${score * 10}%`, animation: 'barIn 1s 0.6s ease both' }} />
            </div>
            <div className="text-[11px] text-[#3E6480] text-right mt-1 font-mono">{Math.round(score * 10)}%</div>
            <div className="text-[10px] text-[#3E6480] mt-2 pt-2 border-t border-[#1A2E42]">{viability} · data_quality {dataQuality}/10</div>
          </div>
        </div>
      </div>

      <FlowingConnector />

      {/* ═══ C3 — THREE STAT CARDS ═══ */}
      <div className="grid grid-cols-3 gap-3">
        {/* Card A: Revenue Mid */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5 relative overflow-hidden" style={{ borderLeft: '3px solid #00F0A0' }}>
          <div className="absolute top-0 left-0 right-0 h-[70px] pointer-events-none opacity-55" style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(0,240,160,0.15), transparent 70%)' }} />
          <div className="text-[9px] text-[#3E6480] uppercase tracking-wider mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>REVENUE MID</div>
          <div className="text-[40px] font-extrabold text-emerald-400 leading-none" style={{ fontFamily: 'Syne, sans-serif', animation: 'numIn 0.8s 0.25s ease both', opacity: 0 }}>
            {formatMoney(revMid)}
          </div>
          <div className="text-[11px] text-[#3E6480] mb-3">/год · реалистичный</div>

          {/* Mini revenue bars */}
          <div className="space-y-1.5">
            {[
              { label: 'LOW', val: revLow, color: 'rgba(255,78,91,0.5)', pct: revHigh > 0 ? (revLow / revHigh) * 100 : 0, delay: '0.5s' },
              { label: 'MID', val: revMid, color: '#00F0A0', pct: revHigh > 0 ? (revMid / revHigh) * 100 : 0, delay: '0.65s' },
              { label: 'HIGH', val: revHigh, color: 'rgba(0,240,160,0.5)', pct: 100, delay: '0.8s' },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-[28px] text-[10px] font-bold" style={{ fontFamily: 'Syne, sans-serif', color: i === 0 ? '#FF4E5B' : i === 1 ? '#FFB340' : '#00F0A0' }}>{r.label}</span>
                <div className="flex-1 h-[6px] bg-[#162435] rounded-[3px] overflow-hidden">
                  <div className="h-full rounded-[3px]" style={{ backgroundColor: r.color, width: `${Math.min(r.pct, 100)}%`, animation: `barIn 0.9s ${r.delay} ease both` }} />
                </div>
                <span className="w-[52px] text-right font-mono text-[#3E6480]">{formatMoney(r.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card B: CAC */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5 relative overflow-hidden" style={{ borderTop: '2px solid #FFB340' }}>
          <div className="absolute top-0 left-0 right-0 h-[70px] pointer-events-none opacity-55" style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(255,179,64,0.14), transparent 70%)' }} />
          <div className="text-[9px] text-[#3E6480] uppercase tracking-wider mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>СТОИМОСТЬ ПРИВЛЕЧЕНИЯ<MetricTooltip term="CAC" value={cac} /></div>
          <div className="text-[40px] font-extrabold text-amber-400 leading-none" style={{ fontFamily: 'Syne, sans-serif', animation: 'numIn 0.8s 0.35s ease both', opacity: 0 }}>
            {cac > 0 ? `$${Math.round(cac)}` : '—'}
          </div>
          <div className="text-[9px] text-[#3E6480] uppercase tracking-wider mt-1 mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>CAC · {cacZone}</div>

          {cac > 0 && (
            <>
              <div className="bg-[#111D2A] rounded-lg px-2.5 py-2 text-[11px] font-mono text-amber-400 mb-2">
                CAC ${Math.round(cac)} · {cacSource}
              </div>
              {cacIsAlternative && (
                <div className="text-[10px] text-[#3E6480] mb-1.5">
                  Рекомендованный ({data.cac_source}): ${Math.round(cacRaw)} — показан лучший канал
                </div>
              )}
              {revMid > 0 && (
                <div className="text-[11px] text-[#7AAAC8]">
                  Revenue / CAC = <span className="text-emerald-400 font-bold">{Math.round(revMid / cac / 12)}× monthly</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Card C: Time to revenue */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5 relative overflow-hidden" style={{ borderTop: '2px solid #00D4FF' }}>
          <div className="absolute top-0 left-0 right-0 h-[70px] pointer-events-none opacity-55" style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(0,212,255,0.13), transparent 70%)' }} />
          <div className="text-[9px] text-[#3E6480] uppercase tracking-wider mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>МЕСЯЦ ДО ВЫРУЧКИ<MetricTooltip term="PAYBACK" value={data.payback_months ?? monthsToRevenue} /></div>
          <div className="text-[40px] font-extrabold text-cyan-400 leading-none" style={{ fontFamily: 'Syne, sans-serif', animation: 'numIn 0.8s 0.45s ease both', opacity: 0 }}>
            {monthsToRevenue > 0 ? monthsToRevenue.toFixed(1) : '—'}
          </div>

          {/* Mini timeline */}
          <div className="flex items-center gap-0 mt-3 mb-2">
            {['Сделка', 'Онборд', 'Платёж'].map((step, i) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-[8px] h-[8px] rounded-full ${i < 2 ? 'bg-cyan-400' : 'bg-emerald-400'}`}
                    style={i === 2 ? { boxShadow: '0 0 8px #00F0A0', animation: 'pulse 2s infinite' } : undefined} />
                  <span className={`text-[9px] mt-1 ${i === 2 ? 'text-emerald-400' : 'text-[#3E6480]'}`}>{step}</span>
                </div>
                {i < 2 && <div className="h-px flex-1 -mt-3" style={{ background: i === 0 ? '#00D4FF' : '#1A2E42' }} />}
              </React.Fragment>
            ))}
          </div>

          <div className="text-[11px] text-[#3E6480] leading-relaxed border-t border-[#1A2E42] pt-2 mt-2">
            {method3?.sale_cycle_days && <div>sale_cycle_days {method3.sale_cycle_days} / 30 = {monthsToRevenue.toFixed(1)}</div>}
            {method3?.budget_exists != null && <div>budget_exists: {method3.budget_exists ? <span className="text-cyan-400">true</span> : 'false'}</div>}
          </div>
        </div>
      </div>

      {/* ═══ C4 — REVENUE RANGE BAR ═══ */}
      {(revLow > 0 || revMid > 0 || revHigh > 0) && (
        <RevenueRangeBar
          low={revLow} mid={revMid} high={revHigh}
          monthlyLow={mLow} monthlyMid={mMid} monthlyHigh={mHigh}
          dataQualityScore={dataQuality}
        />
      )}

      <FlowingConnector />

      {/* ═══ C5 — METHOD CARDS ═══ */}
      <SectionHeader>Методы расчёта · как считалось</SectionHeader>
      <div className="grid grid-cols-3 gap-3">
        {/* Method 1 */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4" style={{ borderTop: '2px solid #00F0A0' }}>
          <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-emerald-400/8 text-emerald-400 border border-emerald-400/20" style={{ fontFamily: 'Syne, sans-serif' }}>METHOD 1 · ГЛАВНЫЙ<MetricTooltip term="COMPETITOR_BASED" /></span>
          <div className="text-[16px] font-extrabold text-emerald-400 mt-2 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Competitor-based</div>
          <div className="text-[11px] text-[#3E6480] mb-3">По конкурентам</div>

          {method1 ? (
            <>
              <div className="space-y-1.5">
                {[
                  method1.competitor_name ? `${method1.competitor_name}: ${(method1.competitor_g2_reviews ?? 0).toLocaleString()} отзывов × 7 = ${(method1.competitor_customers ?? 0).toLocaleString()} клиентов` : null,
                  method1.competitor_revenue ? `Revenue: ${formatMoney(method1.competitor_revenue)}/год` : null,
                  method1.market_share_pct ? `Доля рынка (gap = ${method1.market_share_pct}%): ×${method1.market_share_pct}%` : null,
                  method1.revenue_estimate ? `= ${formatMoney(method1.revenue_estimate)}` : null,
                ].filter(Boolean).map((step, i) => (
                  <div key={i} className="flex gap-1.5 text-[11px] text-[#7AAAC8]" style={{ animation: `rowIn 0.4s ${0.3 + i * 0.15}s ease both`, opacity: 0 }}>
                    <span className="text-[10px] font-bold text-[#243A52] w-[14px] shrink-0" style={{ fontFamily: 'Syne, sans-serif' }}>{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <div className="text-[12px] font-bold text-emerald-400 mt-2 pt-2 border-t border-[#1A2E42]" style={{ fontFamily: 'Syne, sans-serif' }}>
                → {formatMoney(revMid)}/год · {(method1.confidence || confidence).toUpperCase()} conf
              </div>
            </>
          ) : (
            <div className="text-[11px] text-[#3E6480] italic">Нет данных</div>
          )}
        </div>

        {/* Method 2 */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4" style={{ borderTop: '2px solid #FFB340' }}>
          <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-amber-400/8 text-amber-400 border border-amber-400/20" style={{ fontFamily: 'Syne, sans-serif' }}>METHOD 2 · МОДИФИКАТОР<MetricTooltip term="DEMAND_SIGNAL" /></span>
          <div className="text-[16px] font-extrabold text-amber-400 mt-2 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Demand Signal</div>
          <div className="text-[11px] text-[#3E6480] mb-3">Не считает деньги — корректирует confidence</div>

          {method2 ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-[#7AAAC8]">
                  <span className="text-emerald-400 text-[11px]">✓</span>
                  commercial_intent {method2.commercial_intent_ratio?.toFixed(2) ?? '—'}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#7AAAC8]">
                  <span className="text-emerald-400 text-[11px]">✓</span>
                  declining_signal: {method2.has_declining_signal ? <span className="text-amber-400">⚠ да</span> : '✓ нет'}
                </div>
                {method2.reasoning && (
                  <div className="text-[11px] text-[#3E6480] mt-1">{method2.reasoning.slice(0, 80)}</div>
                )}
              </div>
              <div className="text-[12px] font-bold text-amber-400 mt-2 pt-2 border-t border-[#1A2E42]" style={{ fontFamily: 'Syne, sans-serif' }}>
                → confidence: {confidence.toUpperCase()}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-[#3E6480] italic">Нет данных</div>
          )}
        </div>

        {/* Method 3 */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4" style={{ borderTop: '2px solid #00D4FF' }}>
          <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-cyan-400/8 text-cyan-400 border border-cyan-400/20" style={{ fontFamily: 'Syne, sans-serif' }}>METHOD 3 · ТАЙМИНГ<MetricTooltip term="DEAL_CYCLE" value={method3?.sale_cycle_days} /></span>
          <div className="text-[16px] font-extrabold text-cyan-400 mt-2 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Deal Cycle</div>
          <div className="text-[11px] text-[#3E6480] mb-3">Timing · месяца</div>

          {method3 ? (
            <>
              <div className="bg-[#111D2A] rounded-lg px-3 py-2 text-[12px] font-mono text-cyan-400 text-center mb-2">
                {method3.sale_cycle_days ?? '?'} дней → {method3.months_to_first_revenue?.toFixed(1) ?? monthsToRevenue.toFixed(1)} мес
              </div>
              <div className="space-y-1 text-[11px] text-[#7AAAC8]">
                <div className="flex items-center gap-1.5">
                  <span className="text-cyan-400">◆</span>
                  budget: {method3.budget_exists ? <span className="text-cyan-400">true ✓</span> : 'false'}
                </div>
                {method3.reasoning && <div className="text-[#3E6480] mt-1">{method3.reasoning.slice(0, 80)}</div>}
              </div>
              <div className="text-[12px] font-bold text-cyan-400 mt-2 pt-2 border-t border-[#1A2E42]" style={{ fontFamily: 'Syne, sans-serif' }}>
                → {monthsToRevenue.toFixed(1)} мес · {(method3.confidence || 'medium').toLowerCase()} conf
              </div>
            </>
          ) : (
            <div className="text-[11px] text-[#3E6480] italic">Нет данных</div>
          )}
        </div>
      </div>

      <FlowingConnector />

      {/* ═══ C6 — KEY FACTORS ═══ */}
      {keyFactors.length > 0 && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5">
          <SectionHeader>Ключевые факторы</SectionHeader>
          <div className="space-y-2.5">
            {keyFactors.map((f: string, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2.5 bg-[#111D2A] border border-[#1A2E42] rounded-lg hover:border-[#243C55] transition-colors"
                style={{ animation: `rowIn 0.4s ${0.3 + i * 0.15}s ease both`, opacity: 0 }}>
                <span className="text-[18px] shrink-0">{['📊', '🎯', '⏱', '💰'][i] || '📌'}</span>
                <span className="text-[13px] text-[#EAF2FF] font-mono">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ C7 — BOTTOM ROW ═══ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Conclusion */}
        <div className="bg-[#111D2A] border border-[#1A2E42] rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #00F0A0, transparent)', backgroundSize: '200%', animation: 'shimmer 4s linear infinite' }} />

          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-[18px] font-extrabold mb-3 ${dc.dim} border ${dc.border} ${dc.text}`}
            style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '0.06em' }}>
            {diagnosisPill(diag).split(' · ')[0]}
          </span>

          <div className="text-[13px] font-bold text-[#7AAAC8] mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>Итог · Блок 5 — Экономика</div>
          <p className="text-[12px] text-[#7AAAC8] leading-relaxed mb-3">
            {keyMetric || (revMid > 0 ? `${formatMoney(revMid)} реалистичный потенциал. CAC $${Math.round(cac)} при ${viability} экономике.` : 'Данные ограничены для расчёта.')}
          </p>

          <div className="flex flex-wrap items-center gap-1 mb-2.5">
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-400/5 border border-emerald-400/20 text-emerald-400 font-mono">{formatMoney(revMid)}/год</span>
            <span className="text-[#243A52] text-[12px]">→</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#0C1520] border border-[#1A2E42] text-[#3E6480] font-mono">CAC ${Math.round(cac)}</span>
            <span className="text-[#243A52] text-[12px]">→</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-400/5 border border-cyan-400/20 text-cyan-400 font-mono">AI Синтез</span>
          </div>
        </div>

        {/* Intelligence Layer */}
        {intel ? (
          <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5" style={{ animation: 'fadeUp 0.4s ease both' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-[#3E6480] uppercase tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>Intelligence Layer · Аналитический контекст</span>
              {intel.narrative_mode && (
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                  intel.narrative_mode === 'HIGH_CONFIDENCE_GREEN' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                  : intel.narrative_mode === 'LOW_CONFIDENCE_RED' ? 'bg-red-400/10 text-red-400 border-red-400/20'
                  : 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                }`}>
                  {intel.narrative_mode === 'HIGH_CONFIDENCE_GREEN' ? 'HIGH' : intel.narrative_mode === 'LOW_CONFIDENCE_RED' ? 'LOW' : 'MEDIUM'}
                </span>
              )}
            </div>

            {intel.narrative_economics && (
              <p className="text-[13px] text-[#7AAAC8] leading-relaxed mb-3.5">{intel.narrative_economics}</p>
            )}

            <div className="border-t border-[#1A2E42] pt-3 space-y-3">
              {intel.revenue_quality_explanation && (
                <div>
                  <div className="text-[10px] text-[#3E6480] font-mono mb-1">revenue_quality:</div>
                  <p className="text-[12px] text-[#7AAAC8]">{intel.revenue_quality_explanation}</p>
                </div>
              )}
              {intel.experiment_budget_explanation && (
                <div>
                  <div className="text-[10px] text-[#3E6480] font-mono mb-1">experiment_budget:</div>
                  <p className="text-[12px] text-[#7AAAC8]">{intel.experiment_budget_explanation}</p>
                </div>
              )}
              {intel.payback_explanation && (
                <div>
                  <div className="text-[10px] text-[#3E6480] font-mono mb-1">payback:</div>
                  <p className="text-[12px] text-[#7AAAC8]">{intel.payback_explanation}</p>
                </div>
              )}
            </div>

            {intel.bridge_to_strategy && (
              <div className="border-t border-[#1A2E42] pt-3 mt-3">
                <span className="text-[11px] text-cyan-400">→ в Стратегию:</span>
                <p className="text-[12px] text-[#EAF2FF] font-medium mt-1">{intel.bridge_to_strategy}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5">
            <span className="text-[10px] text-[#3E6480] uppercase tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>Intelligence Layer · загружается...</span>
            <div className="mt-3 space-y-2 animate-pulse">
              <div className="h-3 bg-[#1A2E42] rounded w-[80%]" />
              <div className="h-3 bg-[#1A2E42] rounded w-[60%]" />
              <div className="h-3 bg-[#1A2E42] rounded w-[90%]" />
            </div>
          </div>
        )}
      </div>

      {/* ═══ C8 — SOURCES ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl overflow-hidden">
        <button onClick={() => setSourcesOpen(!sourcesOpen)} className="w-full flex items-center justify-between p-3 text-left hover:bg-[#111D2A] transition-colors">
          <span className="text-[10px] text-[#3E6480] uppercase tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>
            Источники · Block 2/3/4 данные · G2 Reviews · 3 метода расчёта
          </span>
          <span className="text-[#3E6480] text-xs">{sourcesOpen ? '−' : '+'}</span>
        </button>
        {sourcesOpen && (
          <div className="px-3 pb-3 space-y-1.5 border-t border-[#1A2E42]">
            {[
              { dot: 'bg-emerald-400', text: 'Block 2: commercial_intent, serp_ad_density', status: '✓' },
              { dot: 'bg-amber-400', text: 'Block 3: price_range.median, sale_cycle_days', status: '✓' },
              { dot: 'bg-cyan-400', text: 'Block 4: g2_reviews, gap_type, competitor_size', status: '✓' },
              { dot: 'bg-purple-400', text: '3 метода расчёта (конкурент + спрос + цикл)', status: '✓' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-[#7AAAC8] py-1">
                <span className={`w-[6px] h-[6px] rounded-full ${s.dot} shrink-0`} />
                <span className="flex-1">{s.text}</span>
                <span className="text-emerald-400">{s.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
