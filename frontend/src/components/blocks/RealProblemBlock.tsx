'use client';

import React, { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface PainCluster {
  pain_summary: string;
  source_count: number;
  mention_count: number;
  confidence: 'high' | 'medium' | 'low';
  category: string;
}

interface CompetitorMention {
  competitor: string;
  mention_count: number;
  sentiment: 'negative' | 'neutral';
}

interface RealProblemData {
  who_hurts: {
    complaints: Array<{
      text: string;
      source: string;
      source_url: string;
      engagement: number;
      data_type: string;
      pain_category?: string;
      confidence?: string;
    }>;
    total_complaints: number;
    sources_count: number;
    severity_score: { value: number; formula?: string; confidence: number };
    pain_clusters?: PainCluster[];
    weighted_score?: number;
  };
  how_often: {
    google_trends: { growth_rate: number; search_query: string; original_query?: string; google_trends_url: string } | null;
    all_sources?: Array<{ name: string; count: number }>;
    reddit_post_count: number;
    so_question_count: number;
    frequency_score: { value: number; formula?: string; confidence: number };
    dynamics?: string;
    dynamics_ratio?: number;
    pain_is_chronic?: boolean;
  };
  current_solutions: {
    reviews: Array<{ title: string; url: string; snippet: string; source: string; rating?: number }>;
    total_reviews: number;
    pain_distribution?: Record<string, number>;
    competitor_mentions?: CompetitorMention[];
  };
  willingness_to_pay: {
    pricing_data: Array<{ competitor: string; pricing_url: string; pricing_snippet: string; prices_found: Array<{ amount: string; plan: string; period?: string }> }>;
    paid_solution_count: number;
    paying_score?: number;
    paying_ratio?: number;
    context?: string;
  };
  verdict: { value: number; formula?: string; confidence: number; label?: string; verdict_text?: string };
  ai_summary?: { text: string; data_type: string } | null;
  _raw_diagnosis?: string;
  _distribution?: Record<string, number>;
  _block_context?: any;
  _competitive_positives?: Array<{ product: string; text: string; source: string }>;
  intelligence?: IntelligenceOutput | null;
}

interface IntelligenceOutput {
  analysis_summary: string;
  verdict_phrase: string;
  verdict_sub: string;
  key_factors: string[];
  counterfact: string;
  card_signal: { label: string; explanation: string; source_breakdown: string };
  card_dynamics: { label: string; explanation: string; is_chronic: boolean; chronic_explanation: string };
  card_paying: { label: string; explanation: string; context: string };
  pain_types_analysis: { dominant_type: string; dominant_strategy: string; other_types_note: string };
  clusters_enriched: Array<{ cluster_name: string; strategic_meaning: string; block4_connection: string }>;
  analytical_context: string;
  top_quote: string;
  top_quote_source: string;
  [key: string]: unknown;
}

interface Props {
  data: RealProblemData | null;
  loading?: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════
// STYLES (injected once)
// ═══════════════════════════════════════════════════════════

const CUSTOM_STYLES = `
@keyframes pb-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes pb-barIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes pb-fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes pb-pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,238,154,.18)}60%{box-shadow:0 0 0 6px transparent}}

.pb-shimmer-line{
  height:2px;
  background:linear-gradient(90deg,transparent,#00EE9A,#00CFFF,#00EE9A,transparent);
  background-size:200%;
  animation:pb-shimmer 4s linear infinite;
}
.pb-bar-anim{transform-origin:left;animation:pb-barIn .8s .3s ease both;transform:scaleX(0)}
.pb-fade{animation:pb-fadeUp .5s ease both}
.pb-pulse-dot{animation:pb-pulse 2.4s ease-in-out infinite}
.pb-card{
  background:#0D1620;
  border:1px solid #1A2E42;
  border-radius:12px;
  transition:border-color .2s,transform .15s;
}
.pb-card:hover{border-color:#243C55;transform:translateY(-1px)}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = CUSTOM_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

const C = {
  green: '#00EE9A', green2: '#00BB78', amber: '#FFA826', cyan: '#00CFFF', red: '#FF4E5B',
  t1: '#E8F2FF', t2: '#7AAAC8', t3: '#3E6480', t4: '#243A52',
  card: '#0D1620', card2: '#111E2A', b1: '#1A2E42', b2: '#243C55',
};

function diagLabel(d: string): { text: string; color: string; bg: string; border: string } {
  if (d === 'green') return { text: 'GO · Боль реальная', color: C.green, bg: 'rgba(0,238,154,.08)', border: C.green2 };
  if (d === 'red') return { text: 'NO · Сигнал слабый', color: C.red, bg: 'rgba(255,78,91,.08)', border: '#CC3E47' };
  return { text: 'WAIT · Требует внимания', color: C.amber, bg: 'rgba(255,168,38,.08)', border: '#CC8620' };
}

function sourceWeight(name: string): string {
  const w: Record<string, string> = { g2: 'max weight', capterra: 'max weight', trustpilot: 'high', reddit: 'medium', hackernews: 'medium', stackoverflow: 'medium', quora: 'low' };
  return w[name] || 'low';
}

function sourceDotColor(name: string): string {
  const c: Record<string, string> = { g2: C.green, capterra: C.green, trustpilot: C.cyan, reddit: C.t3, hackernews: C.t3, stackoverflow: C.t3, quora: C.t3 };
  return c[name] || C.t3;
}

function sourceDisplayName(name: string): string {
  const n: Record<string, string> = { g2: 'G2 Reviews', capterra: 'Capterra', trustpilot: 'Trustpilot', reddit: 'Reddit', hackernews: 'HackerNews', stackoverflow: 'StackOverflow', quora: 'Quora' };
  return n[name] || name;
}

// ═══════════════════════════════════════════════════════════
// INTELLIGENCE LOADING INDICATOR
// ═══════════════════════════════════════════════════════════

function IntelligenceLoadingIndicator({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (show) { setVisible(true); const t = setTimeout(() => setVisible(false), 30000); return () => clearTimeout(t); }
    else { setVisible(false); }
  }, [show]);
  if (!visible) return null;
  return (
    <div className="pb-card p-4" style={{ borderLeft: `3px solid ${C.cyan}` }}>
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: C.cyan, borderTopColor: 'transparent' }} />
        <span className="text-xs" style={{ color: C.t2 }}>AI анализирует результаты...</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function RealProblemBlock({ data, loading, error }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => { injectStyles(); }, []);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-4 bg-zinc-800 rounded w-1/2 animate-pulse" />
        <div className="h-24 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-32 bg-zinc-800 rounded animate-pulse" />
          <div className="h-32 bg-zinc-800 rounded animate-pulse" />
          <div className="h-32 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }
  if (error) return <div className="p-4 text-red-400 text-sm">{error}</div>;
  if (!data) return <div className="p-4 text-sm" style={{ color: C.t3 }}>Нажмите &quot;Анализировать&quot; для запуска</div>;

  const intel = data.intelligence;
  const diagnosis = data._raw_diagnosis || 'yellow';
  const diag = diagLabel(diagnosis);
  const score = data.verdict.value;
  const distribution = data._distribution || data.current_solutions.pain_distribution || {};
  const weightedScore = data.who_hurts.weighted_score || 0;
  const payingRatio = data.willingness_to_pay.paying_ratio || 0;
  const payingScore = data.willingness_to_pay.paying_score || 0;
  const ctx = data.willingness_to_pay.context || 'mixed';
  const clusters = data.who_hurts.pain_clusters || [];
  const allSources = data.how_often.all_sources || [];
  const totalCollected = data._block_context?.data_quality?.total_collected || 0;
  const runCount = data._block_context?.run_count || data._block_context?.data_quality?.run_count || 1;
  const mergedFromPrevious = data._block_context?.data_quality?.merged_from_previous || 0;

  const dynamicsRatio = data.how_often.dynamics_ratio || 1.0;
  const dynamicsGrowth = Math.round((dynamicsRatio - 1) * 100);
  const dynamicsLabel = data.how_often.dynamics === 'growing' ? 'GROWING' : data.how_often.dynamics === 'declining' ? 'DECLINING' : 'STABLE';
  const dynamicsColor = data.how_often.dynamics === 'growing' ? C.green : data.how_often.dynamics === 'declining' ? C.red : C.amber;

  // Distribution sorted
  const distEntries = Object.entries(distribution).sort((a, b) => (b[1] as number) - (a[1] as number));
  const dominantType = distEntries[0]?.[0] || 'bad_solution';
  const painLabels: Record<string, string> = { bad_solution: 'Плохое решение', no_solution: 'Нет решения', expensive_solution: 'Дорогое решение' };
  const painDescs: Record<string, string> = {
    bad_solution: 'Платят конкурентам и злятся.',
    no_solution: 'Нужно обучать рынок. Длинный цикл.',
    expensive_solution: 'Flat pricing = быстрые продажи.',
  };

  // Paying audience label
  const payingLabel = payingScore >= 60 ? 'STRONG' : payingScore >= 35 ? 'MIXED' : 'WEAK';
  const payingColor = payingScore >= 60 ? C.cyan : payingScore >= 35 ? C.amber : C.red;

  // Confidence label
  const confLabel = data._block_context?.data_quality?.classification_confidence?.toUpperCase() || (weightedScore >= 60 ? 'HIGH' : weightedScore >= 30 ? 'MEDIUM' : 'LOW');

  return (
    <div className="space-y-3">

      {/* ═══ HEADER STATS ═══ */}
      <div className="flex items-center justify-between pb-3 pb-fade" style={{ borderBottom: `1px solid ${C.b1}` }}>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: C.t3 }}>
          Блок 1 · <span style={{ color: C.t1 }}>Проблема</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: C.t3 }}>
          <div className="w-1.5 h-1.5 rounded-full pb-pulse-dot" style={{ background: C.green }} />
          <span>{data.who_hurts.total_complaints} валидных{mergedFromPrevious > 0 ? ` (+${mergedFromPrevious} из прошлых)` : ''}</span>
          <span style={{ color: C.b2 }}>·</span>
          <span>{data.who_hurts.sources_count} платформ</span>
          {runCount > 1 && (
            <>
              <span style={{ color: C.b2 }}>·</span>
              <span>запуск #{runCount}</span>
            </>
          )}
        </div>
      </div>

      {/* ═══ VERDICT HERO ═══ */}
      <div className="pb-card relative overflow-hidden pb-fade" style={{ animationDelay: '.05s' }}>
        <div className="pb-shimmer-line" />
        <div className="p-5">
          <div className="flex gap-6">
            {/* Left: verdict */}
            <div className="flex-1 min-w-0">
              {/* Diagnosis pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3" style={{ background: diag.bg, border: `1px solid ${diag.border}`, color: diag.color, letterSpacing: '.04em' }}>
                <div className="w-1.5 h-1.5 rounded-full pb-pulse-dot" style={{ background: diag.color }} />
                {diag.text}
              </div>

              {/* Verdict headline */}
              <h2 className="text-lg font-bold leading-snug mb-1.5" style={{ color: C.t1 }}>
                {intel?.verdict_phrase || data.verdict.verdict_text || 'Анализ проблемы завершён'}
              </h2>
              <p className="text-xs leading-relaxed mb-3" style={{ color: C.t2 }}>
                {intel?.verdict_sub || data.verdict.formula || ''}
              </p>

              {/* Key factors as signals */}
              <div className="space-y-1.5">
                {(intel?.key_factors || []).slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-[9px] font-bold mt-px" style={{ background: 'rgba(0,238,154,.08)', color: C.green }}>✓</div>
                    <span style={{ color: C.t2 }}>{f}</span>
                  </div>
                ))}
                {intel?.counterfact && (
                  <div className="flex items-start gap-2 text-xs">
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-[9px] font-bold mt-px" style={{ background: 'rgba(255,168,38,.08)', color: C.amber }}>⏳</div>
                    <span style={{ color: C.amber }}>{intel.counterfact}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Score box */}
            <div className="w-36 shrink-0 rounded-xl p-4 text-center" style={{ background: C.card2, border: `1px solid ${C.b1}` }}>
              <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: C.t3 }}>Score</div>
              <div className="text-3xl font-extrabold leading-none" style={{ color: diag.color }}>
                {score.toFixed(1)}
                <span className="text-sm" style={{ color: C.t3 }}>/10</span>
              </div>
              <div className="mt-2">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: C.b1 }}>
                  <div className="h-full rounded-full pb-bar-anim" style={{ width: `${score * 10}%`, background: diag.color }} />
                </div>
                <div className="text-[10px] text-right mt-1 font-mono" style={{ color: C.t3 }}>{Math.round(score * 10)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3 METRIC CARDS ═══ */}
      <div className="grid grid-cols-3 gap-3 pb-fade" style={{ animationDelay: '.12s' }}>

        {/* Card 1: Signal Strength */}
        <div className="pb-card relative overflow-hidden p-4">
          <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% -10%, rgba(0,238,154,.14), transparent 70%)` }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,238,154,.08)', border: '1px solid rgba(0,238,154,.12)' }}>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><rect x="2" y="10" width="3" height="7" rx="1.5" fill={C.green}/><rect x="7.5" y="6.5" width="3" height="10.5" rx="1.5" fill={C.green} opacity=".65"/><rect x="13" y="2" width="3" height="15" rx="1.5" fill={C.green} opacity=".38"/></svg>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,238,154,.08)', color: C.green, border: '1px solid rgba(0,238,154,.15)' }}>{confLabel}</span>
            </div>
            <div className="text-2xl font-extrabold leading-none" style={{ color: C.green }}>
              {Math.round(weightedScore)}<span className="text-xs" style={{ color: C.t3 }}>/100</span>
            </div>
            <div className="text-[8px] uppercase tracking-wider mt-0.5 mb-2" style={{ color: C.t3 }}>Взвешенный сигнал</div>
            <div className="h-0.5 rounded-full overflow-hidden mb-2" style={{ background: C.b1 }}>
              <div className="h-full rounded-full pb-bar-anim" style={{ width: `${Math.min(100, weightedScore)}%`, background: C.green }} />
            </div>
            <div className="border-t pt-2 space-y-1" style={{ borderColor: C.b1 }}>
              {allSources.slice(0, 7).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full" style={{ background: s.count > 0 ? sourceDotColor(s.name) : C.t4 }} />
                    <span style={{ color: s.count > 0 ? C.t2 : C.t4 }}>{sourceDisplayName(s.name)}</span>
                  </div>
                  <span className="font-mono" style={{ color: s.count > 0 ? C.t3 : C.t4 }}>
                    {s.count > 0 ? `${s.count} · ${sourceWeight(s.name)}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Market Dynamics */}
        <div className="pb-card relative overflow-hidden p-4">
          <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% -10%, rgba(255,168,38,.12), transparent 70%)` }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,168,38,.08)', border: '1px solid rgba(255,168,38,.12)' }}>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M2 14l4.5-5.5 3.5 2.5L16 4" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 4h4v4" stroke={C.amber} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,168,38,.08)', color: dynamicsColor, border: '1px solid rgba(255,168,38,.15)' }}>{dynamicsLabel}</span>
            </div>
            <div className="text-2xl font-extrabold leading-none" style={{ color: dynamicsColor }}>
              {dynamicsGrowth >= 0 ? '+' : ''}{dynamicsGrowth}%
            </div>
            <div className="text-[8px] uppercase tracking-wider mt-0.5 mb-3" style={{ color: C.t3 }}>За 3 месяца</div>
            {/* Ratio comparison pills */}
            <div className="flex gap-1.5 mb-2">
              <div className="px-2 py-0.5 rounded text-[10px]" style={{ background: C.card2, border: `1px solid ${C.b1}`, color: C.t2 }}>
                ×{dynamicsRatio.toFixed(2)}
              </div>
              {data.how_often.pain_is_chronic && (
                <div className="px-2 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,168,38,.06)', border: '1px solid rgba(255,168,38,.15)', color: C.amber }}>
                  Хроническая
                </div>
              )}
            </div>
            {data.how_often.pain_is_chronic && (
              <p className="text-[10px] leading-relaxed" style={{ color: C.t3 }}>Хроническая боль 12+ мес · стабильный рынок</p>
            )}
          </div>
        </div>

        {/* Card 3: Paying Audience */}
        <div className="pb-card relative overflow-hidden p-4">
          <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% -10%, rgba(0,207,255,.12), transparent 70%)` }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,207,255,.08)', border: '1px solid rgba(0,207,255,.12)' }}>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke={C.cyan} strokeWidth="1.6" fill="none"/><path d="M3.5 16c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke={C.cyan} strokeWidth="1.6" strokeLinecap="round" fill="none"/></svg>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,207,255,.08)', color: payingColor, border: '1px solid rgba(0,207,255,.15)' }}>{payingLabel}</span>
            </div>
            {/* Donut-style display */}
            <div className="flex justify-center my-1">
              <svg width="64" height="64" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="30" fill="none" stroke={C.b1} strokeWidth="8"/>
                <circle cx="40" cy="40" r="30" fill="none" stroke={payingColor} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(payingRatio / 100) * 188.5} 188.5`}
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dasharray .8s ease' }}
                />
                <text x="40" y="44" textAnchor="middle" fill={C.t1} fontSize="14" fontWeight="800">{payingRatio}%</text>
              </svg>
            </div>
            <div className="text-[8px] uppercase tracking-wider text-center mb-2" style={{ color: C.t3 }}>Платящих покупателей</div>
            <div className="border-t pt-2 space-y-1" style={{ borderColor: C.b1 }}>
              <div className="flex items-start gap-1.5 text-[10px]">
                <div className="w-1 h-1 rounded-full mt-1 shrink-0" style={{ background: C.cyan }} />
                <span style={{ color: C.t2 }}>Score: {payingScore}</span>
              </div>
              <div className="flex items-start gap-1.5 text-[10px]">
                <div className="w-1 h-1 rounded-full mt-1 shrink-0" style={{ background: C.cyan }} />
                <span style={{ color: C.t2 }}>{ctx.toUpperCase()} · {ctx === 'b2b' ? 'длинный цикл продажи' : ctx === 'b2c' ? 'решение за дни' : 'смешанная аудитория'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PAIN DISTRIBUTION ═══ */}
      {distEntries.length > 0 && (
        <div className="pb-card p-4 pb-fade" style={{ animationDelay: '.19s' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold" style={{ color: C.t2 }}>Распределение типов боли</span>
            <div className="flex-1 h-px" style={{ background: C.b1 }} />
          </div>
          <div className="grid grid-cols-3">
            {distEntries.map(([key, pct], i) => (
              <div key={key} className="px-4 relative" style={{ paddingLeft: i === 0 ? 0 : undefined }}>
                {i < distEntries.length - 1 && (
                  <div className="absolute right-0 top-[5%] bottom-[5%] w-px" style={{ background: C.b1 }} />
                )}
                <div className="text-2xl font-extrabold leading-none" style={{ color: i === 0 ? C.amber : C.t3 }}>
                  {pct as number}%
                </div>
                <div className="text-xs font-bold mt-0.5 mb-1" style={{ color: i === 0 ? C.t1 : C.t2 }}>
                  {painLabels[key] || key}
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: C.t3 }}>{painDescs[key] || ''}</p>
                {i === 0 && intel?.pain_types_analysis?.dominant_strategy && (
                  <p className="text-[10px] italic mt-1 leading-relaxed" style={{ color: C.t2 }}>→ {intel.pain_types_analysis.dominant_strategy}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ PAIN CLUSTERS ═══ */}
      {clusters.length > 0 && (
        <div className="pb-card p-4 pb-fade" style={{ animationDelay: '.26s' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold" style={{ color: C.t2 }}>Подтверждённые кластеры боли</span>
            <div className="flex-1 h-px" style={{ background: C.b1 }} />
          </div>
          <div className="divide-y" style={{ borderColor: C.b1 }}>
            {clusters.map((cluster, i) => {
              const enriched = intel?.clusters_enriched?.[i];
              const isHigh = cluster.confidence === 'high';
              const confColor = isHigh ? C.green : cluster.confidence === 'medium' ? C.amber : C.t3;
              const confBg = isHigh ? 'rgba(0,238,154,.08)' : cluster.confidence === 'medium' ? 'rgba(255,168,38,.08)' : 'rgba(62,100,128,.08)';
              const confBorder = isHigh ? 'rgba(0,238,154,.15)' : cluster.confidence === 'medium' ? 'rgba(255,168,38,.15)' : 'rgba(62,100,128,.15)';

              // Find matching complaint for quote
              const quote = data.who_hurts.complaints.find(c => c.pain_category === cluster.category);

              return (
                <div key={i} className="py-3 relative first:pt-0 last:pb-0" style={{ borderColor: C.b1 }}>
                  {/* Left accent bar */}
                  <div className="absolute left-[-16px] top-3 bottom-3 w-[2px] rounded-r" style={{ background: confColor }} />

                  {/* Header */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xs font-bold" style={{ color: C.t1 }}>{enriched?.cluster_name || cluster.pain_summary}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: confBg, color: confColor, border: `1px solid ${confBorder}` }}>
                      {cluster.confidence.toUpperCase()} · {cluster.source_count} ист.
                    </span>
                    <span className="ml-auto text-[10px] font-mono" style={{ color: C.t3 }}>{cluster.mention_count} упоминаний</span>
                  </div>

                  {/* Body: quote + insight */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      {quote && (
                        <div className="rounded-lg p-2.5" style={{ background: C.card2, borderLeft: `2px solid ${C.b2}` }}>
                          <p className="text-[11px] italic leading-relaxed" style={{ color: C.t1 }}>{quote.text}</p>
                          <p className="text-[9px] font-mono mt-1" style={{ color: C.t3 }}>{quote.source}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-between">
                      {enriched?.strategic_meaning && (
                        <p className="text-[11px] leading-relaxed" style={{ color: C.t3 }}>{enriched.strategic_meaning}</p>
                      )}
                      {enriched?.block4_connection && (
                        <div className="flex items-center gap-1 text-[10px] mt-1" style={{ color: C.cyan, opacity: 0.8 }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                          {enriched.block4_connection}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ COMPETITIVE POSITIVES (Capterra) ═══ */}
      {(data._competitive_positives || []).length > 0 && (
        <div className="pb-card p-4 pb-fade" style={{ animationDelay: '.30s' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold" style={{ color: C.t2 }}>Что нравится пользователям у конкурентов</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,238,154,.06)', color: C.green, border: '1px solid rgba(0,238,154,.12)' }}>Capterra</span>
            <div className="flex-1 h-px" style={{ background: C.b1 }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(data._competitive_positives || []).slice(0, 6).map((pos, i) => (
              <div key={i} className="rounded-lg p-2.5" style={{ background: C.card2, borderLeft: `2px solid ${C.b2}` }}>
                <div className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: C.cyan }}>{pos.product}</div>
                <p className="text-[10px] leading-relaxed" style={{ color: C.t2 }}>{pos.text.slice(0, 200)}{pos.text.length > 200 ? '...' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ BOTTOM ROW: CONCLUSION + INTELLIGENCE ═══ */}
      <div className="grid grid-cols-2 gap-3 pb-fade" style={{ animationDelay: '.33s' }}>

        {/* Conclusion */}
        <div className="pb-card p-4">
          {/* Diagnosis badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-base font-extrabold mb-2" style={{ background: `${diag.bg}`, border: `1px solid ${diag.border}30`, color: diag.color }}>
            {diagnosis === 'green' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            {diagnosis === 'green' ? 'GO' : diagnosis === 'red' ? 'NO' : 'WAIT'}
          </div>
          <h3 className="text-[11px] font-bold mb-1" style={{ color: C.t2 }}>Итог · Блок 1 → Проблема</h3>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: C.t2 }}>
            {intel?.[`conclusion_${diagnosis}`] as string || data.verdict.verdict_text || ''}
          </p>
          {/* Flow chain */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="px-2 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(0,238,154,.05)', border: `1px solid rgba(0,238,154,.15)`, color: C.green }}>{dominantType}</span>
            <span className="text-[10px]" style={{ color: C.t4 }}>→</span>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono" style={{ background: C.card2, border: `1px solid ${C.b1}`, color: C.t3 }}>
              {dominantType === 'bad_solution' ? 'короткий цикл' : dominantType === 'no_solution' ? 'educate market' : 'ценовая война'}
            </span>
            <span className="text-[10px]" style={{ color: C.t4 }}>→</span>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(0,207,255,.05)', border: '1px solid rgba(0,207,255,.15)', color: C.cyan }}>Блок 3</span>
          </div>
        </div>

        {/* Intelligence Layer */}
        <div className="pb-card p-4" style={{ borderLeft: `3px solid ${C.green}`, borderRadius: '0 12px 12px 0' }}>
          <div className="text-[8px] uppercase tracking-[.12em] mb-2" style={{ color: C.cyan, opacity: 0.8 }}>Intelligence Layer · Аналитический контекст</div>
          <p className="text-[11px] leading-[1.75]" style={{ color: C.t2 }}>
            {intel?.analytical_context || data.ai_summary?.text || 'Intelligence Layer загружается...'}
          </p>
        </div>
      </div>

      {/* Intelligence loading */}
      <IntelligenceLoadingIndicator show={!data.intelligence && !loading && (data.who_hurts?.total_complaints ?? 0) > 0} />

      {/* ═══ SOURCES BAR (collapsible) ═══ */}
      <div className="pb-card overflow-hidden pb-fade" style={{ animationDelay: '.40s' }}>
        <button
          onClick={() => setSourcesOpen(!sourcesOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] transition-colors hover:bg-[#111E2A]"
          style={{ color: C.t3 }}
        >
          <div className="flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Источники · {data.who_hurts.total_complaints} валидных постов · {allSources.filter(s => s.count > 0).map(s => sourceDisplayName(s.name)).join(', ')}
          </div>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transform: sourcesOpen ? 'rotate(180deg)' : '', transition: 'transform .25s' }}>
            <path d="M2.5 4.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ maxHeight: sourcesOpen ? '400px' : '0', overflow: 'hidden', transition: 'max-height .35s ease' }}>
          {/* Header row */}
          <div className="grid grid-cols-4 px-4 py-2 text-[9px] uppercase tracking-wider" style={{ background: C.card2, borderTop: `1px solid ${C.b1}`, color: C.t3 }}>
            <div>Платформа</div>
            <div className="text-right">Собрано</div>
            <div className="text-right">Прошло</div>
            <div className="text-right">%</div>
          </div>
          {allSources.map((s, i) => {
            const total = totalCollected > 0 ? Math.round(s.count / data.who_hurts.total_complaints * totalCollected / allSources.length) : s.count * 3;
            const pct = total > 0 ? Math.round((s.count / Math.max(total, s.count)) * 100) : 0;
            const pctColor = pct >= 70 ? C.green : pct >= 40 ? C.amber : C.t3;
            return (
              <div key={i} className="grid grid-cols-4 px-4 py-2 text-[11px] transition-colors hover:bg-[#111E2A]" style={{ borderTop: `1px solid ${C.b1}` }}>
                <div className="flex items-center gap-2" style={{ color: C.t2 }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: sourceDotColor(s.name) }} />
                  {sourceDisplayName(s.name)}
                </div>
                <div className="text-right" style={{ color: C.t3 }}>{total}</div>
                <div className="text-right" style={{ color: pct >= 70 ? C.green : C.t3 }}>{s.count}</div>
                <div className="text-right font-mono" style={{ color: pctColor }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
