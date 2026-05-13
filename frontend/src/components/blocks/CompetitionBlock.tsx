'use client';

import React, { useState, useEffect } from 'react';
import CompetitorSizeCircle from './CompetitorSizeCircle';
import GapBar from './GapBar';
import FlowingConnector from './FlowingConnector';
import type { BlockInterpretation } from '@/types/analysis';

// ── Types ────────────────────────────────────────────────────

interface CompetitionBlockData {
  diagnosis?: string;
  score?: number;
  key_metric?: string;
  key_factors?: string[];
  block_context?: {
    competitor_count?: number;
    top_competitor?: string;
    top_competitor_size?: 'micro' | 'small' | 'medium' | 'large';
    top_competitor_g2_reviews?: number;
    gap_type?: 'strategic' | 'execution' | 'none';
    top_gap_category?: string;
    has_strategic_gap?: boolean;
    entry_point?: string;
    entry_point_reasoning?: string;
    strategic_gap_summary?: string;
    positioning_vectors?: string[];
    [key: string]: unknown;
  };
  competitors?: Array<{
    name: string;
    domain: string;
    size?: { estimate?: string; raw?: { g2_reviews?: number } };
    primary_segment?: string;
    top_complaints?: Array<{ category: string; count: number; sample_quote?: string }>;
    payment_model?: string;
    source?: string;
  }>;
  strategic_gaps?: Array<{ reasoning?: string; quote?: string; source?: string; competitor_domain?: string; complaint_category?: string }>;
  execution_gaps?: Array<{ quote?: string; source?: string; complaint_category?: string; competitor_domain?: string }>;
  positioning_vectors?: string[];
  layers?: {
    layer1?: { competitors?: any[] };
    layer2?: { strategic_gaps?: any[]; execution_gaps?: any[]; classification_details?: any };
    layer3?: { strategic_gap_summary?: string; entry_point_reasoning?: string };
  };
  intelligence?: any;
  [key: string]: unknown;
}

interface Props {
  data: CompetitionBlockData | null;
  loading?: boolean;
  error?: string;
  trendId?: string;
}

