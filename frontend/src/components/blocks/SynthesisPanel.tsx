'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

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

// Формат из API (SkepticOutput в types/analysis.ts)
interface SkepticPoint {
  conflict_pair: string;  // какой конфликт
  mechanism: string;      // механизм угрозы
  severity: string;       // existential | operational | manageable
}

interface SkepticBlindSpot {
  category: string;       // regulatory | technological | cultural
  risk: string;
  timeline: string;
}

// Формат из API (OptimistOutput в types/analysis.ts)
interface OptimistNeutralization {
  addresses_conflict: string;  // какой конфликт нейтрализует
  condition: string;           // условие нейтрализации
  type: string;                // pricing_model | strategic_gap | pivot | partnership | sequencing
}

// Формат из API (ArbitratorOutput в types/analysis.ts)
interface ArbitratorOutput {
  verdict_type: 'go_if' | 'no_go_until' | 'experiment_if';
  confidence: number;
  verdict_condition: string;
  verdict_reasoning: string;
  priority_actions: Array<{ order: number; action: string; timeline: string; addresses: string }>;
  // Legacy fields (кешированные результаты)
  conditions?: string[];
  reasoning?: string;
}

interface SynthesisResult {
  conflicts: Conflict[];
  skeptic: { points?: SkepticPoint[]; blind_spots?: SkepticBlindSpot[] };
  optimist: { neutralizations: OptimistNeutralization[] };
  arbitrator: ArbitratorOutput;
}

interface Props {
  trendId: string;
  niche: string;
  coinBalance: number | null;
  onBalanceUpdate: (newBalance: number) => void;
  language: 'ru' | 'en';
}

const SYNTHESIS_COST = 20;

const verdictStyles: Record<string, { bg: string; border: string; text: string; label: string; labelEn: string }> = {
  go_if: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    label: 'GO (при условиях)',
    labelEn: 'GO (conditional)',
  },
  no_go_until: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    label: 'NO-GO (пока не)',
    labelEn: 'NO-GO (until)',
  },
  experiment_if: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    label: 'ЭКСПЕРИМЕНТ',
    labelEn: 'EXPERIMENT',
  },
};

