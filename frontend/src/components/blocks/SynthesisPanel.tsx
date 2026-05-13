'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import RadarChart from './RadarChart';
import type { BlockInterpretation } from '@/types/analysis';

// 7.1 — описание уверенности словами вместо процента
function confidenceLabel(confidence: number, ru: boolean): string {
  if (ru) {
    if (confidence >= 0.75) return 'на основе надёжных данных';
    if (confidence >= 0.55) return 'на основе частичных данных';
    if (confidence >= 0.40) return 'на основе ограниченных данных';
    return 'предварительная оценка';
  }
  if (confidence >= 0.75) return 'based on reliable data';
  if (confidence >= 0.55) return 'based on partial data';
  if (confidence >= 0.40) return 'based on limited data';
  return 'preliminary estimate';
}

// 7.3 — очистка priority actions от технических утечек
function cleanActionText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/\(индекс \d+\)/gi, '')
    .replace(/индекс \d+/gi, '')
    .replace(/\(confidence[^)]*\)/gi, '')
    .replace(/\(revenue_confidence[^)]*\)/gi, '')
    .replace(/\(данных недостаточно\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// FIX 1 — gap_driver source: технический код → человеческое название
function gapDriverSourceLabel(source: string): string {
  switch (source) {
    case 'block1':            return 'Проблема';
    case 'block1_fallback':   return 'Проблема';
    case 'block2':            return 'Спрос';
    case 'block3':            return 'Монетизация';
    case 'block4':            return 'Конкуренция';
    case 'block4_fallback':   return 'Конкуренция';
    case 'block4_generic':    return '';
    case 'block4_switching':  return 'Конкуренция';
    case 'block5':            return 'Экономика';
    case 'block6':            return 'Слепые пятна';
    case 'generic':           return '';
    default:                  return '';
  }
}

// 7.2 — fallback bridge text если приходит пустой
function buildBridgeFallback(verdictType: string | undefined): string {
  if (verdictType === 'go_if') {
    return 'Данные указывают на реальную возможность. Вопрос не в том входить ли — а в том как войти чтобы не потерять преимущество.';
  }
  if (verdictType === 'no_go_until') {
    return 'Данные показывают путь — но не стандартный. Прямой вход не работает, нестандартный может.';
  }
  return 'Данные указывают на разрыв между типичным входом в эту нишу и тем что возможно при правильном использовании выявленных точек.';
}

// ─── TYPES ─────────────────────────────────────────────────

interface SynthesisStep {
  step: string;
  message: string;
}

interface Conflict {
  weight: number;
  type: string;
  pair: string;
  mechanism: string;
  blocks_involved: number[];
}

interface SkepticPoint {
  conflict_pair: string;
  mechanism: string;
  severity: string;
}

interface SkepticBlindSpot {
  category: string;
  risk: string;
  timeline: string;
}

interface OptimistNeutralization {
  addresses_conflict: string;
  condition: string;
  type: string;
}

interface ArbitratorOutput {
  verdict_type: 'go_if' | 'no_go_until' | 'experiment_if';
  confidence: number;
  confidence_factors?: string[];
  verdict_condition: string;
  verdict_reasoning: string;
  priority_actions: Array<{ order: number; action: string; timeline: string; addresses: string }>;
  bridge_text?: string;
  conditions?: string[];
  reasoning?: string;
}

interface StrategicDelta {
  show: boolean;
  standard_path: {
    revenue_annual: number;
    months_to_revenue: number;
    success_probability: number;
    main_trap: string;
  };
  strategic_path: {
    revenue_annual: number;
    months_to_revenue: number;
    success_probability: number;
    is_locked: true;
  };
  delta_revenue: number;
  delta_months: number;
  delta_probability: number;
  gap_drivers: Array<{ title: string; source: string; note?: string }>;
  verdict_frame: string;
  uplift_multiplier: number;
  cta_text: string;
}

interface SynthesisResult {
  conflicts: Conflict[];
  skeptic: { points?: SkepticPoint[]; blind_spots?: SkepticBlindSpot[] };
  optimist: { neutralizations: OptimistNeutralization[] };
  arbitrator: ArbitratorOutput;
}

interface RadarBlock {
  block_number: number;
  name: string;
  score: number;
  diagnosis: string;
  key_metric?: string;
  key_factors?: string[];
}

// ─── PROPS (same as before — compatible with page.tsx) ──────

interface Props {
  trendId: string;
  niche: string;
  coinBalance: number | null;
  onBalanceUpdate: (newBalance: number) => void;
  language: 'ru' | 'en';
  trendTitle?: string;
  onNavigateToStrategy?: () => void;
  blocks?: RadarBlock[];
  evidenceData?: Record<string, any>;
}

// ─── CONSTANTS ─────────────────────────────────────────────

const SYNTHESIS_COST = 20;

const BLOCK_NAMES: Record<number, string> = {
  1: 'Проблема',
  2: 'Спрос',
  3: 'Продажи',
  4: 'Конкуренция',
  5: 'Экономика',
  6: 'Слепые пятна',
};

const VERDICT_CONFIG: Record<string, {
  label: string;
  labelEn: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  emoji: string;
}> = {
  go_if: {
    label: 'GO IF',
    labelEn: 'GO IF',
    color: '#00F0A0',
    bgGradient: 'linear-gradient(135deg, rgba(0,240,160,0.08), rgba(0,212,255,0.04))',
    borderColor: '#00F0A0',
    emoji: '\\u2705',
  },
  experiment_if: {
    label: 'EXPERIMENT IF',
    labelEn: 'EXPERIMENT IF',
    color: '#FFB340',
    bgGradient: 'linear-gradient(135deg, rgba(255,179,64,0.08), rgba(255,179,64,0.04))',
    borderColor: '#FFB340',
    emoji: '\\u26A0',
  },
  no_go_until: {
    label: 'NO GO UNTIL',
    labelEn: 'NO GO UNTIL',
    color: '#FF4E5B',
    bgGradient: 'linear-gradient(135deg, rgba(255,78,91,0.08), rgba(255,78,91,0.04))',
    borderColor: '#FF4E5B',
    emoji: '\\u274C',
  },
};

// ─── HELPERS ───────────────────────────────────────────────

function formatMoney(n: number): string {
  if (!n || isNaN(n)) return '\u2014';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function getVerdictConfig(type: string) {
  return VERDICT_CONFIG[type] || VERDICT_CONFIG.experiment_if;
}

// ─── TYPEWRITER HOOK ──────────────────────────────────────

function useTypewriter(text: string, speed = 18, enabled = true) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayed(text || '');
      setDone(true);
      return;
    }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, enabled]);

  return { displayed, done };
}

// ─── COMPONENT ─────────────────────────────────────────────

