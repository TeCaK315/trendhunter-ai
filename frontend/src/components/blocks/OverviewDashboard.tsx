'use client';

import React, { useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────

type FlowStep = 'overview' | 'evidence' | 'action-plan' | 'monitoring' | 'research' | 'business' | 'project';

interface SignalData {
  score: number | null;
  diagnosis: 'green' | 'yellow' | 'red' | null;
  keyFact: string;
  keyMetric: string;
}

interface OverviewDashboardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evidenceData: Record<string, any>;
  evidenceProgress: { done: number; total: number; percent: number; loading: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: any; // AI Synthesis result
  coinBalance: number;
  language: 'ru' | 'en';
  onNavigate: (step: FlowStep, subTab?: string) => void;
  onRunAnalysis: () => void;
  analyzing: boolean;
}

// ─── Helpers ────────────────────────────────────────────────

function getSignalColor(diagnosis: string | null): { text: string; bg: string; border: string; dot: string } {
  switch (diagnosis) {
    case 'green': return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' };
    case 'yellow': return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400' };
    case 'red': return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-400' };
    default: return { text: 'text-zinc-500', bg: 'bg-zinc-800/50', border: 'border-zinc-700/50', dot: 'bg-zinc-600' };
  }
}

function scoreToColor(score: number | null): string {
  if (score === null) return 'text-zinc-500';
  if (score >= 7) return 'text-emerald-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-red-400';
}

function diagnosisLabel(d: string | null, lang: 'ru' | 'en'): string {
  if (!d) return lang === 'ru' ? 'Не проверено' : 'Not checked';
  if (d === 'green') return lang === 'ru' ? 'Готово' : 'Ready';
  if (d === 'yellow') return lang === 'ru' ? 'Внимание' : 'Attention';
  return lang === 'ru' ? 'Критично' : 'Critical';
}

// Extract signal data from evidence block
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSignal(blockKey: string, data: any): SignalData {
  if (!data) return { score: null, diagnosis: null, keyFact: '', keyMetric: '' };

  const raw = data._raw_public || data;
  // Score: try multiple sources (v1 adapted, v2 raw, verdict object)
  const rawScore = raw.score ?? data.score ?? data.verdict?.value ?? data.who_hurts?.severity_score?.value ?? null;
  const score = rawScore !== null ? Math.round(rawScore * 10) / 10 : null;
  // Diagnosis: support both lowercase and uppercase
  const rawDiag = raw.diagnosis || raw._raw_diagnosis || data.diagnosis || null;
  const diagnosis = rawDiag ? rawDiag.toLowerCase() : null;
  const keyMetric = raw.key_metric || data.key_metric || raw.monetization_diagnosis || '';
  const keyFactors = raw.key_factors || data.key_factors || [];

  // Extract most meaningful fact per block
  let keyFact = keyFactors[0] || '';

  switch (blockKey) {
    case 'problem': {
      const total = data.who_hurts?.total_complaints || raw.layer1?.total_complaints || 0;
      if (total > 0) {
        keyFact = `${total} жалоб найдено`;
      }
      break;
    }
    case 'demand': {
      const growth = data.growing_or_dying?.trends_12m?.growth_rate;
      const intentObj = data.search_intent;
      // search_intent is {commercial_percent, informational_percent, intent_type, ...}
      const commercialPct = typeof intentObj === 'object' && intentObj !== null
        ? intentObj.commercial_percent
        : null;
      if (commercialPct != null) {
        keyFact = `${commercialPct}% коммерческий интент`;
      } else if (growth) {
        keyFact = `${growth > 0 ? '+' : ''}${growth}% за 12 мес`;
      }
      break;
    }
    case 'sellability': {
      // v2: monetization_archetype, friction_score, monetization_quality
      const archetype = raw.monetization_archetype || raw.block_context?.monetization_archetype;
      const friction = raw.friction_score || raw.block_context?.friction_score;
      const cycle = raw.block_context?.sale_cycle_days || raw.sales_cycle?.days;
      const median = raw.block_context?.median_price || raw.average_ticket?.median_price;
      if (archetype) {
        keyFact = archetype + (friction ? ` · Трение: ${friction}` : '');
      } else if (cycle && median) {
        keyFact = `Цикл ${cycle}д · $${median} медиана`;
      }
      break;
    }
    case 'occupation': {
      const players = raw.block_context?.competitor_count || raw.competitor_count;
      const gapType = raw.block_context?.gap_type || raw.gap_type;
      if (players) {
        keyFact = `${players} игроков` + (gapType ? ` · ${gapType} gap` : '');
      }
      break;
    }
    case 'economics': {
      // v2: cac_estimate, revenue fields
      const cac = raw.cac_estimate || raw.block_context?.cac_estimate;
      const revMid = raw.revenue_mid || raw.revenue_range?.mid || raw.block_context?.revenue_mid;
      const ltvRatio = raw.block_context?.ltv_cac_ratio;
      if (revMid) {
        const revStr = revMid >= 1000000 ? `$${(revMid/1000000).toFixed(1)}M` : revMid >= 1000 ? `$${Math.round(revMid/1000)}K` : `$${Math.round(revMid)}`;
        keyFact = `Revenue ${revStr}/год` + (cac ? ` · CAC $${Math.round(cac)}` : '');
      } else if (cac) {
        keyFact = `CAC $${Math.round(cac)}` + (ltvRatio ? ` · LTV/CAC ${ltvRatio}x` : '');
      }
      break;
    }
    case 'tech': {
      const spots = raw.block_context?.blind_spot_count;
      if (spots) {
        keyFact = `${spots} обнаружено`;
      }
      break;
    }
  }

  return { score, diagnosis, keyFact, keyMetric };
}

// ─── Component ──────────────────────────────────────────────

export default function OverviewDashboard({
  evidenceData,
  evidenceProgress,
  analysis,
  coinBalance,
  language,
  onNavigate,
  onRunAnalysis,
  analyzing,
}: OverviewDashboardProps) {
  const t = language === 'ru';

  // ─── Extract signals from all blocks ───
  const signals = useMemo(() => {
    const blocks = [
      { key: 'problem', label: t ? 'Проблема' : 'Problem', icon: '🎯' },
      { key: 'demand', label: t ? 'Спрос' : 'Demand', icon: '📈' },
      { key: 'sellability', label: t ? 'Продаваемость' : 'Sellability', icon: '💰' },
      { key: 'occupation', label: t ? 'Конкуренция' : 'Competition', icon: '⚔️' },
      { key: 'economics', label: t ? 'Экономика' : 'Economics', icon: '📊' },
      { key: 'tech', label: t ? 'Слепые пятна' : 'Blind Spots', icon: '🔮' },
    ];

    return blocks.map(b => ({
      ...b,
      ...extractSignal(b.key, evidenceData[b.key]),
    }));
  }, [evidenceData, t]);

  // ─── Verdict computation ───
  const verdict = useMemo(() => {
    const scored = signals.filter(s => s.score !== null);
    if (scored.length === 0) return null;

    const avgScore = scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length;
    const greens = scored.filter(s => s.diagnosis === 'green').length;
    const yellows = scored.filter(s => s.diagnosis === 'yellow').length;
    const reds = scored.filter(s => s.diagnosis === 'red').length;
    const critical = signals.find(s => s.diagnosis === 'red');

    let title: string;
    let subtitle: string;
    let verdictType: 'green' | 'yellow' | 'red';

    if (reds > 0) {
      verdictType = avgScore >= 5 ? 'yellow' : 'red';
      title = t ? 'Рынок есть. Математика пока не сходится.' : 'Market exists. Math doesn\'t add up yet.';
      subtitle = critical
        ? (t ? `Одно условие отделяет тебя от GO. Блок "${critical.label}" требует внимания.` : `One condition separates you from GO. Block "${critical.label}" needs attention.`)
        : (t ? 'Есть критические проблемы в анализе.' : 'Critical issues found in analysis.');
    } else if (yellows > greens) {
      verdictType = 'yellow';
      title = t ? 'Потенциал есть. Нужна проверка.' : 'Potential exists. Needs verification.';
      subtitle = t ? `${yellows} блоков требуют дополнительного внимания.` : `${yellows} blocks need additional attention.`;
    } else {
      verdictType = 'green';
      title = t ? 'Ниша готова. Можно запускать.' : 'Niche is ready. You can launch.';
      subtitle = t ? 'Все ключевые метрики в зелёной зоне.' : 'All key metrics are in the green zone.';
    }

    return {
      title,
      subtitle,
      type: verdictType,
      avgScore: Math.round(avgScore * 10) / 10,
      greens,
      yellows,
      reds,
      critical,
      blocksAnalyzed: scored.length,
    };
  }, [signals, t]);

  // ─── Summary stats ───
  const stats = useMemo(() => {
    const greens = signals.filter(s => s.diagnosis === 'green').length;
    const yellows = signals.filter(s => s.diagnosis === 'yellow').length;
    const reds = signals.filter(s => s.diagnosis === 'red').length;
    return { greens, yellows, reds };
  }, [signals]);

  // ─── Path steps ───
  const pathSteps = useMemo(() => [
    { id: 'overview', label: t ? 'Обзор' : 'Overview', icon: '📊', status: 'done' as const },
    {
      id: 'evidence',
      label: t ? 'Исследование' : 'Research',
      icon: '🔎',
      status: evidenceProgress.done === 6 ? 'done' as const : evidenceProgress.done > 0 ? 'current' as const : 'locked' as const,
      sub: `${evidenceProgress.done}/6 ${t ? 'блоков' : 'blocks'}`,
    },
    {
      id: 'analysis',
      label: t ? 'AI Синтез' : 'AI Synthesis',
      icon: '🧠',
      status: analysis ? 'done' as const : evidenceProgress.done >= 3 ? 'current' as const : 'locked' as const,
      sub: analysis ? (t ? 'Готов' : 'Done') : `20${t ? 'м' : 'c'}`,
    },
    {
      id: 'action-plan',
      label: t ? 'Стратегия' : 'Strategy',
      icon: '🗺️',
      status: 'locked' as const,
      sub: t ? 'Plan + GTM' : 'Plan + GTM',
    },
    {
      id: 'monitoring',
      label: t ? 'Мониторинг' : 'Monitoring',
      icon: '📡',
      status: 'locked' as const,
      sub: t ? 'Пульс рынка' : 'Market pulse',
    },
    {
      id: 'project',
      label: t ? 'Запуск' : 'Launch',
      icon: '🚀',
      status: 'locked' as const,
      sub: t ? 'Лендинг + MVP' : 'Landing + MVP',
    },
  ], [t, evidenceProgress, analysis]);

  const verdictColors = {
    green: { border: 'border-emerald-500/30', glow: 'from-emerald-500/5', tag: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]' },
    yellow: { border: 'border-amber-500/30', glow: 'from-amber-500/5', tag: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-400 shadow-[0_0_8px_rgba(234,179,8,0.6)]' },
    red: { border: 'border-red-500/30', glow: 'from-red-500/5', tag: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]' },
  };

  // No evidence data yet — show CTA to run analysis
  const hasAnyEvidence = evidenceProgress.done > 0;

  return (
    <div className="space-y-5">

      {/* ═══ ZONE 1: VERDICT ═══ */}
      {hasAnyEvidence && verdict ? (
        <div className={`relative bg-zinc-900/50 border ${verdictColors[verdict.type].border} rounded-2xl overflow-hidden`}>
          {/* Top accent line */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${verdictColors[verdict.type].glow} to-transparent`} />

          <div className="grid lg:grid-cols-[1fr_320px]">
            {/* Left — Verdict */}
            <div className="p-6 lg:p-8 lg:border-r border-zinc-800/50">
              {/* Tag */}
              <div className={`inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-4 ${verdictColors[verdict.type].tag}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${verdictColors[verdict.type].dot}`} />
                {verdict.type === 'green' ? (t ? 'Готово к запуску' : 'Ready to launch') :
                 verdict.type === 'yellow' ? (t ? 'Сначала проверь' : 'Check first') :
                 (t ? 'Критические риски' : 'Critical risks')}
              </div>

              <h2 className="text-2xl lg:text-[28px] font-black text-white leading-tight mb-2">
                {verdict.title}
              </h2>
              <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
                {verdict.subtitle}
              </p>

              {/* Critical block warning */}
              {verdict.critical && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-5 flex gap-3">
                  <span className="text-sm mt-0.5">⚠️</span>
                  <div className="text-xs font-mono text-red-300/80 leading-relaxed">
                    <strong className="text-red-400">{verdict.critical.label}</strong>: {verdict.critical.keyFact || (t ? 'Требует внимания' : 'Needs attention')}
                  </div>
                </div>
              )}

              {/* CTA */}
              {!analysis && evidenceProgress.done >= 3 && (
                <>
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-4">
                    <span>⚡ {t ? 'Запусти AI Синтез для полного вердикта' : 'Run AI Synthesis for full verdict'}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/20 to-transparent" />
                  </div>
                  <button
                    onClick={() => onNavigate('evidence', 'analysis')}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-bold px-5 py-3 rounded-xl hover:shadow-lg hover:shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
                  >
                    {t ? 'Запустить AI Синтез' : 'Run AI Synthesis'}
                    <span className="text-[10px] font-mono bg-black/20 px-2 py-0.5 rounded">20 {t ? 'монет' : 'coins'}</span>
                  </button>
                </>
              )}

              {/* Trust indicators */}
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-zinc-600">
                {signals.filter(s => s.score !== null).map(s => (
                  <span key={s.key} className="flex items-center gap-1">
                    <span className="text-emerald-500">✓</span>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — Key Metrics */}
            <div className="p-6 flex flex-col gap-3">
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                {t ? 'Ключевые метрики' : 'Key Metrics'}
              </div>

              {/* Average Score */}
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide mb-1">
                  {t ? 'Средний балл' : 'Average Score'}
                </div>
                <div className={`text-2xl font-black ${scoreToColor(verdict.avgScore)}`}>
                  {verdict.avgScore}<span className="text-sm text-zinc-600">/10</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-600 mt-1">
                  {t ? `на основе ${verdict.blocksAnalyzed} блоков` : `based on ${verdict.blocksAnalyzed} blocks`}
                </div>
              </div>

              {/* Signal summary */}
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide mb-2">
                  {t ? 'Сигналы' : 'Signals'}
                </div>
                <div className="flex gap-3">
                  {stats.greens > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-sm font-bold text-emerald-400">{stats.greens}</span>
                      <span className="text-[10px] text-zinc-500">{t ? 'готово' : 'ready'}</span>
                    </div>
                  )}
                  {stats.yellows > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-sm font-bold text-amber-400">{stats.yellows}</span>
                      <span className="text-[10px] text-zinc-500">{t ? 'вним.' : 'warn'}</span>
                    </div>
                  )}
                  {stats.reds > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-sm font-bold text-red-400">{stats.reds}</span>
                      <span className="text-[10px] text-zinc-500">{t ? 'крит.' : 'crit'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confidence */}
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide mb-1">
                  {t ? 'Уверенность анализа' : 'Analysis Confidence'}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 mb-1.5">
                  <span>{Math.round((evidenceProgress.done / 6) * 100)}%</span>
                  <span>{t ? `на основе ${evidenceProgress.done} блоков` : `based on ${evidenceProgress.done} blocks`}</span>
                </div>
                <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${(evidenceProgress.done / 6) * 100}%` }}
                  />
                </div>
                {!analysis && (
                  <div className="text-[10px] font-mono text-zinc-600 mt-2">
                    {t ? 'Повысится после AI Синтеза' : 'Will increase after AI Synthesis'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* No evidence yet — show intro CTA */
        <div className="relative bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500/30 to-transparent" />
          <div className="p-6 lg:p-8 text-center max-w-lg mx-auto">
            <div className="text-4xl mb-4">🔎</div>
            <h2 className="text-xl font-bold text-white mb-2">
              {t ? 'Запусти исследование' : 'Run Research'}
            </h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              {t
                ? '6 блоков анализа проверят спрос, конкуренцию, экономику и слепые пятна. Вердикт появится здесь.'
                : '6 analysis blocks will check demand, competition, economics and blind spots. Verdict will appear here.'}
            </p>
            <button
              onClick={onRunAnalysis}
              disabled={analyzing}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                analyzing
                  ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-0.5'
              }`}
            >
              {analyzing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  {t ? 'Анализируем...' : 'Analyzing...'}
                </>
              ) : (
                <>
                  <span>🔍</span>
                  {t ? 'Запустить анализ' : 'Run Analysis'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══ ZONE 2: SIGNALS GRID ═══ */}
      {hasAnyEvidence && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
              {t ? 'Сигналы по блокам' : 'Block Signals'}
            </span>
            <div className="flex gap-3 text-[10px] font-mono">
              {stats.greens > 0 && <span className="text-emerald-400">🟢 {stats.greens} {t ? 'готово' : 'ready'}</span>}
              {stats.yellows > 0 && <span className="text-amber-400">🟡 {stats.yellows} {t ? 'внимание' : 'warning'}</span>}
              {stats.reds > 0 && <span className="text-red-400">🔴 {stats.reds} {t ? 'критично' : 'critical'}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {signals.map((signal) => {
              const colors = getSignalColor(signal.diagnosis);
              const isCritical = signal.diagnosis === 'red';

              return (
                <button
                  key={signal.key}
                  onClick={() => onNavigate('evidence', signal.key)}
                  className={`relative text-left bg-zinc-900/50 border rounded-xl p-3.5 transition-all hover:-translate-y-0.5 hover:border-zinc-600 ${
                    isCritical ? `${colors.border} ${colors.bg}` : 'border-zinc-800'
                  } ${isCritical ? 'col-span-2 lg:col-span-1 xl:col-span-2' : ''}`}
                >
                  {/* Top accent */}
                  <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-xl ${
                    signal.diagnosis === 'green' ? 'bg-emerald-500' :
                    signal.diagnosis === 'yellow' ? 'bg-amber-500' :
                    signal.diagnosis === 'red' ? 'bg-red-500' :
                    'bg-zinc-700'
                  }`} />

                  {isCritical && (
                    <div className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded mb-2">
                      ⚠️ {t ? 'Критичный блок' : 'Critical block'}
                    </div>
                  )}

                  <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wide mb-2">
                    {signal.label}
                  </div>

                  {signal.score !== null ? (
                    <div className={`text-2xl font-black mb-1.5 ${scoreToColor(signal.score)}`}>
                      {Math.round(signal.score * 10) / 10}<span className="text-xs text-zinc-600">/10</span>
                    </div>
                  ) : (
                    <div className="text-lg font-bold text-zinc-600 mb-1.5">—</div>
                  )}

                  <div className="text-[10px] font-mono text-zinc-500 leading-snug line-clamp-2">
                    {signal.keyFact || diagnosisLabel(signal.diagnosis, language)}
                  </div>

                  {isCritical && signal.keyFact && (
                    <div className="mt-2 text-[10px] font-mono text-indigo-400 flex items-center gap-1">
                      {t ? 'Это решаемо — посмотреть' : 'Solvable — view'} →
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ZONE 3: ANCHORS ═══ */}
      <div className="grid lg:grid-cols-3 gap-3">
        {/* Blind Spots */}
        <div
          className="bg-zinc-900/50 border border-purple-500/20 rounded-xl p-5 flex flex-col gap-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-purple-500/30"
          onClick={() => onNavigate('evidence', 'tech')}
        >
          <div className="text-xl">🔮</div>
          <div className="text-[15px] font-bold text-white leading-snug">
            {t ? 'Что рынок не замечает' : 'What the market misses'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 leading-relaxed flex-1">
            {evidenceData.tech ? (
              <>
                {t ? 'Обнаружены слепые пятна конкурентов.' : 'Competitor blind spots found.'}
                <div className="flex gap-1.5 items-center mt-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  <span className="text-[10px] text-zinc-600 ml-1">
                    {t ? 'ещё 3 скрыто' : '3 more hidden'}
                  </span>
                </div>
              </>
            ) : (
              t ? 'Найди неиспользованные возможности в нише.' : 'Find untapped opportunities in the niche.'
            )}
          </div>
          <div className="flex items-center justify-between mt-auto">
            <span className="text-[11px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg">
              {evidenceData.tech ? (t ? 'Следующее пятно →' : 'Next spot →') : (t ? 'Запустить →' : 'Run →')}
            </span>
            <span className="text-[10px] font-mono text-zinc-600">
              {t ? '5 монет' : '5 coins'}
            </span>
          </div>
        </div>

        {/* AI Synthesis / GO Condition */}
        <div
          className="bg-zinc-900/50 border border-indigo-500/20 rounded-xl p-5 flex flex-col gap-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.03] to-transparent"
          onClick={() => onNavigate('evidence', 'analysis')}
        >
          <div className="text-xl">⚡</div>
          <div className="text-[15px] font-bold text-white leading-snug">
            {analysis
              ? (t ? 'Вердикт AI Синтеза' : 'AI Synthesis Verdict')
              : (t ? 'Условие перехода в GO' : 'GO Condition')}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 leading-relaxed flex-1">
            {analysis
              ? (t ? 'Скептик и Оптимист проанализировали все риски и возможности ниши.' : 'Skeptic and Optimist analyzed all risks and opportunities.')
              : (t ? 'Арбитр найдёт конкретную нейтрализацию конфликтов между блоками.' : 'Arbiter will find specific conflict resolution across blocks.')}
          </div>
          <div className="flex items-center justify-between mt-auto">
            <span className="text-[11px] font-mono font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg">
              {analysis
                ? (t ? 'Посмотреть →' : 'View →')
                : (t ? 'Узнать условие GO' : 'Learn GO condition')}
            </span>
            <span className="text-[10px] font-mono text-zinc-600">
              {analysis ? '' : `20 ${t ? 'монет' : 'coins'}`}
            </span>
          </div>
        </div>

        {/* 72h Action Plan */}
        <div
          className="bg-zinc-900/50 border border-emerald-500/20 rounded-xl p-5 flex flex-col gap-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.03] to-transparent"
          onClick={() => onNavigate('action-plan', 's0')}
        >
          <div className="text-xl">🎯</div>
          <div className="text-[15px] font-bold text-white leading-snug">
            {t ? 'Что сделать за 72 часа' : 'What to do in 72 hours'}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 leading-relaxed flex-1">
            {t
              ? 'Конкретный план действий с бюджетом, сроком и критерием успеха.'
              : 'Specific action plan with budget, timeline and success criteria.'}
          </div>
          <div className="flex items-center justify-between mt-auto">
            <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              {t ? 'Открыть план →' : 'Open plan →'}
            </span>
            <span className="text-[10px] font-mono text-zinc-600">
              {t ? 'бесплатно' : 'free'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ ZONE 4: PATH ═══ */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-4">
          {t ? 'Твой путь' : 'Your Path'}
        </div>
        <div className="flex items-start">
          {pathSteps.map((step, i) => (
            <div key={step.id} className="flex-1 flex flex-col items-center gap-2 relative">
              {/* Connector line */}
              {i < pathSteps.length - 1 && (
                <div className={`absolute top-4 left-[60%] right-[-40%] h-px ${
                  step.status === 'done' ? 'bg-emerald-500/50' : 'bg-zinc-700'
                }`} />
              )}

              {/* Icon */}
              <div className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                step.status === 'done'
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : step.status === 'current'
                  ? 'bg-indigo-500/10 border border-indigo-500/30'
                  : 'bg-zinc-800 border border-zinc-700'
              }`}>
                {step.status === 'done' ? '✓' : step.status === 'locked' ? '🔒' : step.icon}
              </div>

              <div className={`text-[11px] font-semibold text-center ${
                step.status === 'locked' ? 'text-zinc-600' : 'text-white'
              }`}>
                {step.label}
              </div>

              {step.sub && (
                <div className="text-[9px] font-mono text-zinc-600 text-center leading-snug">
                  {step.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