// Размер конкурента в человеческом языке
function sizeHumanLabel(s?: string): string {
  if (s === 'large') return 'крупный игрок';
  if (s === 'medium') return 'средний игрок';
  if (s === 'small') return 'небольшой игрок';
  if (s === 'micro') return 'стартап';
  return 'игрок неизвестного размера';
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

function gapTypeLabel(gt: string) {
  if (gt === 'strategic') return 'Стратегический gap найден';
  if (gt === 'execution') return 'Execution gap';
  return 'Gap не найден';
}

function gapTypeColor(gt: string) {
  if (gt === 'strategic') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  if (gt === 'execution') return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  return 'text-red-400 bg-red-400/10 border-red-400/20';
}

function sizeBarWidth(s: string) {
  if (s === 'large') return 100;
  if (s === 'medium') return 60;
  if (s === 'small') return 30;
  return 15;
}

function sizeBarColor(s: string) {
  if (s === 'large') return '#00F0A0';
  if (s === 'medium') return '#FFB340';
  return '#2E4D68';
}

// ── Component ────────────────────────────────────────────────

export default function CompetitionBlock({ data, loading, error, trendId }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [interpretation, setInterpretation] = useState<BlockInterpretation | null>(null);
  const [interpretationLoading, setInterpretationLoading] = useState(true);

  useEffect(() => {
    if (!trendId || !data) return;
    let cancelled = false;
    setInterpretationLoading(true);
    fetch(`/api/interpretations/competition?trend_id=${encodeURIComponent(trendId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled) setInterpretation(json); })
      .catch(() => { if (!cancelled) setInterpretation(null); })
      .finally(() => { if (!cancelled) setInterpretationLoading(false); });
    return () => { cancelled = true; };
  }, [trendId, data]);

  if (loading || !data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-[180px] bg-zinc-800/60 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-[140px] bg-zinc-800/60 rounded-xl" />
          <div className="h-[140px] bg-zinc-800/60 rounded-xl" />
          <div className="h-[140px] bg-zinc-800/60 rounded-xl" />
        </div>
        <div className="h-[200px] bg-zinc-800/60 rounded-xl" />
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-400 text-sm">{error}</div>;

  const diag = data.diagnosis || 'yellow';
  const dc = diagnosisColor(diag);
  const bc = data.block_context || {};
  const intel = data.intelligence;
  const rawScore = typeof data.score === 'number' && Number.isFinite(data.score) ? data.score : 5;
  const score = Math.round(rawScore * 10) / 10;

  const gapType = bc.gap_type || 'none';
  const hasStrategicGap = bc.has_strategic_gap ?? false;
  const competitors = (data.layers?.layer1?.competitors || data.competitors || []) as any[];
  const competitorCount = bc.competitor_count ?? competitors.length;

  // Gap breakdown from classification details
  const strategicGaps = data.layers?.layer2?.strategic_gaps || data.strategic_gaps || [];
  const executionGaps = data.layers?.layer2?.execution_gaps || data.execution_gaps || [];
  const classDetails = data.layers?.layer2?.classification_details;

  const gapBreakdown: Array<{ category: string; percent: number; gapType: 'strategic' | 'execution' }> = [];
  const allGaps = [
    ...strategicGaps.map((g: any) => ({ category: g.complaint_category || 'unknown', type: 'strategic' as const })),
    ...executionGaps.map((g: any) => ({ category: g.complaint_category || 'unknown', type: 'execution' as const })),
  ];
  const totalGaps = allGaps.length || 1;
  const catCounts = new Map<string, { count: number; type: 'strategic' | 'execution' }>();
  allGaps.forEach(g => {
    const existing = catCounts.get(g.category);
    if (existing) existing.count++;
    else catCounts.set(g.category, { count: 1, type: g.type });
  });
  catCounts.forEach(({ count, type }, category) => {
    gapBreakdown.push({ category, percent: Math.round((count / totalGaps) * 100), gapType: type });
  });

  const positioningVectors = bc.positioning_vectors || data.positioning_vectors || [];
  const entryPoint = bc.entry_point || '';
  const entryPointReasoning = bc.entry_point_reasoning || data.layers?.layer3?.entry_point_reasoning || '';

  // P0 — есть ли реальные данные для gap анализа?
  // Если нет, entry_point будет LLM-выдумка — скрываем и показываем positioning_vectors
  const hasRealGapData = (
    gapType !== 'none' ||
    hasStrategicGap === true ||
    competitors.some((c: any) => Array.isArray(c?.top_complaints) && c.top_complaints.length > 0) ||
    strategicGaps.length > 0 ||
    executionGaps.length > 0
  );

  // Фильтрация технических key_factors которые не должны видеть пользователи
  const filteredKeyFactors: string[] = (data.key_factors ?? []).filter(
    (f: string) =>
      !f.includes('Недостаточно отзывов') &&
      !f.includes('Рекомендуется ручное') &&
      !f.includes('<5'),
  );

  const signals: string[] = [...filteredKeyFactors];
  if (signals.length === 0) {
    if (hasRealGapData) signals.push(`${gapTypeLabel(gapType)} · ${bc.top_gap_category || '—'}`);
    signals.push(`${competitorCount} конкурентов · лидер: ${bc.top_competitor || '—'}`);
    if (hasRealGapData && entryPoint) signals.push(entryPoint.slice(0, 80));
  }

  const conclusion = diag === 'green' ? intel?.conclusion_green
    : diag === 'yellow' ? intel?.conclusion_yellow
    : intel?.conclusion_red;

  return (
    <div className="space-y-3">
      {/* ═══ INTERPRETATION LAYER ═══ */}
      <style jsx>{`
        @keyframes cb-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .cb-interp { background: linear-gradient(180deg,#0F1A26 0%,#0D1620 100%); border:1px solid #243C55; border-radius:14px; padding:24px 26px; position:relative; overflow:hidden; }
        .cb-interp::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#00EE9A,#00CFFF,#00EE9A,transparent); background-size:200%; animation:cb-shimmer 5s linear infinite; }
        .cb-interp h2 { font-size:20px; line-height:1.35; font-weight:800; color:#E8F2FF; margin:0 0 12px 0; letter-spacing:-0.01em; }
        .cb-interp .insight { font-size:13.5px; line-height:1.6; color:#A8C0D8; margin:0 0 18px 0; }
        .cb-interp .facts { display:flex; flex-direction:column; gap:8px; padding:14px 16px; background:rgba(0,238,154,0.03); border:1px solid rgba(0,238,154,0.10); border-radius:10px; margin-bottom:16px; }
        .cb-interp .fact { display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.5; color:#C8DCED; }
        .cb-interp .marker { color:#00EE9A; font-size:10px; line-height:1.6; flex-shrink:0; margin-top:2px; }
        .cb-interp .impact { border-top:1px solid #1A2E42; padding-top:14px; }
        .cb-interp .impact-label { display:block; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#3E6480; font-weight:700; margin-bottom:6px; }
        .cb-interp .impact p { font-size:13px; line-height:1.55; color:#E8F2FF; margin:0; font-weight:500; }
        .cb-skel { background:#0D1620; border:1px solid #1A2E42; border-radius:14px; padding:24px 26px; display:flex; flex-direction:column; gap:12px; }
        .cb-skel-line { height:14px; border-radius:6px; background:linear-gradient(90deg,#1A2E42 0%,#243C55 50%,#1A2E42 100%); background-size:200% 100%; animation:cb-shimmer 1.6s linear infinite; }
      `}</style>
      {!interpretationLoading && interpretation ? (
        <div className="cb-interp">
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
        <div className="cb-skel">
          <div className="cb-skel-line" style={{ width: '75%' }} />
          <div className="cb-skel-line" style={{ width: '100%' }} />
          <div className="cb-skel-line" style={{ width: '83%' }} />
        </div>
      ) : null}

      {/* ═══ C2 — VERDICT HERO ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #00F0A0, #00D4FF, #9D7FFF, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 5s linear infinite' }} />

        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            {/* Pill */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider ${dc.dim} border ${dc.border} ${dc.text}`}>
                <span className={`w-[7px] h-[7px] rounded-full ${dc.bg}`} style={diag === 'green' ? { animation: 'pulse 2s infinite' } : undefined} />
                {diagnosisPill(diag)} · Конкуренция
              </span>
              {hasRealGapData && (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${gapTypeColor(gapType)}`}>
                  {gapTypeLabel(gapType)}
                </span>
              )}
            </div>

            {/* Headline */}
            <h2 className="text-2xl font-extrabold leading-tight text-white mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>
              {intel?.verdict_phrase || data.key_metric || 'Конкуренция проанализирована'}
            </h2>
            {intel?.gap_interpretation && (
              <p className="text-[13px] text-[#7AAAC8] mb-2">{intel.gap_interpretation.slice(0, 120)}</p>
            )}

            {/* Bridge */}
            <p className="text-[11px] text-[#3E6480] italic mb-3">
              Блок 3 нашёл цены · Блок 4 проверяет: где конкурент не может ответить?
            </p>

            {/* Signals */}
            <div className="space-y-1.5">
              {signals.slice(0, 3).map((sig, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px]">
                  <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${dc.dim} ${dc.text}`}>
                    ✓
                  </span>
                  <span className="text-[#7AAAC8]">{sig}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Score box */}
          <div className="bg-[#111D2A] border border-[#1A2E42] rounded-xl px-5 py-4 text-center shrink-0 w-[160px]">
            <div className="text-[10px] text-[#3E6480] uppercase tracking-widest mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Score</div>
            <div className={`text-[54px] font-extrabold leading-none ${dc.text}`} style={{ fontFamily: 'Syne, sans-serif', animation: 'numIn 0.6s ease-out' }}>
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
        {/* Card A: Gap Type */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>{hasRealGapData ? 'Слабость конкурента' : 'Анализ конкурентов'}</SectionHeader>
          {hasRealGapData ? (
            <>
              <div className={`text-3xl font-extrabold mb-2 ${gapType === 'strategic' ? 'text-emerald-400' : 'text-amber-400'}`} style={{ fontFamily: 'Syne, sans-serif' }}>
                {gapType === 'strategic' ? 'Стратегическая' : 'Исполнения'}
              </div>
              <div className="space-y-1 text-[11px] text-[#7AAAC8]">
                <div>{bc.top_gap_category || '—'}</div>
                <div>{hasStrategicGap ? 'Конкурент не исправит: архитектурный долг' : 'Конкурент может исправить — окно ограничено'}</div>
                {hasStrategicGap && <div className="text-emerald-400">Окно входа: открыто сейчас</div>}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-extrabold text-[#7AAAC8] mb-2 leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                По позициям
              </div>
              <div className="text-[11px] text-[#7AAAC8] leading-snug">
                Реальных жалоб для разбора слабостей пока недостаточно. Смотри углы входа справа.
              </div>
            </>
          )}
        </div>

        {/* Card B: Competitors */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Конкуренты</SectionHeader>
          <div className="text-3xl font-extrabold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            {competitorCount}
          </div>
          <div className="space-y-1.5">
            {competitors.slice(0, 3).map((c: any, i: number) => {
              const size = c.size?.estimate || 'small';
              const w = sizeBarWidth(size);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-[#7AAAC8] w-[60px] truncate shrink-0">{c.name}</span>
                  <div className="flex-1 h-[4px] bg-[#1A2E42] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      backgroundColor: sizeBarColor(size),
                      width: `${w}%`,
                      animation: `barIn 0.6s ease-out ${0.3 + i * 0.15}s both`,
                    }} />
                  </div>
                  <span className="text-[9px] text-[#3E6480] w-[40px] text-right shrink-0">{size}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card C: Entry Point — показываем только если есть реальные gap данные */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>{hasRealGapData ? 'Точка входа' : 'Возможные углы входа'}</SectionHeader>
          {hasRealGapData ? (
            <p className="text-[13px] text-white font-semibold mb-2 line-clamp-2">
              {entryPoint.slice(0, 60) || 'Не определена'}
            </p>
          ) : (
            <p className="text-[11px] text-[#7AAAC8] mb-2 leading-snug">
              Анализ на основе позиционирования конкурентов.
            </p>
          )}
          {positioningVectors.length > 0 && (
            <div className="space-y-1">
              {positioningVectors.slice(0, 3).map((pv: string, i: number) => {
                const colors = ['text-emerald-400 bg-emerald-400/10 border-emerald-400/20', 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', 'text-purple-400 bg-purple-400/10 border-purple-400/20'];
                return (
                  <div key={i} className="flex items-center gap-1.5" style={{ animation: `vectorIn 0.4s ease-out ${0.5 + i * 0.15}s both`, opacity: 0 }}>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${colors[i] || colors[0]}`}>
                      {i + 1}
                    </span>
                    <span className="text-[10px] text-[#7AAAC8] truncate">{pv}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <FlowingConnector />

      {/* ═══ C4 — GAP ANALYSIS ═══ */}
      {gapBreakdown.length > 0 && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionHeader>Gap Analysis</SectionHeader>
              {gapBreakdown.map((g, i) => (
                <GapBar key={i} category={g.category} percent={g.percent} gapType={g.gapType} animationDelay={0.3 + i * 0.1} />
              ))}
            </div>
            <div>
              <SectionHeader>Легенда</SectionHeader>
              {intel?.gap_interpretation && (
                <p className="text-[11px] text-[#7AAAC8] mb-2">{intel.gap_interpretation}</p>
              )}
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[#7AAAC8]">{strategicGaps.length} strategic</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[#7AAAC8]">{executionGaps.length} execution</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <FlowingConnector />

      {/* ═══ C5 — COMPETITORS ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
        <SectionHeader>Конкуренты</SectionHeader>
        {competitors.length > 0 ? (
          <div className="space-y-3">
            {competitors.slice(0, 3).map((c: any, i: number) => {
              const size = c.size?.estimate || 'small';
              const complaints = c.top_complaints || [];
              const compGapType = complaints.length > 0 ? (hasStrategicGap ? 'strategic' : 'execution') : 'none';

              return (
                <div key={i} className="bg-[#111D2A] border border-[#1A2E42] rounded-lg p-3" style={{ animation: `fadeUp 0.4s ease-out ${i * 0.1}s both` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <CompetitorSizeCircle name={c.name} size={size as any} index={i} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-white">{c.name}</span>
                        <span className="text-[10px] text-[#3E6480] font-mono">{c.domain}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-[#3E6480]">{sizeHumanLabel(size)}</span>
                        {c.primary_segment && <span className="text-[9px] text-[#3E6480]">· {c.primary_segment}</span>}
                      </div>
                    </div>
                    {compGapType !== 'none' && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${gapTypeColor(compGapType)}`}>
                        {compGapType === 'strategic' ? 'СЛАБОСТЬ АРХ.' : 'СЛАБОСТЬ ИСП.'}
                      </span>
                    )}
                  </div>

                  {/* Complaint categories */}
                  {complaints.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {complaints.slice(0, 4).map((tc: any, j: number) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1A2E42] text-[#7AAAC8] border border-[#243A52]">
                          {tc.category} ({tc.count})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Top quote */}
                  {complaints[0]?.sample_quote && (
                    <p className="text-[11px] text-[#7AAAC8] italic border-l-2 border-[#243A52] pl-2">
                      &ldquo;{complaints[0].sample_quote.slice(0, 120)}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-[#3E6480] italic">Конкуренты не найдены</p>
        )}
      </div>

      <FlowingConnector />

      {/* ═══ C6 — ENTRY POINT CARD (только при реальных gap данных) ═══ */}
      {hasRealGapData && entryPointReasoning && (
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, transparent, #00D4FF, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 4s linear infinite' }} />

          <SectionHeader>Точка входа</SectionHeader>
          <p className="text-[12px] text-[#EAF2FF] leading-relaxed mb-3">{entryPointReasoning}</p>
        </div>
      )}

      {/* ═══ C7 — BOTTOM ROW ═══ */}
      <div className={intel ? 'grid grid-cols-2 gap-3' : ''}>
        {/* Conclusion */}
        <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
          <SectionHeader>Итог · Блок 4 — Конкуренция</SectionHeader>
          {conclusion && (
            <p className="text-[13px] text-[#EAF2FF] leading-relaxed mb-3">{conclusion}</p>
          )}
          {!conclusion && data.key_metric && (
            <p className="text-[13px] text-[#EAF2FF] leading-relaxed mb-3">{data.key_metric}</p>
          )}

          {/* Flow chain */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {hasRealGapData && (
              <span className={`text-[9px] px-2 py-0.5 rounded-full border ${gapTypeColor(gapType)}`}>
                {gapTypeLabel(gapType)}
              </span>
            )}
            {hasStrategicGap && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1A2E42] text-[#7AAAC8] border border-[#243A52]">
                архитектурный долг
              </span>
            )}
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1A2E42] text-[#7AAAC8] border border-[#243A52]">
              {competitorCount} конкурентов
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/20">
              → Блок 5 · Экономика
            </span>
          </div>

          {intel?.block5_connection && (
            <p className="text-[10px] text-[#3E6480] italic">→ {intel.block5_connection}</p>
          )}
        </div>

        {/* Intelligence Layer */}
        {intel && (
          <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-4">
            <SectionHeader>Intelligence Layer · Аналитический контекст</SectionHeader>
            {intel.gap_interpretation && (
              <p className="text-[12px] text-[#7AAAC8] leading-relaxed mb-2">{intel.gap_interpretation}</p>
            )}
            {intel.window_urgency && (
              <p className="text-[12px] text-[#7AAAC8] leading-relaxed mb-2">{intel.window_urgency}</p>
            )}
            {intel.block5_connection && (
              <p className="text-[11px] text-[#3E6480] italic">→ Блок 5: {intel.block5_connection}</p>
            )}
          </div>
        )}
      </div>

      {/* ═══ C8 — SOURCES ═══ */}
      <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl overflow-hidden">
        <button onClick={() => setSourcesOpen(!sourcesOpen)}
          className="w-full flex items-center justify-between p-3 text-left">
          <span className="text-[10px] text-[#3E6480] uppercase tracking-wider" style={{ fontFamily: 'Syne, sans-serif' }}>
            Источники · G2, Trustpilot, Capterra · {competitorCount} конкурента
          </span>
          <span className="text-[#3E6480] text-xs">{sourcesOpen ? '−' : '+'}</span>
        </button>
        {sourcesOpen && (
          <div className="px-3 pb-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-emerald-400 shrink-0" />
              G2 — {competitorCount * 10} результатов
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-cyan-400 shrink-0" />
              Trustpilot — {competitorCount * 5} результатов
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-amber-400 shrink-0" />
              Capterra — {competitorCount * 8} результатов
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7AAAC8]">
              <span className="w-[5px] h-[5px] rounded-full bg-purple-400 shrink-0" />
              Haiku + Sonnet — gap classification
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
