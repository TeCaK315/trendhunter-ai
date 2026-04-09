'use client';

import React, { useState, useMemo } from 'react';
import UpstreamConfidenceDots from './UpstreamConfidenceDots';
import SpotTypeLegend from './SpotTypeLegend';
import LockedSpotsCard from './LockedSpotsCard';

/* ─── TYPES ─── */

interface NormalizedSpot {
  index: number;
  type: string;
  title: string;
  insight: string;
  teaser: string;
  impact: string;   // HIGH | MEDIUM | LOW (or high | medium | low)
  score?: number;
  data_signals?: string[];
  confidence?: string;
  depends_on_blocks?: number[];
}

interface NormalizedData {
  diagnosis: string;       // GREEN | YELLOW | RED (or lower)
  score: number;
  key_metric: string;
  spots_count: number;
  spots: NormalizedSpot[];
  first_spot_teaser: string;
  remaining_locked: number;
  mode: string;            // 'normal' | 'unknown'
  blind_spots_impact: string;
  has_revenue_multiplier: boolean;
  upstream_confidence?: { b1: string; b2: string; b3: string; b4: string; b5: string };
  overall_confidence?: string;
  unknown_data?: {
    reason?: string;
    questions?: string[];
    bet_frame?: string;
    risk_frame?: string;
  };
}