export default function SynthesisPanel({ trendId, niche, coinBalance, onBalanceUpdate, language }: Props) {
  const [status, setStatus] = useState<SynthesisStep | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [loadingCached, setLoadingCached] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const ru = language === 'ru';

  // Загрузка сохранённых результатов из БД при маунте
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
          }
        }
      } catch {
        // Нет кешированных данных — OK, покажем кнопку запуска
      } finally {
        setLoadingCached(false);
      }
    }

    loadCachedSynthesis();
  }, [trendId]);

  const runSynthesis = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);

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

  const toggle = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const canAfford = (coinBalance ?? 0) >= SYNTHESIS_COST;

  // ─── Loading cached results ───
  if (loadingCached) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full mb-4" />
        <p className="text-sm text-zinc-400">{ru ? 'Загрузка результатов...' : 'Loading results...'}</p>
      </div>
    );
  }

  // ─── Pre-launch state ───
  if (!result && !running && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-6">
          <span className="text-4xl">⚔️</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          {ru ? 'AI Синтез' : 'AI Synthesis'}
        </h3>
        <p className="text-zinc-400 text-center max-w-md mb-2">
          {ru
            ? 'Скептик, Оптимист и Арбитр проанализируют конфликты между блоками и вынесут вердикт.'
            : 'Skeptic, Optimist and Arbitrator will analyze conflicts between blocks and deliver a verdict.'}
        </p>
        <p className="text-sm text-amber-400/80 mb-6">
          {ru ? `Стоимость: ${SYNTHESIS_COST} монет` : `Cost: ${SYNTHESIS_COST} coins`}
          {coinBalance !== null && (
            <span className="text-zinc-500 ml-2">
              ({ru ? 'баланс' : 'balance'}: {coinBalance})
            </span>
          )}
        </p>

        <button
          onClick={runSynthesis}
          disabled={!canAfford}
          className={`px-8 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
            !canAfford
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          <span>⚔️</span>
          {ru ? 'Запустить синтез' : 'Run Synthesis'}
        </button>
        {!canAfford && (
          <p className="text-xs text-red-400/70 mt-2">
            {ru ? 'Недостаточно монет' : 'Not enough coins'}
          </p>
        )}
      </div>
    );
  }

  // ─── Running state ───
  if (running) {
    const stepLabels: Record<string, string> = {
      loading: ru ? 'Загрузка блоков...' : 'Loading blocks...',
      conflicts: ru ? 'Анализ конфликтов...' : 'Analyzing conflicts...',
      skeptic: ru ? 'Скептик анализирует...' : 'Skeptic analyzing...',
      optimist: ru ? 'Оптимист ищет возможности...' : 'Optimist searching...',
      arbitrator: ru ? 'Арбитр выносит вердикт...' : 'Arbitrator deciding...',
    };

    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mb-6" />
        <p className="text-white font-medium mb-1">
          {status ? stepLabels[status.step] || status.message : (ru ? 'Запуск...' : 'Starting...')}
        </p>
        <p className="text-xs text-zinc-500">
          {ru ? 'Обычно занимает 30-60 секунд' : 'Usually takes 30-60 seconds'}
        </p>
      </div>
    );
  }

  // ─── Error state ───
  if (error && !result) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={runSynthesis}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm"
        >
          {ru ? 'Повторить' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!result) return null;

  // ─── Result display ───
  const verdict = result.arbitrator;
  const vs = verdictStyles[verdict?.verdict_type] || verdictStyles.experiment_if;

  return (
    <div className="space-y-4">
      {/* Verdict Banner */}
      <div className={`${vs.bg} border ${vs.border} rounded-xl p-5`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚖️</span>
            <div>
              <span className={`text-lg font-bold ${vs.text}`}>
                {ru ? vs.label : vs.labelEn}
              </span>
              {verdict?.confidence && (
                <span className="text-sm text-zinc-400 ml-2">
                  ({Math.round(verdict.confidence * 100)}% {ru ? 'уверенность' : 'confidence'})
                </span>
              )}
            </div>
          </div>
        </div>
        {(verdict?.verdict_reasoning || verdict?.reasoning) && (
          <p className="text-sm text-zinc-300">{verdict.verdict_reasoning || verdict.reasoning}</p>
        )}
      </div>

      {/* Priority Actions */}
      {verdict?.priority_actions?.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
          <h4 className="text-sm font-medium text-white mb-3">
            {ru ? 'Приоритетные действия' : 'Priority Actions'}
          </h4>
          <div className="space-y-2">
            {verdict.priority_actions.map((action, i) => (
              <div key={i} className="flex items-start gap-3 bg-zinc-800/50 rounded-lg p-3">
                <span className="text-indigo-400 font-bold text-sm mt-0.5">{action.order ?? i + 1}</span>
                <div>
                  <p className="text-sm text-white">{action.action}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-zinc-500">{action.timeline}</span>
                    {action.addresses && (
                      <span className="text-xs text-emerald-400/70">{action.addresses}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      {(verdict?.verdict_condition || (verdict?.conditions && verdict.conditions.length > 0)) && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
          <h4 className="text-sm font-medium text-white mb-3">
            {ru ? 'Условия' : 'Conditions'}
          </h4>
          {verdict.verdict_condition ? (
            <p className="text-sm text-zinc-300 flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              {verdict.verdict_condition}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {verdict.conditions?.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Conflicts */}
      {result.conflicts?.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('conflicts')} className="w-full flex items-center justify-between p-3 text-left">
            <span className="text-sm font-medium text-white">
              {ru ? `Конфликты (${result.conflicts.length})` : `Conflicts (${result.conflicts.length})`}
            </span>
            <span className="text-zinc-500">{expandedSection === 'conflicts' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'conflicts' && (
            <div className="px-3 pb-3 space-y-2">
              {result.conflicts.map((c, i) => (
                <div key={i} className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      c.type === 'existential' ? 'bg-red-500/20 text-red-400' :
                      c.type === 'operational' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>{c.type}</span>
                    <span className="text-xs text-zinc-500">{c.pair}</span>
                  </div>
                  <p className="text-sm text-zinc-300">{c.mechanism}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skeptic — Mode 1: конфликты */}
      {result.skeptic?.points && result.skeptic.points.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('skeptic')} className="w-full flex items-center justify-between p-3 text-left">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <span className="text-red-400">🔴</span>
              {ru ? 'Скептик' : 'Skeptic'}
            </span>
            <span className="text-zinc-500">{expandedSection === 'skeptic' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'skeptic' && (
            <div className="px-3 pb-3 space-y-2">
              {result.skeptic.points.map((p, i) => (
                <div key={i} className="border-l-2 border-red-500/40 pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      p.severity === 'existential' ? 'bg-red-500/20 text-red-400' :
                      p.severity === 'operational' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>{p.severity}</span>
                    <span className="text-xs text-zinc-500">{p.conflict_pair}</span>
                  </div>
                  <p className="text-sm text-zinc-300">{p.mechanism}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skeptic — Mode 2: blind spots */}
      {result.skeptic?.blind_spots && result.skeptic.blind_spots.length > 0 && !result.skeptic?.points?.length && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('skeptic')} className="w-full flex items-center justify-between p-3 text-left">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <span className="text-red-400">🔴</span>
              {ru ? 'Скептик (Blind Spot Detector)' : 'Skeptic (Blind Spot Detector)'}
            </span>
            <span className="text-zinc-500">{expandedSection === 'skeptic' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'skeptic' && (
            <div className="px-3 pb-3 space-y-2">
              {result.skeptic.blind_spots.map((bs, i) => (
                <div key={i} className="border-l-2 border-red-500/40 pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">{bs.category}</span>
                    {bs.timeline && <span className="text-xs text-zinc-500">{bs.timeline}</span>}
                  </div>
                  <p className="text-sm text-zinc-300">{bs.risk}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Optimist */}
      {result.optimist?.neutralizations?.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('optimist')} className="w-full flex items-center justify-between p-3 text-left">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <span className="text-green-400">🟢</span>
              {ru ? 'Оптимист' : 'Optimist'}
            </span>
            <span className="text-zinc-500">{expandedSection === 'optimist' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'optimist' && (
            <div className="px-3 pb-3 space-y-2">
              {result.optimist.neutralizations.map((n, i) => (
                <div key={i} className="border-l-2 border-green-500/40 pl-3">
                  <p className="text-sm font-medium text-white">{n.addresses_conflict}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    <span className="text-green-400">{ru ? 'Условие:' : 'Condition:'}</span> {n.condition}
                  </p>
                  <span className="text-xs mt-1 inline-block px-2 py-0.5 rounded bg-green-500/20 text-green-400">{n.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Re-run */}
      <div className="text-center pt-2">
        <button
          onClick={runSynthesis}
          disabled={!canAfford}
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors disabled:text-zinc-600"
        >
          {ru ? `Перезапустить (${SYNTHESIS_COST} монет)` : `Re-run (${SYNTHESIS_COST} coins)`}
        </button>
      </div>
    </div>
  );
}