export default function SynthesisPanel({
  trendId,
  niche,
  coinBalance,
  onBalanceUpdate,
  language,
  trendTitle,
  onNavigateToStrategy,
  blocks: externalBlocks,
  evidenceData,
}: Props) {
  // ─── STATE ─────────────────────────────────────────────
  const [status, setStatus] = useState<SynthesisStep | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingCached, setLoadingCached] = useState(true);
  const [staleInfo, setStaleInfo] = useState<{ is_stale: boolean; stale_blocks: number[] }>({ is_stale: false, stale_blocks: [] });
  const [strategicDelta, setStrategicDelta] = useState<StrategicDelta | null>(null);
  const [salesText, setSalesText] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<RadarBlock | null>(null);
  const [radarBlocks, setRadarBlocks] = useState<RadarBlock[]>([]);
  const [typewriterEnabled, setTypewriterEnabled] = useState(false);
  const [showFactors, setShowFactors] = useState(false);
  const [interpretation, setInterpretation] = useState<BlockInterpretation | null>(null);
  const [interpretationLoading, setInterpretationLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const ru = language === 'ru';

  // 7.5 — загружаем interpretation summary
  // Зависит от наличия result, потому что роут пишет интерпретацию ПОСЛЕ upsert synthesis_results
  useEffect(() => {
    if (!trendId || !result) return;
    let cancelled = false;
    setInterpretationLoading(true);

    const tryLoad = (delay: number) => {
      setTimeout(() => {
        if (cancelled) return;
        fetch(`/api/interpretations/synthesis?trend_id=${encodeURIComponent(trendId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => { if (!cancelled) setInterpretation(json); })
          .catch(() => { if (!cancelled) setInterpretation(null); })
          .finally(() => { if (!cancelled) setInterpretationLoading(false); });
      }, delay);
    };

    // Сразу проверяем кэш — если синтез уже был, интерпретация тоже есть.
    // Если только что закончился — даём фоновой генерации фору.
    tryLoad(0);
    return () => { cancelled = true; };
  }, [trendId, result]);

  // ─── LOAD CACHED RESULTS ──────────────────────────────
  useEffect(() => {
    if (!trendId) {
      setLoadingCached(false);
      return;
    }

    async function loadCachedSynthesis() {
      try {
        const res = await fetch(`/api/synthesis/cached?trend_id=${encodeURIComponent(trendId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.result) {
            setResult(data.result);
            setTypewriterEnabled(false); // cached = no typewriter
            if (data.is_stale) {
              setStaleInfo({ is_stale: true, stale_blocks: data.stale_blocks || [] });
            }
            if (data.result.strategic_delta) {
              setStrategicDelta(data.result.strategic_delta);
            }
            if (data.result.sales_text) {
              setSalesText(data.result.sales_text);
            }
          }
        }
      } catch {
        // No cached data
      } finally {
        setLoadingCached(false);
      }
    }

    loadCachedSynthesis();
  }, [trendId]);

  // ─── LOAD BLOCK DATA FOR RADAR ────────────────────────
  useEffect(() => {
    if (externalBlocks && externalBlocks.length > 0) {
      setRadarBlocks(externalBlocks);
      return;
    }

    // Build blocks from evidenceData if available
    if (evidenceData) {
      const blockKeys = ['problem', 'demand', 'sellability', 'occupation', 'economics', 'tech'] as const;
      const blockNums = [1, 2, 3, 4, 5, 6];
      const built: RadarBlock[] = [];
      blockKeys.forEach((key, i) => {
        const d = evidenceData[key];
        if (d) {
          // Extract score — round to 1 decimal, prefer integer score over verdict.value float
          // Fallback: derive from diagnosis if score missing (Block 6 didn't include score in response before)
          const diagScore = (d._raw_diagnosis || d.diagnosis || '').toLowerCase();
          const rawScore = typeof d.score === 'number' ? d.score
            : typeof d.verdict?.value === 'number' ? d.verdict.value
            : diagScore === 'green' ? 8 : diagScore === 'yellow' ? 5 : diagScore === 'red' ? 3
            : 0;
          built.push({
            block_number: blockNums[i],
            name: BLOCK_NAMES[blockNums[i]] || `Block ${blockNums[i]}`,
            score: Math.round(rawScore * 10) / 10,
            diagnosis: d._raw_diagnosis || d.diagnosis || 'yellow',
            key_metric: d.key_metric || d.verdict?.formula || '',
            key_factors: d.key_factors || [],
          });
        }
      });
      if (built.length > 0) {
        setRadarBlocks(built);
        return;
      }
    }

    if (!trendId) return;

    async function loadBlocks() {
      try {
        const res = await fetch(`/api/blocks/summary?trend_id=${encodeURIComponent(trendId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.blocks) {
            setRadarBlocks(data.blocks.map((b: any) => ({
              block_number: b.block_number,
              name: BLOCK_NAMES[b.block_number] || `Block ${b.block_number}`,
              score: b.score ?? 0,
              diagnosis: b.diagnosis ?? 'yellow',
            })));
          }
        }
      } catch {
        // empty
      }
    }

    loadBlocks();
  }, [trendId, externalBlocks, evidenceData]);

  // ─── SSE SYNTHESIS ────────────────────────────────────
  const runSynthesis = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setStrategicDelta(null);
    setSalesText('');
    setStaleInfo({ is_stale: false, stale_blocks: [] });
    setTypewriterEnabled(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trend_id: trendId, niche }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const partialResult: Partial<SynthesisResult> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (currentEvent) {
                case 'status':
                  setStatus(data);
                  break;
                case 'conflicts':
                  partialResult.conflicts = data.conflicts;
                  break;
                case 'skeptic':
                  partialResult.skeptic = data.output;
                  break;
                case 'optimist':
                  partialResult.optimist = data.output;
                  break;
                case 'arbitrator':
                  partialResult.arbitrator = data.output;
                  setResult(partialResult as SynthesisResult);
                  break;
                case 'strategic_delta':
                  setStrategicDelta(data.delta);
                  setSalesText(data.sales_text || '');
                  break;
                case 'complete':
                  onBalanceUpdate((coinBalance ?? 0) - SYNTHESIS_COST);
                  break;
                case 'error':
                  setError(data.message);
                  break;
              }
            } catch {
              // skip parse errors
            }
            currentEvent = '';
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Unknown error');
      }
    } finally {
      setRunning(false);
      setStatus(null);
    }
  }, [trendId, niche, running, coinBalance, onBalanceUpdate]);

  const canAfford = (coinBalance ?? 0) >= SYNTHESIS_COST;

  // ─── Derive works / blockers from SSE data ────────────
  const works: string[] = [];
  const blockers: string[] = [];

  if (result?.optimist?.neutralizations) {
    result.optimist.neutralizations.forEach(n => {
      works.push(n.condition);
    });
  }
  if (result?.skeptic?.points) {
    result.skeptic.points.forEach(p => {
      blockers.push(p.mechanism);
    });
  } else if (result?.skeptic?.blind_spots) {
    result.skeptic.blind_spots.forEach(bs => {
      blockers.push(bs.risk);
    });
  }

  // If no radar blocks from API, build fallback
  const displayBlocks = radarBlocks.length > 0
    ? radarBlocks
    : Array.from({ length: 6 }, (_, i) => ({
      block_number: i + 1,
      name: BLOCK_NAMES[i + 1] || `Block ${i + 1}`,
      score: 5,
      diagnosis: 'yellow',
    }));

  // Typewriter for verdict reasoning
  const verdictText = result?.arbitrator?.verdict_reasoning || result?.arbitrator?.reasoning || '';
  const { displayed: typewriterText, done: typewriterDone } = useTypewriter(verdictText, 18, typewriterEnabled && !!result?.arbitrator);

  // ═══════════════════════════════════════════════════════
  // RENDER: Loading cached
  // ═══════════════════════════════════════════════════════
  if (loadingCached) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mb-4" />
        <p className="text-sm text-zinc-400">{ru ? 'Загрузка результатов...' : 'Loading results...'}</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER: Pre-launch state (Phase 1: Header + Hero)
  // ═══════════════════════════════════════════════════════
  if (!result && !running && !error) {
    return (
      <div className="relative min-h-[60vh]" style={{ background: '#060A0E' }}>
        {/* Video background with graceful degradation */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            style={{ opacity: 0.17, filter: 'saturate(0.6)' }}
            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
          >
            <source src="/videos/synthesis-bg.mp4" type="video/mp4" />
          </video>
          {/* Fallback gradient if no video */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 30% 20%, rgba(0,212,255,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(0,240,160,0.04) 0%, transparent 50%)',
          }} />
        </div>

        <div className="relative z-10">
          {/* Hero Intro */}
          <div className="relative overflow-hidden rounded-2xl mb-8" style={{ background: 'rgba(11,21,32,0.85)', border: '1px solid #1A2E44', backdropFilter: 'blur(12px)' }}>
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'linear-gradient(180deg, #00D4FF, #00F0A0)' }} />
            <div className="p-8 pl-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono px-3 py-1 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)' }}>
                  Analysis Engine
                </span>
                <span className="text-xs font-mono px-3 py-1 rounded-full" style={{ background: 'rgba(255,179,64,0.1)', color: '#FFB340', border: '1px solid rgba(255,179,64,0.2)' }}>
                  {SYNTHESIS_COST} {ru ? 'монет' : 'coins'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                {ru ? 'Шесть блоков данных. Один честный ответ.' : 'Six data blocks. One honest answer.'}
              </h2>
              <p className="text-sm leading-relaxed max-w-xl" style={{ color: '#8899AA' }}>
                {ru
                  ? 'Скептик, Оптимист и Арбитр проанализируют конфликты между блоками, найдут слепые пятна и вынесут условный вердикт. Не прогноз \u2014 условие.'
                  : 'Skeptic, Optimist, and Arbitrator will analyze conflicts between blocks, find blind spots, and deliver a conditional verdict.'}
              </p>

              {coinBalance !== null && (
                <p className="text-xs mt-4" style={{ color: '#556677' }}>
                  {ru ? 'Баланс' : 'Balance'}: {coinBalance} {ru ? 'монет' : 'coins'}
                </p>
              )}

              <button
                onClick={runSynthesis}
                disabled={!canAfford}
                className="mt-6 px-8 py-3 rounded-xl font-medium transition-all flex items-center gap-3 group"
                style={{
                  background: canAfford ? 'linear-gradient(135deg, #00D4FF, #00F0A0)' : '#1A2E44',
                  color: canAfford ? '#060A0E' : '#556677',
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                {ru ? 'Запустить синтез' : 'Run Synthesis'}
              </button>
              {!canAfford && (
                <p className="text-xs mt-2" style={{ color: '#FF4E5B' }}>
                  {ru ? 'Недостаточно монет' : 'Not enough coins'}
                </p>
              )}
            </div>
          </div>

          {/* Phase 2 preview: Radar + Block List */}
          {displayBlocks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" style={{ animation: 'fadeUp 0.6s 0.2s ease-out both' }}>
              <div className="flex items-center justify-center rounded-2xl p-6" style={{ background: 'rgba(11,21,32,0.85)', border: '1px solid #1A2E44' }}>
                <RadarChart blocks={displayBlocks} onBlockClick={(b) => setSelectedBlock(b)} size={260} />
              </div>
              <div className="rounded-2xl p-5 space-y-2" style={{ background: 'rgba(11,21,32,0.85)', border: '1px solid #1A2E44' }}>
                <h3 className="text-sm font-semibold text-white mb-3" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                  {ru ? 'Результаты блоков' : 'Block Results'}
                </h3>
                {displayBlocks.map((block) => {
                  const diagColor = block.diagnosis === 'green' || block.diagnosis === 'GREEN' ? '#00F0A0' : block.diagnosis === 'red' || block.diagnosis === 'RED' ? '#FF4E5B' : '#FFB340';
                  return (
                    <button
                      key={block.block_number}
                      onClick={() => setSelectedBlock(block)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.01]"
                      style={{ background: 'rgba(26,46,68,0.3)', border: '1px solid transparent' }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1A2E44')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                    >
                      <span className="text-xs font-mono w-5 text-center" style={{ color: '#556677' }}>{block.block_number}</span>
                      <span className="flex-1 text-sm text-white">{block.name}</span>
                      <span className="text-sm font-mono font-bold" style={{ color: diagColor }}>{block.score}/10</span>
                      <span className="w-2 h-2 rounded-full" style={{ background: diagColor }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Block popup */}
        {selectedBlock && <BlockPopup block={selectedBlock} conflicts={[]} onClose={() => setSelectedBlock(null)} ru={ru} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER: Running state
  // ═══════════════════════════════════════════════════════
  if (running) {
    const stepLabels: Record<string, string> = {
      loading: ru ? 'Загрузка блоков...' : 'Loading blocks...',
      conflicts: ru ? 'Анализ конфликтов...' : 'Analyzing conflicts...',
      skeptic: ru ? 'Скептик анализирует риски...' : 'Skeptic analyzing risks...',
      optimist: ru ? 'Оптимист ищет условия GO...' : 'Optimist searching for GO...',
      arbitrator: ru ? 'Арбитр выносит вердикт...' : 'Arbitrator deciding...',
      delta: ru ? 'Стратегический разрыв...' : 'Strategic delta...',
    };

    const stepOrder = ['loading', 'conflicts', 'skeptic', 'optimist', 'arbitrator', 'delta'];
    const currentStepIdx = status ? stepOrder.indexOf(status.step) : 0;

    return (
      <div className="relative min-h-[60vh]" style={{ background: '#060A0E' }}>
        {/* Video background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video
            autoPlay muted loop playsInline
            className="w-full h-full object-cover"
            style={{ opacity: 0.12, filter: 'saturate(0.5)' }}
            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
          >
            <source src="/videos/synthesis-bg.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-16">
          {/* Animated hex core */}
          <div className="relative w-28 h-28 mb-8">
            <div className="absolute inset-0 rounded-full" style={{
              border: '2px solid rgba(0,212,255,0.15)',
              animation: 'glowPulse 2s ease-in-out infinite',
            }} />
            <div className="absolute inset-3 rounded-full" style={{
              border: '2px solid rgba(0,240,160,0.2)',
              animation: 'glowPulse 2s 0.5s ease-in-out infinite',
            }} />
            <div className="absolute inset-6 rounded-full" style={{
              border: '2px solid rgba(0,212,255,0.3)',
              animation: 'rotateBorder 4s linear infinite',
              borderTopColor: '#00D4FF',
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: 'transparent',
            }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="1.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
          </div>

          {/* Step progress */}
          <div className="w-full max-w-sm space-y-2.5 mb-6">
            {stepOrder.map((step, i) => {
              const isActive = status?.step === step;
              const isDone = currentStepIdx > i;
              return (
                <div
                  key={step}
                  className="flex items-center gap-3 text-sm transition-all duration-500"
                  style={{
                    opacity: isDone ? 0.4 : isActive ? 1 : 0.15,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  <span className="w-5 text-center" style={{ color: isDone ? '#00F0A0' : isActive ? '#00D4FF' : '#334455' }}>
                    {isDone ? '\u2713' : isActive ? '\u25B6' : '\u25CB'}
                  </span>
                  <span style={{ color: isActive ? '#00D4FF' : '#8899AA' }}>
                    {stepLabels[step] || step}
                  </span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#00D4FF', animation: 'blink 1s infinite' }} />
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>
            {ru ? '~30-60 секунд' : '~30-60 seconds'}
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER: Error state
  // ═══════════════════════════════════════════════════════
  if (error && !result) {
    return (
      <div style={{ background: '#060A0E' }} className="min-h-[40vh]">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,78,91,0.1)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF4E5B" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="mb-4 text-sm" style={{ color: '#FF4E5B' }}>{error}</p>
          <button
            onClick={runSynthesis}
            disabled={!canAfford}
            className="px-6 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #00F0A0)', color: '#060A0E' }}
          >
            {ru ? 'Повторить' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // ═══════════════════════════════════════════════════════
  // RENDER: Full result (Phases 2-5)
  // ═══════════════════════════════════════════════════════

  const verdict = result.arbitrator;
  const vc = getVerdictConfig(verdict?.verdict_type);
  const confidencePercent = Math.round((verdict?.confidence ?? 0) * 100);
  // 7.2 — Bridge text всегда показывается. Если пустой — fallback по типу вердикта.
  const bridgeText = (verdict?.bridge_text && verdict.bridge_text.trim())
    || ((result as any)?.bridge_text && String((result as any).bridge_text).trim())
    || buildBridgeFallback(verdict?.verdict_type);

  return (
    <div className="relative" style={{ background: '#060A0E' }}>
      {/* Fixed video background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video
          autoPlay muted loop playsInline
          className="w-full h-full object-cover"
          style={{ opacity: 0.17, filter: 'saturate(0.5)' }}
          onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
        >
          <source src="/videos/synthesis-bg.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="relative z-10 space-y-6">

        {/* ── PHASE 1: Header ────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ animation: 'fadeUp 0.4s ease-out both' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#556677' }}>
            <span>{trendTitle || niche}</span>
            <span style={{ color: '#334455' }}>/</span>
            <span style={{ color: '#00D4FF' }}>{ru ? 'AI \u0421\u0438\u043D\u0442\u0435\u0437' : 'AI Synthesis'}</span>
          </div>
          <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,179,64,0.1)', color: '#FFB340', border: '1px solid rgba(255,179,64,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
            {SYNTHESIS_COST} {ru ? 'монет' : 'coins'}
          </span>
        </div>

        {/* Hero Intro */}
        <div className="relative overflow-hidden rounded-2xl" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44', backdropFilter: 'blur(8px)', animation: 'fadeUp 0.5s 0.1s ease-out both' }}>
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'linear-gradient(180deg, #00D4FF, #00F0A0)' }} />
          <div className="p-6 pl-5">
            <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
              Analysis Engine
            </span>
            <h2 className="text-xl font-bold text-white mt-3 mb-2" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
              {ru ? 'Шесть блоков данных. Один честный ответ.' : 'Six data blocks. One honest answer.'}
            </h2>
            <p className="text-sm leading-relaxed max-w-xl" style={{ color: '#8899AA' }}>
              {ru
                ? 'Три AI-агента проанализировали конфликты между блоками и вынесли условный вердикт.'
                : 'Three AI agents analyzed conflicts between blocks and delivered a conditional verdict.'}
            </p>
          </div>
        </div>

        {/* Stale data warning */}
        {staleInfo.is_stale && (
          <div className="rounded-xl p-3 flex items-start gap-3" style={{ background: 'rgba(255,179,64,0.06)', border: '1px solid rgba(255,179,64,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB340" strokeWidth="2" className="mt-0.5 flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: '#FFB340' }}>
                {ru ? 'Данные обновились' : 'Data has changed'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#8899AA' }}>
                {ru
                  ? `Блоки ${staleInfo.stale_blocks.join(', ')} были обновлены после последнего синтеза.`
                  : `Blocks ${staleInfo.stale_blocks.join(', ')} were updated after the last synthesis.`}
              </p>
            </div>
            <button
              onClick={runSynthesis}
              disabled={!canAfford}
              className="text-xs font-medium whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors"
              style={{
                color: canAfford ? '#FFB340' : '#556677',
                border: `1px solid ${canAfford ? 'rgba(255,179,64,0.3)' : '#1A2E44'}`,
                cursor: canAfford ? 'pointer' : 'not-allowed',
              }}
            >
              {ru ? `Обновить (${SYNTHESIS_COST}м)` : `Re-run (${SYNTHESIS_COST}c)`}
            </button>
          </div>
        )}

        {/* ── PHASE 2: Radar + Block List ──────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" style={{ animation: 'fadeUp 0.5s 0.2s ease-out both' }}>
          {/* Radar */}
          <div className="flex items-center justify-center rounded-2xl p-6" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44' }}>
            <RadarChart blocks={displayBlocks} onBlockClick={(b) => setSelectedBlock(b)} size={260} />
          </div>

          {/* Block List */}
          <div className="rounded-2xl p-5 space-y-2" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44' }}>
            <h3 className="text-sm font-semibold text-white mb-3" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
              {ru ? 'Результаты блоков' : 'Block Results'}
            </h3>
            {displayBlocks.map((block) => {
              const diagColor = block.diagnosis === 'green' || block.diagnosis === 'GREEN' ? '#00F0A0' : block.diagnosis === 'red' || block.diagnosis === 'RED' ? '#FF4E5B' : '#FFB340';
              return (
                <button
                  key={block.block_number}
                  onClick={() => setSelectedBlock(block)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.01]"
                  style={{ background: 'rgba(26,46,68,0.3)', border: '1px solid transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1A2E44')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <span className="text-xs w-5 text-center" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>{block.block_number}</span>
                  <span className="flex-1 text-sm text-white">{block.name}</span>
                  <span className="text-sm font-bold" style={{ color: diagColor, fontFamily: 'JetBrains Mono, monospace' }}>{block.score}/10</span>
                  <span className="w-2 h-2 rounded-full" style={{ background: diagColor }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Block popup */}
        {selectedBlock && (
          <BlockPopup
            block={selectedBlock}
            conflicts={result.conflicts || []}
            onClose={() => setSelectedBlock(null)}
            ru={ru}
          />
        )}

        {/* ── PHASE 3: Verdict Card with rotating gradient border ── */}
        {verdict && (
          <div className="synthesis-verdict-card rounded-2xl" style={{ animation: 'cardIn 0.6s 0.3s ease-out both' }}>
            <div className="relative rounded-2xl p-6 overflow-hidden" style={{ background: '#0B1520', backgroundImage: vc.bgGradient }}>
              {/* Inner glow */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
                boxShadow: `inset 0 0 80px ${vc.borderColor}08`,
                animation: 'glowPulse 3s ease-in-out infinite',
              }} />

              <div className="relative z-10">
                {/* Verdict type label */}
                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <span className="text-3xl font-black tracking-wider" style={{ color: vc.color, fontFamily: 'Syne, Inter, sans-serif', textShadow: `0 0 40px ${vc.color}30` }}>
                    {ru ? vc.label : vc.labelEn}
                  </span>
                </div>

                {/* 7.1 — Confidence label (без процента) */}
                <div className="mb-5">
                  <p className="text-sm" style={{ color: `${vc.color}E0`, fontFamily: 'Inter, sans-serif' }}>
                    {ru ? 'Вердикт ' : 'Verdict '}
                    <span style={{ color: vc.color, fontWeight: 600 }}>
                      {confidenceLabel(verdict?.confidence ?? 0, ru)}
                    </span>
                  </p>
                </div>

                {/* Confidence bar: full gradient red -> amber -> green */}
                <div className="relative h-2.5 rounded-full mb-6" style={{ background: '#1A2E44' }}>
                  <div className="absolute inset-y-0 left-0 right-0 rounded-full overflow-hidden">
                    <div className="w-full h-full" style={{
                      background: 'linear-gradient(90deg, #FF4E5B 0%, #FFB340 50%, #00F0A0 100%)',
                      opacity: 0.25,
                    }} />
                  </div>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                    style={{
                      width: `${confidencePercent}%`,
                      background: `linear-gradient(90deg, #FF4E5B, #FFB340, #00F0A0)`,
                      backgroundSize: `${100 / (confidencePercent / 100)}% 100%`,
                    }}
                  />
                  {/* Marker dot */}
                  <div
                    className="absolute top-1/2 w-4 h-4 rounded-full"
                    style={{
                      left: `${confidencePercent}%`,
                      transform: 'translate(-50%, -50%)',
                      background: vc.color,
                      boxShadow: `0 0 12px ${vc.color}, 0 0 24px ${vc.color}40`,
                      animation: 'markerGlow 2s ease-in-out infinite',
                    }}
                  />
                </div>

                {/* Condition pills */}
                {(verdict.verdict_condition || (verdict.conditions && verdict.conditions.length > 0)) && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {verdict.verdict_condition && (
                      <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: `${vc.color}10`, color: vc.color, border: `1px solid ${vc.color}30`, fontFamily: 'JetBrains Mono, monospace' }}>
                        {verdict.verdict_condition}
                      </span>
                    )}
                    {verdict.conditions?.map((c, i) => (
                      <span key={i} className="text-xs px-3 py-1.5 rounded-full" style={{ background: `${vc.color}10`, color: vc.color, border: `1px solid ${vc.color}30`, fontFamily: 'JetBrains Mono, monospace' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bridge text — всегда показывается (7.2) */}
                <p className="text-sm leading-relaxed" style={{ color: '#AABBCC', animation: 'bridgeSlide 0.6s 0.3s ease-out both' }}>
                  {bridgeText}
                </p>

                {/* Confidence factors — collapsed by default */}
                {verdict.confidence_factors && verdict.confidence_factors.length > 0 && (
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid #1A2E44' }}>
                    <button
                      onClick={() => setShowFactors(!showFactors)}
                      className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace', background: 'none', border: 'none', padding: 0 }}
                    >
                      <span style={{ transform: showFactors ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                      {ru ? `Факторы уверенности (${verdict.confidence_factors.length})` : `Confidence factors (${verdict.confidence_factors.length})`}
                    </button>
                    {showFactors && (
                      <div className="space-y-1.5" style={{ animation: 'fadeUp 0.3s ease both' }}>
                        {verdict.confidence_factors.map((factor, i) => {
                          const isPositive = factor.startsWith('+');
                          return (
                            <div key={i} className="flex items-start gap-2 text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                              <span style={{ color: isPositive ? '#00F0A0' : '#FF4E5B' }}>
                                {factor.slice(0, 5)}
                              </span>
                              <span style={{ color: '#8899AA' }}>{factor.slice(5).trim()}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── INTERPRETATION SUMMARY (после вердикта, перед детальным анализом) ── */}
        <style jsx>{`
          @keyframes sy-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
          .sy-interp { background: linear-gradient(180deg,#0F1A26 0%,#0D1620 100%); border:1px solid #243C55; border-radius:14px; padding:24px 26px; position:relative; overflow:hidden; }
          .sy-interp::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#00EE9A,#00CFFF,#00EE9A,transparent); background-size:200%; animation:sy-shimmer 5s linear infinite; }
          .sy-interp h2 { font-size:20px; line-height:1.35; font-weight:800; color:#E8F2FF; margin:0 0 12px 0; letter-spacing:-0.01em; }
          .sy-interp .insight { font-size:13.5px; line-height:1.6; color:#A8C0D8; margin:0 0 18px 0; }
          .sy-interp .facts { display:flex; flex-direction:column; gap:8px; padding:14px 16px; background:rgba(0,238,154,0.03); border:1px solid rgba(0,238,154,0.10); border-radius:10px; margin-bottom:16px; }
          .sy-interp .fact { display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.5; color:#C8DCED; }
          .sy-interp .marker { color:#00EE9A; font-size:10px; line-height:1.6; flex-shrink:0; margin-top:2px; }
          .sy-interp .impact { border-top:1px solid #1A2E42; padding-top:14px; }
          .sy-interp .impact-label { display:block; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#3E6480; font-weight:700; margin-bottom:6px; }
          .sy-interp .impact p { font-size:13px; line-height:1.55; color:#E8F2FF; margin:0; font-weight:500; }
        `}</style>
        {verdict && !interpretationLoading && interpretation && (
          <div className="sy-interp" style={{ animation: 'cardIn 0.5s 0.4s ease-out both' }}>
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
              <span className="impact-label">{ru ? 'Что делать сейчас:' : 'What to do now:'}</span>
              <p>{interpretation.decision_impact}</p>
            </div>
          </div>
        )}

        {/* ── PHASE 4: Post-Verdict Section ────────────────── */}
        {verdict && (
          <div className="space-y-4">
            {/* Main insight with typewriter */}
            {verdictText && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44', animation: 'cardIn 0.5s 0.1s ease-out both' }}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                  <span style={{ color: '#00D4FF' }}>{'\u25C6'}</span>
                  {ru ? 'Основной вывод' : 'Main Insight'}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#CCDDEE' }}>
                  {typewriterEnabled ? typewriterText : verdictText}
                  {typewriterEnabled && !typewriterDone && (
                    <span className="inline-block w-0.5 h-4 ml-0.5 align-middle" style={{ background: '#00D4FF', animation: 'blink 0.8s infinite' }} />
                  )}
                </p>
              </div>
            )}

            {/* Analysis grid: works vs blockers */}
            {(works.length > 0 || blockers.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ animation: 'cardIn 0.5s 0.2s ease-out both' }}>
                {/* What works */}
                <div className="rounded-2xl p-5" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44' }}>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#00F0A0', fontFamily: 'Syne, Inter, sans-serif' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00F0A0" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    {ru ? 'Что работает' : 'What works'}
                  </h4>
                  <div className="space-y-2.5">
                    {works.slice(0, 4).map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs" style={{ color: '#8899AA', animation: `fadeUp 0.3s ${0.1 * i}s ease-out both` }}>
                        <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00F0A040' }} />
                        <span>{w}</span>
                      </div>
                    ))}
                    {works.length === 0 && (
                      <p className="text-xs" style={{ color: '#334455' }}>{ru ? 'Данные не найдены' : 'No data'}</p>
                    )}
                  </div>
                </div>

                {/* What blocks */}
                <div className="rounded-2xl p-5" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44' }}>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#FF4E5B', fontFamily: 'Syne, Inter, sans-serif' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF4E5B" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    {ru ? 'Что блокирует' : 'What blocks'}
                  </h4>
                  <div className="space-y-2.5">
                    {blockers.slice(0, 4).map((b, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs" style={{ color: '#8899AA', animation: `fadeUp 0.3s ${0.1 * i}s ease-out both` }}>
                        <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#FF4E5B40' }} />
                        <span>{b}</span>
                      </div>
                    ))}
                    {blockers.length === 0 && (
                      <p className="text-xs" style={{ color: '#334455' }}>{ru ? 'Данные не найдены' : 'No data'}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Key condition */}
            {verdict.priority_actions?.[0] && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', animation: 'cardIn 0.5s 0.4s ease-out both' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', fontFamily: 'JetBrains Mono, monospace' }}>
                    {ru ? 'КЛЮЧЕВОЕ УСЛОВИЕ' : 'KEY CONDITION'}
                  </span>
                </div>
                <p className="text-sm font-medium text-white mb-1">{cleanActionText(verdict.priority_actions[0].action)}</p>
                <div className="flex gap-3 text-xs" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>
                  <span>{verdict.priority_actions[0].timeline}</span>
                  {verdict.priority_actions[0].addresses && (
                    <span style={{ color: '#00F0A080' }}>{cleanActionText(verdict.priority_actions[0].addresses)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Priority actions grid */}
            {verdict.priority_actions && verdict.priority_actions.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {verdict.priority_actions.map((action, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44', animation: `cardIn 0.5s ${0.5 + i * 0.1}s ease-out both` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
                        {action.order ?? i + 1}
                      </span>
                      <span className="text-[10px]" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>{action.timeline}</span>
                    </div>
                    <p className="text-xs text-white leading-relaxed">{cleanActionText(action.action)}</p>
                    {action.addresses && (
                      <p className="text-[10px] mt-2" style={{ color: '#00F0A060', fontFamily: 'JetBrains Mono, monospace' }}>{cleanActionText(action.addresses)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Opportunity window */}
            {strategicDelta?.verdict_frame && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44', animation: 'cardIn 0.5s 0.8s ease-out both' }}>
                <div className="flex items-center gap-2 mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9D7FFF" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                    {ru ? 'Окно возможности' : 'Opportunity Window'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#8899AA' }}>
                  {strategicDelta.verdict_frame}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── PHASE 5: Strategic Delta ────────────────────── */}
        {strategicDelta?.show && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,21,32,0.95)', border: '1px solid rgba(18,70,240,0.3)', animation: 'deltaIn 0.6s ease-out both' }}>
            {/* Header */}
            <div className="p-5 pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(18,70,240,0.1)', color: '#4D7FFF', border: '1px solid rgba(18,70,240,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {ru ? 'Стратегический разрыв' : 'Strategic Delta'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-2" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                {ru ? 'Два пути. Разные числа.' : 'Two paths. Different numbers.'}
              </h3>
            </div>

            {/* Two columns: standard vs strategic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 mt-4">
              {/* Standard path */}
              <div className="p-5" style={{ borderRight: '1px solid #1A2E44' }}>
                <p className="text-xs uppercase tracking-wider mb-4" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>
                  {ru ? 'Стандартный путь' : 'Standard Path'}
                </p>
                <div className="space-y-4">
                  <DeltaMetric label={ru ? 'Выручка / год' : 'Revenue / year'} value={formatMoney(strategicDelta.standard_path.revenue_annual)} />
                  <DeltaMetric label={ru ? 'Месяцев до выручки' : 'Months to revenue'} value={String(strategicDelta.standard_path.months_to_revenue)} />
                  <DeltaMetric label={ru ? 'Вероятность успеха' : 'Success probability'} value={`${Math.round(strategicDelta.standard_path.success_probability * 100)}%`} />
                  {strategicDelta.standard_path.main_trap && (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(255,78,91,0.06)', border: '1px solid rgba(255,78,91,0.15)' }}>
                      <p className="text-[10px] mb-1" style={{ color: '#FF4E5B', fontFamily: 'JetBrains Mono, monospace' }}>{ru ? 'Главная ловушка' : 'Main trap'}</p>
                      <p className="text-xs" style={{ color: '#8899AA' }}>{strategicDelta.standard_path.main_trap}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Strategic path (BLURRED with lock overlay) */}
              <div
                className="p-5 relative group cursor-pointer"
                onClick={() => onNavigateToStrategy?.()}
              >
                <p className="text-xs uppercase tracking-wider mb-4" style={{ color: '#4D7FFF', fontFamily: 'JetBrains Mono, monospace' }}>
                  {ru ? 'Стратегический путь' : 'Strategic Path'}
                </p>
                <div className="space-y-4" style={{ filter: 'blur(7px)', transition: 'filter 0.3s' }}>
                  <DeltaMetric label={ru ? 'Выручка / год' : 'Revenue / year'} value={formatMoney(strategicDelta.strategic_path.revenue_annual)} />
                  <DeltaMetric label={ru ? 'Месяцев до выручки' : 'Months to revenue'} value={String(strategicDelta.strategic_path.months_to_revenue)} />
                  <DeltaMetric label={ru ? 'Вероятность успеха' : 'Success probability'} value={`${Math.round(strategicDelta.strategic_path.success_probability * 100)}%`} />
                </div>

                {/* Lock hover overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'rgba(18,70,240,0.12)', backdropFilter: 'blur(2px)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D7FFF" strokeWidth="2" className="mb-2" style={{ animation: 'float 3s ease-in-out infinite' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <span className="px-5 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'linear-gradient(135deg, #1246F0, #4D7FFF)', color: 'white' }}>
                    {ru ? 'Перейти в Стратегию' : 'Go to Strategy'} {'\u2192'}
                  </span>
                </div>
              </div>
            </div>

            {/* Delta chips */}
            <div className="flex flex-wrap gap-3 px-5 pt-4 pb-2">
              {strategicDelta.delta_revenue > 0 && (
                <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,240,160,0.08)', color: '#00F0A0', border: '1px solid rgba(0,240,160,0.2)', fontFamily: 'JetBrains Mono, monospace', animation: 'deltaIn 0.4s 0.3s ease-out both' }}>
                  +{formatMoney(strategicDelta.delta_revenue)}/{ru ? 'год' : 'yr'}
                </span>
              )}
              {strategicDelta.delta_months > 0 && (
                <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,212,255,0.08)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)', fontFamily: 'JetBrains Mono, monospace', animation: 'deltaIn 0.4s 0.5s ease-out both' }}>
                  -{strategicDelta.delta_months} {ru ? 'мес.' : 'mo.'}
                </span>
              )}
              {strategicDelta.delta_probability > 0 && (
                <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(157,127,255,0.08)', color: '#9D7FFF', border: '1px solid rgba(157,127,255,0.2)', fontFamily: 'JetBrains Mono, monospace', animation: 'deltaIn 0.4s 0.7s ease-out both' }}>
                  +{Math.round(strategicDelta.delta_probability * 100)}% {ru ? 'вероятность' : 'prob.'}
                </span>
              )}
            </div>

            {/* Gap drivers */}
            {strategicDelta.gap_drivers.length > 0 && (
              <div className="px-5 pb-4 space-y-2">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>
                  {ru ? 'Драйверы разрыва' : 'Gap Drivers'}
                </p>
                {strategicDelta.gap_drivers.map((driver: any, i: number) => {
                  // FIX 1 — поддержка обоих форматов (объект или строка) + человеческий source
                  const title = typeof driver === 'string'
                    ? driver
                    : (driver?.title ?? String(driver));
                  const sourceRaw = typeof driver === 'object' ? (driver?.source ?? '') : '';
                  const sourceLabel = gapDriverSourceLabel(sourceRaw);
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{ background: 'rgba(18,70,240,0.04)', border: '1px solid rgba(18,70,240,0.1)', animation: `driverIn 0.4s ${0.4 + i * 0.15}s ease-out both` }}
                    >
                      <span className="text-xs mt-0.5" style={{ color: '#4D7FFF', fontFamily: 'JetBrains Mono, monospace' }}>◆</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white leading-relaxed">{title}</p>
                        {sourceLabel && (
                          <p className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
                            {sourceLabel}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sales text */}
            {salesText && (
              <div className="px-5 pb-4">
                <div className="rounded-xl p-4" style={{ background: 'rgba(18,70,240,0.04)', border: '1px solid rgba(18,70,240,0.1)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: '#AABBCC' }}>
                    {salesText}
                  </p>
                </div>
              </div>
            )}

            {/* CTA */}
            {strategicDelta.cta_text && onNavigateToStrategy && (
              <div className="px-5 pb-5">
                <button
                  onClick={onNavigateToStrategy}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #1246F0, #4D7FFF)',
                    color: 'white',
                    animation: 'ctaPulse 3s ease-in-out infinite',
                  }}
                >
                  {strategicDelta.cta_text}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Collapsible: Conflicts ─────────────────────── */}
        {result.conflicts?.length > 0 && (
          <details className="rounded-2xl overflow-hidden group" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44' }}>
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none" style={{ color: 'white' }}>
              <span className="text-sm font-medium flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB340" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                {ru ? `Конфликты (${result.conflicts.length})` : `Conflicts (${result.conflicts.length})`}
              </span>
              <span className="text-zinc-500 group-open:rotate-45 transition-transform text-lg">+</span>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {result.conflicts.map((c, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(26,46,68,0.3)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{
                      background: c.type === 'existential' ? 'rgba(255,78,91,0.1)' : c.type === 'operational' ? 'rgba(255,179,64,0.1)' : 'rgba(0,212,255,0.1)',
                      color: c.type === 'existential' ? '#FF4E5B' : c.type === 'operational' ? '#FFB340' : '#00D4FF',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {c.type}
                    </span>
                    <span className="text-[10px]" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>{c.pair}</span>
                  </div>
                  <p className="text-xs" style={{ color: '#8899AA' }}>{c.mechanism}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── Collapsible: Skeptic ───────────────────────── */}
        {((result.skeptic?.points && result.skeptic.points.length > 0) || (result.skeptic?.blind_spots && result.skeptic.blind_spots.length > 0)) && (
          <details className="rounded-2xl overflow-hidden group" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44' }}>
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none" style={{ color: 'white' }}>
              <span className="text-sm font-medium flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF4E5B' }} />
                {ru ? 'Скептик' : 'Skeptic'}
              </span>
              <span className="text-zinc-500 group-open:rotate-45 transition-transform text-lg">+</span>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {result.skeptic.points?.map((p, i) => (
                <div key={i} className="rounded-lg p-3" style={{ borderLeft: '2px solid rgba(255,78,91,0.3)', background: 'rgba(26,46,68,0.3)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{
                      background: p.severity === 'existential' ? 'rgba(255,78,91,0.1)' : p.severity === 'operational' ? 'rgba(255,179,64,0.1)' : 'rgba(0,212,255,0.1)',
                      color: p.severity === 'existential' ? '#FF4E5B' : p.severity === 'operational' ? '#FFB340' : '#00D4FF',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {p.severity}
                    </span>
                    <span className="text-[10px]" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>{p.conflict_pair}</span>
                  </div>
                  <p className="text-xs" style={{ color: '#8899AA' }}>{p.mechanism}</p>
                </div>
              ))}
              {result.skeptic.blind_spots?.map((bs, i) => (
                <div key={`bs-${i}`} className="rounded-lg p-3" style={{ borderLeft: '2px solid rgba(255,78,91,0.3)', background: 'rgba(26,46,68,0.3)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,78,91,0.1)', color: '#FF4E5B', fontFamily: 'JetBrains Mono, monospace' }}>{bs.category}</span>
                    {bs.timeline && <span className="text-[10px]" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>{bs.timeline}</span>}
                  </div>
                  <p className="text-xs" style={{ color: '#8899AA' }}>{bs.risk}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── Collapsible: Optimist ──────────────────────── */}
        {result.optimist?.neutralizations?.length > 0 && (
          <details className="rounded-2xl overflow-hidden group" style={{ background: 'rgba(11,21,32,0.9)', border: '1px solid #1A2E44' }}>
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none" style={{ color: 'white' }}>
              <span className="text-sm font-medium flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#00F0A0' }} />
                {ru ? 'Оптимист' : 'Optimist'}
              </span>
              <span className="text-zinc-500 group-open:rotate-45 transition-transform text-lg">+</span>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {result.optimist.neutralizations.map((n, i) => (
                <div key={i} className="rounded-lg p-3" style={{ borderLeft: '2px solid rgba(0,240,160,0.3)', background: 'rgba(26,46,68,0.3)' }}>
                  <p className="text-xs font-medium text-white">{n.addresses_conflict}</p>
                  <p className="text-xs mt-1" style={{ color: '#8899AA' }}>
                    <span style={{ color: '#00F0A0' }}>{ru ? 'Условие:' : 'Condition:'}</span> {n.condition}
                  </p>
                  <span className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded" style={{ background: 'rgba(0,240,160,0.1)', color: '#00F0A0', fontFamily: 'JetBrains Mono, monospace' }}>
                    {n.type}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── Rerun Button ───────────────────────────────── */}
        <div className="text-center pt-2 pb-4">
          <button
            onClick={runSynthesis}
            disabled={!canAfford}
            className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: canAfford ? 'rgba(255,179,64,0.1)' : '#1A2E44',
              color: canAfford ? '#FFB340' : '#556677',
              border: `1px solid ${canAfford ? 'rgba(255,179,64,0.3)' : '#1A2E44'}`,
              cursor: canAfford ? 'pointer' : 'not-allowed',
            }}
          >
            {ru ? `Запустить повторный синтез (${SYNTHESIS_COST} монет)` : `Re-run synthesis (${SYNTHESIS_COST} coins)`}
          </button>
          <p className="text-[10px] mt-2" style={{ color: '#334455', fontFamily: 'JetBrains Mono, monospace' }}>
            {ru ? 'Предыдущий результат будет перезаписан' : 'Previous result will be overwritten'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────

function DeltaMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px]" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>{label}</p>
      <p className="text-xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
    </div>
  );
}

function BlockPopup({
  block,
  conflicts,
  onClose,
  ru,
}: {
  block: RadarBlock;
  conflicts: Conflict[];
  onClose: () => void;
  ru: boolean;
}) {
  const diagColor = block.diagnosis === 'green' || block.diagnosis === 'GREEN' ? '#00F0A0' : block.diagnosis === 'red' || block.diagnosis === 'RED' ? '#FF4E5B' : '#FFB340';
  const related = conflicts.filter(c => c.blocks_involved?.includes(block.block_number));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6,10,14,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 max-w-sm w-full"
        style={{ background: '#0B1520', border: '1px solid #1A2E44', animation: 'cardIn 0.3s ease-out both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{block.name}</h4>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">{'\u00D7'}</button>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-3xl font-bold" style={{ color: diagColor, fontFamily: 'JetBrains Mono, monospace' }}>
            {block.score}/10
          </span>
          <span className="text-xs px-3 py-1 rounded-full" style={{
            background: `${diagColor}15`,
            color: diagColor,
            border: `1px solid ${diagColor}30`,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {block.diagnosis.toUpperCase()}
          </span>
        </div>
        {/* Key metric */}
        {block.key_metric && (
          <div className="mb-3 p-3 rounded-lg" style={{ background: `${diagColor}08`, borderLeft: `3px solid ${diagColor}`, color: '#8899AA', fontSize: 13, lineHeight: 1.65 }}>
            {block.key_metric}
          </div>
        )}
        {/* Key factors */}
        {block.key_factors && block.key_factors.length > 0 && (
          <div className="mb-3">
            <p className="text-xs mb-2" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>
              {ru ? 'Ключевые факторы:' : 'Key factors:'}
            </p>
            {block.key_factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs mb-1" style={{ color: '#8899AA' }}>
                <span style={{ color: diagColor, flexShrink: 0, marginTop: 2 }}>•</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        )}
        {/* Related conflicts */}
        {related.length > 0 && (
          <div>
            <p className="text-xs mb-2" style={{ color: '#556677', fontFamily: 'JetBrains Mono, monospace' }}>
              {ru ? 'Связанные конфликты:' : 'Related conflicts:'}
            </p>
            {related.map((c, i) => (
              <div key={i} className="text-xs p-2 rounded-lg mb-1" style={{ background: 'rgba(26,46,68,0.4)', color: '#8899AA' }}>
                <span style={{ color: c.type === 'existential' ? '#FF4E5B' : c.type === 'operational' ? '#FFB340' : '#00D4FF' }}>
                  {c.type}
                </span>
                : {c.mechanism}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