/* ─── NORMALIZE ─── */
// Handles: old blind-spots endpoint, new blind-spots-v2, raw block_results, and tech-feasibility fallback
function normalizeData(raw: any): NormalizedData | null {
  if (!raw) return null;

  // V2 format: { success, public: { spots, mode, spots_count, diagnosis } }
  // The component may receive raw.public or just raw
  const src = raw?.public || raw;

  // If this is tech-feasibility data (has complexity/stack), return minimal data
  if (src?.complexity && !src?.spots && !src?.first_spot && !src?.diagnosis) {
    return {
      diagnosis: 'yellow',
      score: 5,
      key_metric: 'Анализ слепых пятен не запускался',
      spots_count: 0,
      spots: [],
      first_spot_teaser: '',
      remaining_locked: 0,
      mode: 'normal',
      blind_spots_impact: 'low',
      has_revenue_multiplier: false,
    };
  }

  // V2 format: spots array directly
  if (src?.spots && Array.isArray(src.spots)) {
    const spots: NormalizedSpot[] = src.spots.map((s: any, i: number) => ({
      index: i,
      type: s.type || 'unknown',
      title: s.title || `Пятно #${i + 1}`,
      insight: s.insight || '',
      teaser: s.teaser || '',
      impact: (s.impact || 'MEDIUM').toUpperCase(),
      score: s.score ?? undefined,
      data_signals: s.data_signals || [],
      confidence: s.confidence || undefined,
      depends_on_blocks: s.depends_on_blocks || [],
    }));

    const diag = (src.diagnosis || 'YELLOW').toUpperCase();
    const scoreMap: Record<string, number> = { GREEN: 8, YELLOW: 5, RED: 3 };

    return {
      diagnosis: diag,
      score: src.score ?? scoreMap[diag] ?? 5,
      key_metric: src.key_metric || `${spots.length} слепых пятен обнаружено`,
      spots_count: src.spots_count ?? spots.length,
      spots,
      first_spot_teaser: spots[0]?.teaser || '',
      remaining_locked: src.remaining_locked ?? 0,
      mode: src.mode || 'normal',
      blind_spots_impact: src.blind_spots_impact || (spots.some((s: NormalizedSpot) => s.impact === 'HIGH') ? 'HIGH' : 'MEDIUM'),
      has_revenue_multiplier: src.has_revenue_multiplier ?? false,
      upstream_confidence: extractUpstreamConfidence(raw),
      overall_confidence: extractOverallConfidence(raw),
      unknown_data: src.unknown_data || undefined,
    };
  }

  // Old format: { diagnosis, score, first_spot, remaining_locked, all_blind_spots? }
  const diagnosis = (src.diagnosis || 'yellow').toUpperCase();
  const scoreMap: Record<string, number> = { GREEN: 8, YELLOW: 5, RED: 3 };

  // Build spots from all_blind_spots or first_spot
  let spots: NormalizedSpot[] = [];
  if (src.all_blind_spots && Array.isArray(src.all_blind_spots)) {
    spots = src.all_blind_spots.map((s: any, i: number) => ({
      index: s.index ?? i,
      type: s.type || 'unknown',
      title: s.title || `Пятно #${i + 1}`,
      insight: s.insight || '',
      teaser: s.teaser || '',
      impact: (s.impact || 'medium').toUpperCase(),
      score: s.score ?? undefined,
      data_signals: s.data_signals || [],
      confidence: s.confidence || undefined,
      depends_on_blocks: s.depends_on_blocks || [],
    }));
  } else if (src.first_spot) {
    spots = [{
      index: 0,
      type: src.first_spot.type || 'unknown',
      title: src.first_spot.title || 'Слепое пятно',
      insight: src.first_spot.insight || '',
      teaser: src.first_spot_teaser || '',
      impact: (src.first_spot.impact || 'medium').toUpperCase(),
      data_signals: [],
      depends_on_blocks: [],
    }];
  }

  // Check raw_data.layers / raw_data.premium for more spots
  if (spots.length <= 1 && raw?.raw_data?.layers?.all_blind_spots) {
    const allSpots = raw.raw_data.layers.all_blind_spots;
    if (Array.isArray(allSpots) && allSpots.length > spots.length) {
      spots = allSpots.map((s: any, i: number) => ({
        index: s.index ?? i,
        type: s.type || 'unknown',
        title: s.title || `Пятно #${i + 1}`,
        insight: s.insight || '',
        teaser: s.teaser || '',
        impact: (s.impact || 'medium').toUpperCase(),
        data_signals: s.data_signals || [],
        confidence: s.confidence || undefined,
        depends_on_blocks: s.depends_on_blocks || [],
      }));
    }
  }

  return {
    diagnosis,
    score: src.score ?? scoreMap[diagnosis] ?? 5,
    key_metric: src.key_metric || `${spots.length} слепых пятен обнаружено`,
    spots_count: src.blind_spots_count ?? spots.length,
    spots,
    first_spot_teaser: src.first_spot_teaser || spots[0]?.teaser || '',
    remaining_locked: src.remaining_locked ?? Math.max(0, spots.length - 1),
    mode: 'normal',
    blind_spots_impact: src.blind_spots_impact || (spots.some((s: NormalizedSpot) => s.impact === 'HIGH') ? 'HIGH' : 'MEDIUM'),
    has_revenue_multiplier: src.has_revenue_multiplier ?? false,
    upstream_confidence: extractUpstreamConfidence(raw),
    overall_confidence: extractOverallConfidence(raw),
  };
}

function extractUpstreamConfidence(raw: any): { b1: string; b2: string; b3: string; b4: string; b5: string } | undefined {
  const dq = raw?.block_context?.data_quality?.upstream_confidence
    || raw?.public?.block_context?.data_quality?.upstream_confidence;
  if (!dq) return undefined;
  return {
    b1: dq[1] || dq['1'] || 'unknown',
    b2: dq[2] || dq['2'] || 'unknown',
    b3: dq[3] || dq['3'] || 'unknown',
    b4: dq[4] || dq['4'] || 'unknown',
    b5: dq[5] || dq['5'] || 'unknown',
  };
}

function extractOverallConfidence(raw: any): string | undefined {
  return raw?.block_context?.data_quality?.overall_confidence
    || raw?.public?.block_context?.data_quality?.overall_confidence
    || undefined;
}

/* ─── CONSTANTS ─── */

