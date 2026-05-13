'use client';

import React, { useState, useEffect } from 'react';
import RevenueRangeBar from './RevenueRangeBar';
import FlowingConnector from './FlowingConnector';
import MetricTooltip from '../MetricTooltip';
import type { BlockInterpretation } from '@/types/analysis';

const CAC_CHANNELS: Array<{ key: 'plg' | 'community_led' | 'seo_led' | 'sales_led'; name: string }> = [
  { key: 'plg', name: 'Через продукт (самообслуживание)' },
  { key: 'community_led', name: 'Через сообщество' },
  { key: 'seo_led', name: 'Через SEO / контент' },
  { key: 'sales_led', name: 'Через продавцов' },
];

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
  trendId?: string;
}

// ── Component ────────────────────────────────────────────────

export default function EconomicsBlock({ data, loading, error, trendTitle, trendId }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [interpretation, setInterpretation] = useState<BlockInterpretation | null>(null);
  const [interpretationLoading, setInterpretationLoading] = useState(true);

  useEffect(() => {
    if (!trendId || !data) return;
    let cancelled = false;
    setInterpretationLoading(true);
    fetch(`/api/interpretations/economics?trend_id=${encodeURIComponent(trendId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled) setInterpretation(json); })
      .catch(() => { if (!cancelled) setInterpretation(null); })
      .finally(() => { if (!cancelled) setInterpretationLoading(false); });
    return () => { cancelled = true; };
  }, [trendId, data]);

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
  const isLowConfidence = confidence === 'low' || (data.revenue_confidence ?? '').toString().toLowerCase() === 'low';
  const dataQuality = data.data_quality_score ?? 5;
  const viability = data.revenue_viability ?? (diag === 'green' ? 'viable' : diag === 'yellow' ? 'marginal' : 'not_viable');

  // P0 5.2/5.6: реалистичные бюджеты + список каналов CAC
  const cacScenarios = data.cac_scenarios ?? null;
  const minSignalBudget = data.min_signal_budget ?? null;
  const standardExperimentBudget = data.standard_experiment_budget ?? null;
  const cheapestCacKey: 'plg' | 'community_led' | 'seo_led' | null = (() => {
    if (!cacScenarios) return null;
    const candidates: Array<['plg' | 'community_led' | 'seo_led', number]> = [
      ['plg', cacScenarios.plg?.mid ?? Infinity],
      ['community_led', cacScenarios.community_led?.mid ?? Infinity],
      ['seo_led', cacScenarios.seo_led?.mid ?? Infinity],
    ];
    const finite = candidates.filter(([, v]) => Number.isFinite(v) && v > 0);
    if (!finite.length) return null;
    return finite.reduce((best, cur) => (cur[1] < best[1] ? cur : best))[0];
  })();

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

  // Фильтруем forbidden технические key_factors которые приходят из роута:
  // "Качество: HIGH", "Confidence: LOW", "CAC mid: $X", "Revenue: $X/год"
  const keyFactors: string[] = (data.key_factors ?? []).filter((f: string) =>
    !/^Качество:\s/.test(f) &&
    !/^Confidence:\s/i.test(f) &&
    !/^CAC mid:\s/.test(f) &&
    !/^Revenue:\s/.test(f) &&
    !/^Payback:\s/.test(f),
  );
  const keyMetric = data.key_metric ?? '';
  const intel = data.intelligence_output ?? null;

  // CAC zone
  const serpAd = data.serp_ad_density_used ?? 0;
  const cacZone = serpAd > 0.3 ? 'HIGH' : serpAd > 0.1 ? 'MEDIUM' : 'LOW';

  return (
    <div className="space-y-3">
      {/* ═══ INTERPRETATION LAYER ═══ */}
      <style jsx>{`
        @keyframes eb-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .eb-interp { background: linear-gradient(180deg,#0F1A26 0%,#0D1620 100%); border:1px solid #243C55; border-radius:14px; padding:24px 26px; position:relative; overflow:hidden; }
        .eb-interp::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#00EE9A,#00CFFF,#00EE9A,transparent); background-size:200%; animation:eb-shimmer 5s linear infinite; }
        .eb-interp h2 { font-size:20px; line-height:1.35; font-weight:800; color:#E8F2FF; margin:0 0 12px 0; letter-spacing:-0.01em; }
        .eb-interp .insight { font-size:13.5px; line-height:1.6; color:#A8C0D8; margin:0 0 18px 0; }
        .eb-interp .facts { display:flex; flex-direction:column; gap:8px; padding:14px 16px; background:rgba(0,238,154,0.03); border:1px solid rgba(0,238,154,0.10); border-radius:10px; margin-bottom:16px; }
        .eb-interp .fact { display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.5; color:#C8DCED; }
        .eb-interp .marker { color:#00EE9A; font-size:10px; line-height:1.6; flex-shrink:0; margin-top:2px; }
        .eb-interp .impact { border-top:1px solid #1A2E42; padding-top:14px; }
        .eb-interp .impact-label { display:block; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#3E6480; font-weight:700; margin-bottom:6px; }
        .eb-interp .impact p { font-size:13px; line-height:1.55; color:#E8F2FF; margin:0; font-weight:500; }
        .eb-skel { background:#0D1620; border:1px solid #1A2E42; border-radius:14px; padding:24px 26px; display:flex; flex-direction:column; gap:12px; }
        .eb-skel-line { height:14px; border-radius:6px; background:linear-gradient(90deg,#1A2E42 0%,#243C55 50%,#1A2E42 100%); background-size:200% 100%; animation:eb-shimmer 1.6s linear infinite; }
      `}</style>
      {!interpretationLoading && interpretation ? (
        <div className="eb-interp">
          <h2>{interpretation.headline}</h2>
          <p className="insight">{interpretation.main_insight}</p>
          <div className="facts">
            {interpretation.key_facts.map((fact, i) => (
              <div key={i} className="fact">
                <span className="marker">◆</span>
                <span>{fact}</span>
              </div>
            ))}
          </div>
          <div className="impact">
            <span className="impact-label">Что это значит для тебя:</span>
            <p>{interpretation.decision_impact}</p>
          </div>
        </div>
      ) : interpretationLoading ? (
        <div className="eb-skel">
          <div className="eb-skel-line" style={{ width: '75%' }} />
          <div className="eb-skel-line" style={{ width: '100%' }} />
          <div className="eb-skel-line" style={{ width: '83%' }} />
        </div>
      ) : null}

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
              {isLowConfidence
                ? (revHigh > 0
                    ? <>Потенциал <span style={{ color: dc.hex }}>{formatMoney(revLow)} — {formatMoney(revHigh)}</span> в год</>
                    : (keyMetric || 'Экономика проанализирована'))
                : (revHigh > 0
                    ? <>До <span style={{ color: dc.hex }}>{formatMoney(revHigh)}</span> в год — реалистичный сценарий</>
                    : (keyMetric || 'Экономика проанализирована'))}
            </h2>
            <p className="text-[13px] text-[#7AAAC8] mb-2">
              {isLowConfidence
                ? 'Оценка ориентировочная — данных о ценах конкурентов немного. Точнее скажут первые клиенты.'
                : (revMid > 0
                    ? `Три независимых метода расчёта.${monthsToRevenue > 0 ? ` ${monthsToRevenue.toFixed(1)} мес до первых денег.` : ''}`
                    : (keyMetric || 'Экономика проанализирована.'))}
            </p>
            <p className="text-[11px] text-[#3E6480] italic mb-3">
              Блок 4 определил конкурентов · Блок 5 считает: сколько на этом можно заработать?
            </p>

            <div className="space-y-1.5">
              {!isLowConfidence && revMid > 0 && (
                <div className="flex items-start gap-2 text-[12.5px]">
                  <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${dc.dim} ${dc.text}`}>✓</span>
                  <span className="text-[#7AAAC8]"><b className="text-white">Реалистичный диапазон {formatMoney(revLow)} — {formatMoney(revHigh)}/год</b></span>
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
            <div className="text-[10px] text-[#3E6480] mt-2 pt-2 border-t border-[#1A2E42]">
              {viability === 'viable' ? 'жизнеспособная' : viability === 'marginal' ? 'маржинальная' : 'не работает'}
            </div>
          </div>
        </div>
      </div>

      <FlowingConnector />

      {/* ═══ C3 — THREE STAT CARDS ═══ */}
      <div className="grid grid-cols-3 gap-3">
        {/* Card A: Revenue */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5 relative overflow-hidden" style={{ borderLeft: '3px solid #00F0A0' }}>
          <div className="absolute top-0 left-0 right-0 h-[70px] pointer-events-none opacity-55" style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(0,240,160,0.15), transparent 70%)' }} />
          <div className="text-[9px] text-[#3E6480] uppercase tracking-wider mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>ПОТЕНЦИАЛ ВЫРУЧКИ</div>
          {isLowConfidence ? (
            <>
              <div className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 mb-2">
                ⚠ Ориентировочная оценка
              </div>
              <div className="text-[26px] font-extrabold text-emerald-400 leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                {formatMoney(revLow)} — {formatMoney(revHigh)}
              </div>
              <div className="text-[11px] text-[#3E6480] mb-2">/год · диапазон</div>
              <p className="text-[10px] text-[#7AAAC8] leading-snug mb-3">
                Данных о ценах конкурентов немного — точнее покажут первые клиенты.
              </p>
            </>
          ) : (
            <>
              <div className="text-[40px] font-extrabold text-emerald-400 leading-none" style={{ fontFamily: 'Syne, sans-serif', animation: 'numIn 0.8s 0.25s ease both', opacity: 0 }}>
                {formatMoney(revMid)}
              </div>
              <div className="text-[11px] text-[#3E6480] mb-3">/год · реалистичный</div>
            </>
          )}

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

        {/* Card B: CAC channels */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5 relative overflow-hidden" style={{ borderTop: '2px solid #FFB340' }}>
          <div className="absolute top-0 left-0 right-0 h-[70px] pointer-events-none opacity-55" style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(255,179,64,0.14), transparent 70%)' }} />
          <div className="text-[9px] text-[#3E6480] uppercase tracking-wider mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            СТОИМОСТЬ ПРИВЛЕЧЕНИЯ КЛИЕНТА<MetricTooltip term="CAC" value={cac} />
          </div>
          {cacScenarios ? (
            <div className="space-y-1.5">
              {CAC_CHANNELS.filter((ch) => cacScenarios[ch.key]?.mid != null).map((ch) => {
                const isCheapest = ch.key === cheapestCacKey;
                return (
                  <div
                    key={ch.key}
                    className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] ${
                      isCheapest
                        ? 'bg-emerald-400/8 border border-emerald-400/25'
                        : 'bg-[#111D2A] border border-[#1A2E42]'
                    }`}
                  >
                    <span className={isCheapest ? 'text-emerald-400 font-semibold' : 'text-[#7AAAC8]'}>
                      {ch.name}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono font-bold ${isCheapest ? 'text-emerald-400' : 'text-[#7AAAC8]'}`}>
                        ${Math.round(cacScenarios[ch.key].mid)}
                      </span>
                      {isCheapest && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 uppercase tracking-wider">
                          рекомендуем
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[40px] font-extrabold text-amber-400 leading-none" style={{ fontFamily: 'Syne, sans-serif' }}>
              {cac > 0 ? `$${Math.round(cac)}` : '—'}
            </div>
          )}
          {(minSignalBudget || standardExperimentBudget) && (
            <div className="mt-3 pt-3 border-t border-[#1A2E42]">
              <div className="text-[9px] text-[#3E6480] uppercase tracking-wider mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                Бюджет на проверку
              </div>
              <div className="space-y-1.5 text-[11px]">
                {minSignalBudget != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#7AAAC8]">Первый сигнал · 3 клиента</span>
                    <span className="font-mono font-bold text-emerald-400">${Number(minSignalBudget).toLocaleString()}</span>
                  </div>
                )}
                {standardExperimentBudget != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#7AAAC8]">Полный тест · 10 клиентов</span>
                    <span className="font-mono font-bold text-cyan-400">${Number(standardExperimentBudget).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
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

      {/* ═══ C4.3 — METHOD DISAGREEMENT ═══ */}
      {data?.revenue_method_agreement === false && data?.method_a_result != null && data?.method_b_result != null && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4" style={{ borderLeft: '3px solid #FFB340' }}>
          <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-2" style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
            ⚡ Два расчёта дают разные результаты
          </div>
          <div className="flex items-center gap-3 mb-2 text-[12px]">
            <span className="text-[#7AAAC8]">По конкурентам: <strong className="text-white">{formatMoney(data.method_a_result)}</strong></span>
            <span className="text-[#3E6480]">vs</span>
            <span className="text-[#7AAAC8]">По спросу: <strong className="text-white">{formatMoney(data.method_b_result)}</strong></span>
          </div>
          <p className="text-[11px] text-[#3E6480] m-0">Реальный потенциал покажут первые продажи</p>
        </div>
      )}

      {/* ═══ C4.5 — GROWTH TIMELINE ═══ */}
      {data?.cumulative_timeline && (data.cumulative_timeline.month_24_monthly_revenue > 0 || data.cumulative_timeline.month_36_monthly_revenue > 0) && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <div className="text-[10px] text-[#3E6480] uppercase tracking-wider mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
            Динамика роста
          </div>
          <div className="flex gap-6">
            {data.cumulative_timeline.month_first_revenue != null && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-[#3E6480]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Месяц 1</span>
                <span className="text-[15px] font-semibold text-amber-400">первые деньги</span>
              </div>
            )}
            {data.cumulative_timeline.month_24_monthly_revenue > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-[#3E6480]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Год 2</span>
                <span className="text-[15px] font-semibold text-amber-400">
                  ${Math.round(data.cumulative_timeline.month_24_monthly_revenue / 1000)}K/мес
                </span>
              </div>
            )}
            {data.cumulative_timeline.month_36_monthly_revenue > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-[#3E6480]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Год 3</span>
                <span className="text-[15px] font-semibold text-emerald-400">
                  ${Math.round(data.cumulative_timeline.month_36_monthly_revenue / 1000)}K/мес
                </span>
              </div>
            )}
          </div>
        </div>
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
                → {formatMoney(revMid)}/год
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
                  Запросы с намерением купить: {Math.round((method2.commercial_intent_ratio ?? 0) * 100)}%
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#7AAAC8]">
                  <span className="text-emerald-400 text-[11px]">✓</span>
                  Спрос {method2.has_declining_signal ? <span className="text-amber-400">падает ⚠</span> : 'не падает'}
                </div>
                {method2.reasoning && (
                  <div className="text-[11px] text-[#3E6480] mt-1">{method2.reasoning.slice(0, 80)}</div>
                )}
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
                {method3.sale_cycle_days ?? '?'} дней цикл → {method3.months_to_first_revenue?.toFixed(1) ?? monthsToRevenue.toFixed(1)} мес
              </div>
              {method3.reasoning && <div className="text-[11px] text-[#3E6480] mt-1">{method3.reasoning.slice(0, 80)}</div>}
              <div className="text-[12px] font-bold text-cyan-400 mt-2 pt-2 border-t border-[#1A2E42]" style={{ fontFamily: 'Syne, sans-serif' }}>
                → {monthsToRevenue.toFixed(1)} мес до первой выручки
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
            {!isLowConfidence && revMid > 0 && (
              <>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-400/5 border border-emerald-400/20 text-emerald-400 font-mono">{formatMoney(revMid)}/год</span>
                <span className="text-[#243A52] text-[12px]">→</span>
              </>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-400/5 border border-cyan-400/20 text-cyan-400 font-mono">AI Синтез</span>
          </div>
        </div>

        {/* Intelligence Layer */}
        {intel ? (
          <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5" style={{ animation: 'fadeUp 0.4s ease both' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-[#3E6480] uppercase tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>Intelligence Layer · Аналитический контекст</span>
              {/* narrative_mode (HIGH/MEDIUM/LOW) badge скрыт — технический код */}
            </div>

            {intel.narrative_economics && (
              <p className="text-[13px] text-[#7AAAC8] leading-relaxed mb-3.5">{intel.narrative_economics}</p>
            )}

            <div className="border-t border-[#1A2E42] pt-3 space-y-3">
              {intel.revenue_quality_explanation && (
                <div>
                  <div className="text-[10px] text-[#3E6480] uppercase tracking-wider mb-1">Качество выручки</div>
                  <p className="text-[12px] text-[#7AAAC8]">{intel.revenue_quality_explanation}</p>
                </div>
              )}
              {intel.experiment_budget_explanation && (
                <div>
                  <div className="text-[10px] text-[#3E6480] uppercase tracking-wider mb-1">Бюджет на проверку</div>
                  <p className="text-[12px] text-[#7AAAC8]">{intel.experiment_budget_explanation}</p>
                </div>
              )}
              {intel.payback_explanation && (
                <div>
                  <div className="text-[10px] text-[#3E6480] uppercase tracking-wider mb-1">Окупаемость клиента</div>
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