const DIAGNOSIS_COLORS: Record<string, { accent: string; bg: string; border: string; label: string }> = {
  GREEN: { accent: '#00F0A0', bg: 'rgba(0,240,160,0.12)', border: 'rgba(0,240,160,0.3)', label: 'Чисто' },
  YELLOW: { accent: '#FFB340', bg: 'rgba(255,179,64,0.12)', border: 'rgba(255,179,64,0.3)', label: 'Найдено слепое пятно' },
  RED: { accent: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', label: 'Критические пятна' },
};

const TYPE_LABELS: Record<string, string> = {
  unserved_segment: 'Неохваченный сегмент',
  pricing_gap: 'Ценовой разрыв',
  tech_shift: 'Технологический сдвиг',
  intent_mismatch: 'Несовпадение намерений',
  lockin_opportunity: 'Возможность удержания',
  CONTRADICTION: 'Противоречие',
  STRUCTURAL: 'Структурная аномалия',
  BEHAVIORAL: 'Поведенческая аномалия',
  TIMING: 'Тайминг',
  UNKNOWN: 'Неизвестно',
};

/* ─── PROPS ─── */

interface Props {
  data: any;
  loading?: boolean;
  error?: string;
}

/* ─── COMPONENT ─── */

export default function BlindSpotsBlock({ data, loading, error }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const normalized = useMemo(() => normalizeData(data), [data]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-4 p-4" style={{ animation: 'fadeUp 0.4s ease both' }}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 rounded w-1/2" style={{ background: '#1A2E42' }} />
          <div className="h-32 rounded-2xl" style={{ background: '#0C1520' }} />
          <div className="h-24 rounded-2xl" style={{ background: '#0C1520' }} />
          <div className="h-16 rounded-2xl" style={{ background: '#0C1520' }} />
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="p-4 text-sm" style={{ color: '#EF4444' }}>
        {error}
      </div>
    );
  }

  // ── No data ──
  if (!normalized) {
    return (
      <div className="p-4 text-sm" style={{ color: '#4A6080' }}>
        Нажмите &quot;Анализировать&quot; для запуска
      </div>
    );
  }

  const d = normalized;
  const diag = DIAGNOSIS_COLORS[d.diagnosis] || DIAGNOSIS_COLORS.YELLOW;
  const scorePercent = Math.round((d.score / 10) * 100);
  const freeSpot = d.spots[0] || null;
  const unlockedSpots = d.spots.slice(1);
  const detectedTypes = d.spots.map((s) => s.type);

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>

      {/* ── 1. HEADER ── */}
      <header
        className="flex justify-between items-center sticky top-0 z-50"
        style={{
          padding: '14px 28px',
          borderBottom: '1px solid #111C28',
          background: 'rgba(8,12,16,0.97)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: '#4A6080' }}>
          <span style={{ fontSize: '13px' }}>{'\u2302'}</span>
          <span style={{ color: '#1E3044' }}>/</span>
          <span style={{ color: '#E2EBF4', opacity: 0.7 }}>Исследование</span>
          <span style={{ color: '#1E3044' }}>/</span>
          <span style={{ color: '#00D4FF' }}>Блок 6 {'\u00B7'} Слепые пятна</span>
        </div>
        <div className="flex items-center gap-[7px] font-mono text-[11px]" style={{ color: '#4A6080' }}>
          <div
            className="w-[7px] h-[7px] rounded-full"
            style={{
              background: '#00F0A0',
              animation: 'flowPulse 2s ease-in-out infinite',
            }}
          />
          {d.spots_count} {d.spots_count === 1 ? 'инсайт найден' : 'инсайтов найдено'} {'\u00B7'} Блоки 1-5 {'\u00B7'} Production
        </div>
      </header>

      {/* ── 2. VERDICT HERO ── */}
      <div
        className="mx-5 mt-5 rounded-2xl relative overflow-hidden"
        style={{
          background: '#0C1520',
          border: '1px solid #1E3044',
          borderTop: `3px solid ${diag.accent}`,
          padding: '24px 28px',
          display: 'grid',
          gridTemplateColumns: '1fr 180px',
          gap: '24px',
          animation: 'fadeUp 0.3s ease both',
        }}
      >
        {/* Gradient overlay */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: '60px',
            background: `linear-gradient(180deg, ${diag.accent}08 0%, transparent 100%)`,
          }}
        />

        {/* Left side */}
        <div className="relative z-10">
          {/* Diagnosis pill */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full font-mono text-[11px] font-semibold mb-3"
            style={{
              background: diag.bg,
              border: `1px solid ${diag.border}`,
              color: diag.accent,
              padding: '4px 12px',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: diag.accent,
                animation: 'flowPulse 2s infinite',
              }}
            />
            {d.diagnosis} {'\u00B7'} {diag.label}
          </div>

          {/* Headline */}
          <h1
            className="font-bold mb-2.5"
            style={{
              fontSize: '28px',
              fontWeight: 800,
              lineHeight: 1.2,
              color: '#E2EBF4',
              letterSpacing: '-0.5px',
            }}
          >
            {freeSpot
              ? freeSpot.title
              : d.mode === 'unknown'
                ? 'Данные не дают устойчивых паттернов'
                : 'Слепых пятен не обнаружено'}
          </h1>

          {/* Subtitle */}
          <p className="text-[13px] mb-1.5" style={{ color: '#4A6080', lineHeight: 1.5 }}>
            {freeSpot
              ? `${TYPE_LABELS[freeSpot.type] || freeSpot.type} обнаружена.`
              : d.key_metric}
          </p>

          {/* Bridge */}
          <p
            className="italic text-xs mb-4"
            style={{
              color: '#2A3A50',
              paddingLeft: '10px',
              borderLeft: '2px solid #1E3044',
            }}
          >
            Блоки 1-5 собрали данные {'\u00B7'} Блок 6 находит что никто не заметил
          </p>

          {/* Signals */}
          <div className="flex flex-col gap-2">
            <Signal
              icon="\u25C8"
              iconClass="amber"
              text={<><strong>{d.spots_count} {d.spots_count === 1 ? 'слепое пятно обнаружено' : 'слепых пятен обнаружено'}</strong> {'\u00B7'} {detectedTypes[0] || 'N/A'}</>}
            />
            {freeSpot && (
              <Signal
                icon="\u25C8"
                iconClass="amber"
                text={<><strong>Impact {freeSpot.impact}</strong> {'\u00B7'} {TYPE_LABELS[freeSpot.type] || freeSpot.type}</>}
              />
            )}
            {d.spots_count === 0 && (
              <Signal
                icon="\u25CB"
                iconClass="muted"
                text={<span>Явных слепых пятен не обнаружено</span>}
              />
            )}
            {d.upstream_confidence && (
              <Signal
                icon="\u2713"
                iconClass="green"
                text={
                  <>
                    <strong style={{ color: '#00F0A0' }}>upstream confidence: {(d.overall_confidence || 'MEDIUM').toUpperCase()}</strong>
                    {' '}
                    <span style={{ color: '#4A6080' }}>из всех 5 блоков</span>
                  </>
                }
              />
            )}
          </div>
        </div>

        {/* Right side - Score box */}
        <div
          className="rounded-xl flex flex-col items-center gap-2.5 relative z-10"
          style={{
            background: '#060A0E',
            border: '1px solid #1E3044',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[2px]" style={{ color: '#4A6080' }}>
            SCORE
          </div>
          <div className="font-mono font-bold leading-none" style={{ fontSize: '52px', color: diag.accent }}>
            {d.score.toFixed(1)}
            <sup className="text-lg" style={{ color: '#4A6080' }}>/10</sup>
          </div>
          <div className="w-full">
            <div className="h-[5px] rounded overflow-hidden mb-1.5" style={{ background: '#111C28' }}>
              <div
                className="h-full rounded"
                style={{
                  background: diag.accent,
                  width: `${scorePercent}%`,
                  animation: 'barGrow 1s ease 0.5s both',
                }}
              />
            </div>
            <div className="font-mono text-[10px] text-right" style={{ color: '#4A6080' }}>
              {scorePercent}%
            </div>
          </div>
          <div className="font-mono text-[10px]" style={{ color: '#4A6080' }}>
            {d.diagnosis} {'\u00B7'} {d.spots_count} {d.spots_count === 1 ? 'пятно' : 'пятен'}
          </div>
        </div>
      </div>

      {/* Connector */}
      <Connector />

      {/* ── 3. SPOT CARDS ── */}
      {d.spots.length > 0 && (
        <div className="mx-5">
          <div
            className="font-mono text-xs uppercase tracking-[1px] mb-3"
            style={{ color: '#4A6080' }}
          >
            Слепые пятна {'\u00B7'} что не видят конкуренты
          </div>

          {/* Free spot (first) */}
          {freeSpot && (
            <SpotCard
              spot={freeSpot}
              isFree
              upstreamConfidence={d.upstream_confidence}
              overallConfidence={d.overall_confidence || 'medium'}
            />
          )}

          {/* Additional unlocked spots */}
          {unlockedSpots.map((spot) => (
            <div key={spot.index} className="mt-4">
              <SpotCard
                spot={spot}
                isFree={false}
                upstreamConfidence={d.upstream_confidence}
                overallConfidence={d.overall_confidence || 'medium'}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Unknown mode ── */}
      {d.mode === 'unknown' && d.unknown_data && (
        <div className="mx-5 mt-4">
          <div
            className="rounded-2xl p-6"
            style={{
              background: '#0C1520',
              border: '1px solid #1E3044',
              borderLeft: '4px solid #FFB340',
            }}
          >
            <div className="text-[15px] font-bold mb-3" style={{ color: '#E2EBF4' }}>
              {d.unknown_data.reason || 'Данные не дают устойчивых паттернов'}
            </div>
            {d.unknown_data.questions && d.unknown_data.questions.length > 0 && (
              <div className="space-y-2 mb-4">
                {d.unknown_data.questions.map((q: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[13px]" style={{ color: '#4A6080' }}>
                    <span style={{ color: '#FFB340' }}>?</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            )}
            {d.unknown_data.bet_frame && (
              <div className="text-xs italic" style={{ color: '#2A3A50', borderLeft: '2px solid #1E3044', paddingLeft: '10px' }}>
                {d.unknown_data.bet_frame}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connector */}
      <Connector />

      {/* ── 4. LOCKED SECTION ── */}
      {d.remaining_locked > 0 && (
        <div className="mx-5">
          <div
            className="font-mono text-xs uppercase tracking-[1px] mb-3"
            style={{ color: '#4A6080' }}
          >
            Ещё {d.remaining_locked} скрытых {d.remaining_locked === 1 ? 'пятно' : 'пятен'}
          </div>
          <LockedSpotsCard
            remainingLocked={d.remaining_locked}
            teaser={d.first_spot_teaser}
            trendId=""
          />
        </div>
      )}

      {/* Connector */}
      <Connector />

      {/* ── 5. TYPE LEGEND ── */}
      <div className="mx-5">
        <div
          className="font-mono text-xs uppercase tracking-[1px] mb-3"
          style={{ color: '#4A6080' }}
        >
          Типы слепых пятен {'\u00B7'} что мы ищем
        </div>
        <SpotTypeLegend detectedTypes={detectedTypes} />
      </div>

      {/* Connector */}
      <Connector />

      {/* ── 6. BOTTOM ROW ── */}
      <div className="mx-5 grid grid-cols-2 gap-4">
        {/* Conclusion */}
        <div
          className="rounded-2xl p-6"
          style={{ background: '#060A0E', border: '1px solid #1E3044' }}
        >
          <div
            className="inline-flex items-center gap-1.5 rounded-md font-mono text-[11px] font-bold mb-3"
            style={{
              background: diag.bg,
              border: `1px solid ${diag.border}`,
              color: diag.accent,
              padding: '3px 10px',
            }}
          >
            {d.diagnosis}
          </div>
          <div className="text-[15px] font-bold mb-2.5" style={{ color: '#E2EBF4' }}>
            Итог {'\u00B7'} Блок 6 — Слепые пятна
          </div>
          <p className="text-[13px] mb-4" style={{ color: '#8AADC8', lineHeight: 1.7 }}>
            {d.spots_count > 0
              ? `${d.spots_count} слепых ${d.spots_count === 1 ? 'пятно' : 'пятен'}. ${freeSpot ? `${TYPE_LABELS[freeSpot.type] || freeSpot.type} — ${freeSpot.impact} impact.` : ''}`
              : 'Явных слепых пятен не обнаружено. Рынок выглядит стабильно.'}
          </p>

          {/* Flow pills */}
          {freeSpot && (
            <div className="flex flex-wrap gap-1.5 items-center mb-3.5">
              <FlowPill color="amber">{TYPE_LABELS[freeSpot.type] || freeSpot.type}</FlowPill>
              <span className="text-xs" style={{ color: '#2A3A50' }}>{'\u2192'}</span>
              <FlowPill color="amber">{freeSpot.impact} impact</FlowPill>
              <span className="text-xs" style={{ color: '#2A3A50' }}>{'\u2192'}</span>
              <FlowPill color="cyan">AI Синтез</FlowPill>
            </div>
          )}

          {/* Instructions */}
          <div className="flex flex-col gap-1.5">
            <InstrLine>
              {'\u2192'} В Синтезе: <strong style={{ color: '#00F0A0' }}>blind_spots_impact {d.blind_spots_impact}</strong>
            </InstrLine>
            {d.has_revenue_multiplier && (
              <InstrLine>
                {'\u2192'} В Синтезе: <strong style={{ color: '#00F0A0' }}>has_revenue_multiplier</strong> — уверенность растёт
              </InstrLine>
            )}
          </div>
        </div>

        {/* Monetization */}
        <div
          className="rounded-2xl p-6"
          style={{ background: '#0C1520', border: '1px dashed #1E3044' }}
        >
          <div className="font-mono text-xs font-bold tracking-[0.5px] mb-4 flex items-center gap-2" style={{ color: '#E2EBF4' }}>
            {'\uD83D\uDD13'} КАК ПОЛУЧИТЬ ВСЕ ПЯТНА
          </div>
          <div className="flex items-center gap-2 mb-2 text-[13px]">
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: '#00F0A0' }} />
            <span>Пятно #1 — <span style={{ color: '#4A6080' }}>бесплатно (уже открыто)</span></span>
          </div>
          <div className="flex items-center gap-2 mb-2 text-[13px]" style={{ color: '#4A6080' }}>
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: '#FFB340' }} />
            <span>Пятна #2-5 — по 1 в день ИЛИ</span>
          </div>
          <div
            className="font-mono font-bold text-center my-4"
            style={{
              fontSize: '36px',
              color: '#00F0A0',
              animation: 'borderGlow 2.5s ease-in-out infinite',
            }}
          >
            5 токенов
          </div>
          <div className="text-center text-xs mb-3" style={{ color: '#4A6080' }}>
            за все сразу {'\u00B7'} доступно немедленно
          </div>
          <div className="font-mono text-center" style={{ fontSize: '10px', color: '#2A3A50', lineHeight: 1.6 }}>
            Токены не возвращаются {'\u00B7'} UNIQUE(trend_id, user_id)
          </div>
        </div>
      </div>

      {/* ── 7. SOURCES BAR ── */}
      <div
        className="mx-5 mt-5 rounded-[10px] font-mono text-[11px] flex items-center gap-2 cursor-pointer"
        style={{
          padding: '12px 20px',
          border: '1px solid #111C28',
          color: '#4A6080',
        }}
        onClick={() => setSourcesOpen(!sourcesOpen)}
      >
        <span style={{ color: '#2A3A50' }}>{sourcesOpen ? '\u2191' : '\u2193'}</span>
        Источники {'\u00B7'} Блоки 1-5 данные {'\u00B7'} Sonnet формулировка {'\u00B7'} детерминированная детекция
      </div>
      {sourcesOpen && (
        <div
          className="mx-5 mt-2 rounded-[10px] p-4 font-mono text-[11px]"
          style={{
            border: '1px solid #111C28',
            color: '#2A3A50',
            animation: 'fadeUp 0.2s ease both',
          }}
        >
          <div className="mb-1">Блок 1: Проблема (paying_ratio, pain_clusters)</div>
          <div className="mb-1">Блок 2: Спрос (demand_index, commercial_intent, rising_queries)</div>
          <div className="mb-1">Блок 3: Продажи (price_range, billing_model)</div>
          <div className="mb-1">Блок 4: Конкуренция (gap_map, switching_cost, top_competitor)</div>
          <div className="mb-1">Блок 5: Экономика (revenue, cac, payback)</div>
          <div>Детекция: детерминированная {'\u00B7'} Формулировка: Claude Sonnet {'\u00B7'} Валидация: Claude Haiku</div>
        </div>
      )}
    </div>
  );
}

/* ─── SUB-COMPONENTS ─── */

function Connector() {
  return (
    <svg
      className="block w-full"
      style={{ height: '32px', margin: 0 }}
      viewBox="0 0 900 32"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line
        x1="80" y1="16" x2="820" y2="16"
        stroke="#2A3A50"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        style={{ animation: 'flowDash 1.2s linear infinite' }}
      />
      <polygon points="820,11 832,16 820,21" fill="#2A3A50" />
    </svg>
  );
}

function Signal({ icon, iconClass, text }: { icon: string; iconClass: 'amber' | 'muted' | 'green'; text: React.ReactNode }) {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    amber: { bg: 'rgba(255,179,64,0.15)', color: '#FFB340', border: 'rgba(255,179,64,0.3)' },
    muted: { bg: 'rgba(74,96,128,0.15)', color: '#4A6080', border: '#111C28' },
    green: { bg: 'rgba(0,240,160,0.12)', color: '#00F0A0', border: 'rgba(0,240,160,0.25)' },
  };
  const s = styles[iconClass];

  return (
    <div className="flex items-start gap-2 text-[12.5px]" style={{ lineHeight: 1.4 }}>
      <div
        className="flex-shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] mt-0.5"
        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      >
        {icon}
      </div>
      <div style={{ color: '#4A6080' }}>{text}</div>
    </div>
  );
}

function SpotCard({
  spot,
  isFree,
  upstreamConfidence,
  overallConfidence,
}: {
  spot: NormalizedSpot;
  isFree: boolean;
  upstreamConfidence?: { b1: string; b2: string; b3: string; b4: string; b5: string };
  overallConfidence: string;
}) {
  const borderColor = spot.impact === 'HIGH' ? '#00F0A0' : spot.impact === 'LOW' ? '#4A6080' : '#FFB340';

  return (
    <div
      className="rounded-2xl"
      style={{
        background: '#0C1520',
        border: '1px solid #1E3044',
        borderLeft: `4px solid ${borderColor}`,
        padding: '24px',
        animation: 'fadeUp 0.4s ease 0.1s both',
      }}
    >
      {/* Header pills */}
      <div className="flex items-center gap-2 mb-3.5 flex-wrap">
        <Pill color="cyan">{spot.type}</Pill>
        {isFree && <Pill color="green">БЕСПЛАТНО</Pill>}
        <Pill color="green">{spot.impact} impact</Pill>
        <span className="ml-auto font-mono text-xs" style={{ color: '#4A6080' }}>
          Пятно #{spot.index + 1}
        </span>
      </div>

      {/* Title */}
      <div
        className="font-bold mb-1"
        style={{ fontSize: '22px', fontWeight: 800, color: '#E2EBF4', letterSpacing: '-0.3px' }}
      >
        {spot.title}
      </div>

      {/* Type line */}
      <div className="font-mono text-[11px] mb-3.5" style={{ color: '#4A6080' }}>
        <span style={{ color: '#00D4FF' }}>{spot.type}</span>
        <em style={{ color: '#00F0A0', fontStyle: 'normal', marginLeft: '6px' }}>
          {'\u00B7'} {spot.impact} impact
        </em>
      </div>

      {/* Insight text */}
      <p className="text-sm mb-5" style={{ lineHeight: 1.7, color: '#A8BDD0' }}>
        {spot.insight}
      </p>

      {/* Data signals */}
      {spot.data_signals && spot.data_signals.length > 0 && (
        <div className="mb-5">
          <ul className="space-y-1">
            {spot.data_signals.map((signal, j) => (
              <li key={j} className="text-xs flex items-start gap-1.5" style={{ color: '#4A6080' }}>
                <span style={{ color: '#2A3A50', marginTop: '2px' }}>{'\u2022'}</span>
                {signal}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Divider */}
      <div className="h-px mb-4" style={{ background: '#111C28' }} />

      {/* Upstream confidence */}
      <UpstreamConfidenceDots
        confidence={upstreamConfidence}
        dependsOn={spot.depends_on_blocks || [1, 2, 3, 4, 5]}
        overallConfidence={overallConfidence}
      />

      {/* Depends on */}
      {spot.depends_on_blocks && spot.depends_on_blocks.length > 0 && (
        <div className="flex items-center gap-2 mt-2.5 font-mono text-[11px]">
          <span style={{ color: '#2A3A50' }}>depends_on</span>
          <span style={{ color: '#4A6080' }}>
            Данные: {spot.depends_on_blocks.map((b) => `Block ${b}`).join(' + ')}
          </span>
        </div>
      )}
    </div>
  );
}

function Pill({ color, children }: { color: 'cyan' | 'green' | 'amber' | 'muted'; children: React.ReactNode }) {
  const styles: Record<string, { bg: string; border: string; textColor: string }> = {
    cyan: { bg: 'rgba(0,212,255,0.1)', border: 'rgba(0,212,255,0.3)', textColor: '#00D4FF' },
    green: { bg: 'rgba(0,240,160,0.1)', border: 'rgba(0,240,160,0.3)', textColor: '#00F0A0' },
    amber: { bg: 'rgba(255,179,64,0.1)', border: 'rgba(255,179,64,0.3)', textColor: '#FFB340' },
    muted: { bg: 'rgba(74,96,128,0.08)', border: '#111C28', textColor: '#4A6080' },
  };
  const s = styles[color];

  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full font-mono text-[11px] font-semibold"
      style={{ padding: '3px 10px', background: s.bg, border: `1px solid ${s.border}`, color: s.textColor }}
    >
      {children}
    </span>
  );
}

function FlowPill({ color, children }: { color: 'amber' | 'cyan'; children: React.ReactNode }) {
  const styles: Record<string, { bg: string; border: string; textColor: string }> = {
    amber: { bg: 'rgba(255,179,64,0.1)', border: 'rgba(255,179,64,0.3)', textColor: '#FFB340' },
    cyan: { bg: 'rgba(0,212,255,0.1)', border: 'rgba(0,212,255,0.3)', textColor: '#00D4FF' },
  };
  const s = styles[color];

  return (
    <span
      className="inline-flex items-center rounded-full font-mono font-semibold"
      style={{ fontSize: '11px', padding: '3px 10px', background: s.bg, border: `1px solid ${s.border}`, color: s.textColor }}
    >
      {children}
    </span>
  );
}

function InstrLine({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono rounded-[5px]"
      style={{
        fontSize: '11px',
        color: '#4A6080',
        padding: '5px 8px',
        background: '#111C28',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
