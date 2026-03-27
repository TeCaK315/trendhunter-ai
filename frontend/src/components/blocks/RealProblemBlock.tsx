'use client';

import React, { useState, useEffect } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';
import SourceCard from '../SourceCard';

// ── Intelligence Loading with auto-hide ──
function IntelligenceLoadingIndicator({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 30000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [show]);
  if (!visible) return null;
  return (
    <div className="bg-indigo-500/5 rounded-xl p-4 border border-indigo-500/20 animate-pulse">
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-indigo-300">AI анализирует результаты...</span>
      </div>
    </div>
  );
}

// ── Types ──

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
    severity_score: {
      value: number;
      formula?: string;
      confidence: number;
    };
    pain_clusters?: PainCluster[];
    weighted_score?: number;
  };
  how_often: {
    google_trends: {
      growth_rate: number;
      search_query: string;
      original_query?: string;
      google_trends_url: string;
    } | null;
    all_sources?: Array<{ name: string; count: number }>;
    reddit_post_count: number;
    so_question_count: number;
    frequency_score: {
      value: number;
      formula?: string;
      confidence: number;
    };
    dynamics?: string;
    dynamics_ratio?: number;
    pain_is_chronic?: boolean;
  };
  current_solutions: {
    reviews: Array<{
      title: string;
      url: string;
      snippet: string;
      source: string;
      rating?: number;
    }>;
    total_reviews: number;
    pain_distribution?: Record<string, number>;
    competitor_mentions?: CompetitorMention[];
  };
  willingness_to_pay: {
    pricing_data: Array<{
      competitor: string;
      pricing_url: string;
      pricing_snippet: string;
      prices_found: Array<{ amount: string; plan: string; period?: string }>;
    }>;
    paid_solution_count: number;
    paying_score?: number;
    paying_ratio?: number;
    context?: string;
  };
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
    label?: string;
    verdict_text?: string;
  };
  ai_summary?: {
    text: string;
    data_type: string;
  } | null;
  _raw_diagnosis?: string;
  _distribution?: Record<string, number>;
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
  [key: string]: unknown; // conclusion_green, conclusion_yellow, conclusion_red
}

interface Props {
  data: RealProblemData | null;
  loading?: boolean;
  error?: string;
}

// ── Sub-components ──

function FrustrationThermometer({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(10, value));
  const percentage = clampedValue * 10;

  const getColor = () => {
    if (clampedValue <= 3) return 'from-green-500 to-green-400';
    if (clampedValue <= 5) return 'from-yellow-500 to-yellow-400';
    if (clampedValue <= 7) return 'from-orange-500 to-orange-400';
    return 'from-red-600 to-red-400';
  };

  const getLabel = () => {
    if (clampedValue <= 3) return 'Низкая фрустрация';
    if (clampedValue <= 5) return 'Умеренная фрустрация';
    if (clampedValue <= 7) return 'Высокая фрустрация';
    return 'Критическая фрустрация';
  };

  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-400">Уровень фрустрации</span>
        <span className="text-sm font-bold">{clampedValue.toFixed(1)}/10</span>
      </div>
      <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getColor()} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-zinc-400 mt-1">{getLabel()}</div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors = {
    high: 'bg-green-500/20 text-green-300',
    medium: 'bg-yellow-500/20 text-yellow-300',
    low: 'bg-zinc-500/20 text-zinc-400',
  };
  const labels = { high: '3+ источника', medium: '2 источника', low: '1 источник' };
  const c = confidence as keyof typeof colors;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[c] || colors.low}`}>
      {labels[c] || confidence}
    </span>
  );
}

function PainDistributionBar({ distribution }: { distribution: Record<string, number> }) {
  const categories = [
    { key: 'bad_solution', label: 'Плохая реализация', color: 'bg-orange-500' },
    { key: 'no_solution', label: 'Нет решений', color: 'bg-red-500' },
    { key: 'expensive_solution', label: 'Слишком дорого', color: 'bg-yellow-500' },
  ];

  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="text-xs text-zinc-400 mb-2">Распределение типов боли</div>
      <div className="h-3 rounded-full overflow-hidden flex">
        {categories.map(({ key, color }) => {
          const pct = distribution[key] || 0;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className={`${color} h-full transition-all`}
              style={{ width: `${pct}%` }}
              title={`${pct}%`}
            />
          );
        })}
      </div>
      <div className="flex gap-3 mt-2">
        {categories.map(({ key, label, color }) => {
          const pct = distribution[key] || 0;
          if (pct === 0) return null;
          return (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-xs text-zinc-400">{label} {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Intelligence Layer Section ──

function IntelligenceSection({ intel, diagnosis }: { intel: IntelligenceOutput; diagnosis: string }) {
  const conclusionKey = `conclusion_${diagnosis}` as string;
  const conclusion = (intel[conclusionKey] as string) || '';

  const signalColor = intel.card_signal.label === 'Высокий' ? 'text-green-400' :
    intel.card_signal.label === 'Средний' ? 'text-yellow-400' : 'text-red-400';

  const dynamicsColor = intel.card_dynamics.label === 'Растёт' ? 'text-green-400' :
    intel.card_dynamics.label === 'Хроническая' ? 'text-amber-400' :
    intel.card_dynamics.label === 'Падает' ? 'text-red-400' : 'text-zinc-300';

  return (
    <div className="space-y-3">
      {/* Verdict from Sonnet */}
      <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20">
        <div className="flex items-center gap-2 mb-2">
          <EvidenceBadge type="ai_synthesis" />
          <span className="text-xs text-indigo-300 font-medium">AI Аналитика</span>
        </div>
        <p className="text-base font-semibold text-white">{intel.verdict_phrase}</p>
        <p className="text-sm text-zinc-400 mt-1">{intel.verdict_sub}</p>
      </div>

      {/* Three cards: Signal / Dynamics / Paying */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Сигнал боли</div>
          <div className={`text-sm font-bold ${signalColor}`}>{intel.card_signal.label}</div>
          <p className="text-xs text-zinc-400 mt-1">{intel.card_signal.source_breakdown}</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Динамика</div>
          <div className={`text-sm font-bold ${dynamicsColor}`}>{intel.card_dynamics.label}</div>
          {intel.card_dynamics.is_chronic && (
            <p className="text-xs text-amber-300/80 mt-1">{intel.card_dynamics.chronic_explanation}</p>
          )}
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Аудитория</div>
          <div className="text-sm font-bold text-zinc-200">{intel.card_paying.label}</div>
          <p className="text-xs text-zinc-400 mt-1">{intel.card_paying.context}</p>
        </div>
      </div>

      {/* Key factors */}
      <div className="bg-zinc-800/30 rounded-lg p-3">
        <div className="text-xs text-zinc-500 mb-2">Ключевые факторы</div>
        <ul className="space-y-1">
          {intel.key_factors.map((f, i) => (
            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pain type strategy */}
      <div className="bg-zinc-800/30 rounded-lg p-3">
        <div className="text-xs text-zinc-500 mb-1">Стратегия входа</div>
        <p className="text-sm text-zinc-300">{intel.pain_types_analysis.dominant_strategy}</p>
        {intel.pain_types_analysis.other_types_note && (
          <p className="text-xs text-zinc-500 mt-1">{intel.pain_types_analysis.other_types_note}</p>
        )}
      </div>

      {/* Enriched clusters — strategic meaning + block4 connection */}
      {intel.clusters_enriched.length > 0 && (
        <div className="bg-zinc-800/30 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-2">Кластеры боли — стратегический анализ</div>
          <div className="space-y-3">
            {intel.clusters_enriched.map((c, i) => (
              <div key={i} className="border-l-2 border-indigo-500/30 pl-3">
                <p className="text-sm text-zinc-200">{c.cluster_name}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{c.strategic_meaning}</p>
                <p className="text-xs text-indigo-400/80 mt-0.5">{c.block4_connection}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top quote */}
      {intel.top_quote && (
        <div className="bg-zinc-800/30 rounded-lg p-3 border-l-2 border-orange-500/40">
          <p className="text-sm text-zinc-300 italic">&ldquo;{intel.top_quote}&rdquo;</p>
          <span className="text-xs text-zinc-500 mt-1">— {intel.top_quote_source}</span>
        </div>
      )}

      {/* Analytical context */}
      {intel.analytical_context && (
        <div className="bg-zinc-800/30 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Контекст</div>
          <p className="text-sm text-zinc-400 leading-relaxed">{intel.analytical_context}</p>
        </div>
      )}

      {/* Conclusion */}
      {conclusion && (
        <div className={`rounded-lg p-3 ${
          diagnosis === 'green' ? 'bg-green-500/10 border border-green-500/20' :
          diagnosis === 'red' ? 'bg-red-500/10 border border-red-500/20' :
          'bg-yellow-500/10 border border-yellow-500/20'
        }`}>
          <div className="text-xs text-zinc-500 mb-1">Итог</div>
          <p className="text-sm text-zinc-200">{conclusion}</p>
        </div>
      )}

      {/* Counterfact */}
      {intel.counterfact && (
        <p className="text-xs text-zinc-500 italic px-1">{intel.counterfact}</p>
      )}
    </div>
  );
}

// ── Main Component ──

export default function RealProblemBlock({ data, loading, error }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAllComplaints, setShowAllComplaints] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-20 bg-zinc-800 rounded" />
        <div className="h-20 bg-zinc-800 rounded" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">{error}</div>;
  }

  if (!data) {
    return <div className="p-4 text-zinc-400 text-sm">Нажмите &quot;Анализировать&quot; для запуска</div>;
  }

  const toggle = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const visibleComplaints = showAllComplaints
    ? data.who_hurts.complaints
    : data.who_hurts.complaints.slice(0, 5);

  const visibleReviews = showAllReviews
    ? data.current_solutions.reviews
    : data.current_solutions.reviews.slice(0, 5);

  const distribution = data._distribution || data.current_solutions.pain_distribution || {};
  const diagnosis = data._raw_diagnosis || '';

  // Category labels for pain_category
  const categoryLabels: Record<string, string> = {
    bad_solution: 'Плохая реализация',
    expensive_solution: 'Слишком дорого',
    no_solution: 'Нет решений',
  };

  // Dynamics label
  const dynamicsLabel = data.how_often.dynamics === 'growing'
    ? 'Растёт'
    : data.how_often.dynamics === 'declining'
    ? 'Падает'
    : 'Стабильно';

  return (
    <div className="space-y-4">
      {/* Verdict + Human-readable text */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Реальность проблемы"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
        {data.verdict.verdict_text && (
          <p className="text-sm text-zinc-300 mt-3 leading-relaxed">
            {data.verdict.verdict_text}
          </p>
        )}
        {data.verdict.label && (
          <div className={`inline-block mt-2 text-xs font-medium px-2 py-1 rounded ${
            diagnosis === 'green' ? 'bg-green-500/20 text-green-300' :
            diagnosis === 'red' ? 'bg-red-500/20 text-red-300' :
            'bg-yellow-500/20 text-yellow-300'
          }`}>
            {data.verdict.label}
          </div>
        )}
      </div>

      {/* Intelligence Layer — Sonnet analysis */}
      {data.intelligence && (
        <IntelligenceSection intel={data.intelligence} diagnosis={diagnosis} />
      )}

      {/* Intelligence Layer loading indicator — auto-hide after 30s */}
      <IntelligenceLoadingIndicator show={!data.intelligence && !loading && (data.who_hurts?.total_complaints ?? 0) > 0} />

      {/* AI Summary fallback (key_factors — если Intelligence Layer не загрузился) */}
      {!data.intelligence && data.ai_summary && (
        <div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20">
          <div className="flex items-center gap-2 mb-1">
            <EvidenceBadge type="ai_synthesis" />
            <span className="text-xs text-yellow-300 font-medium">Ключевые факторы</span>
          </div>
          <p className="text-sm text-zinc-300">{data.ai_summary.text}</p>
        </div>
      )}

      {/* Pain Distribution Bar */}
      {Object.keys(distribution).length > 0 && (
        <PainDistributionBar distribution={distribution} />
      )}

      {/* Section 1: У кого болит (Pain Clusters) */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('who_hurts')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">У кого болит</span>
            <EvidenceBadge type={data.who_hurts.total_complaints > 0 ? 'real_data' : 'no_data'} />
            <span className="text-xs text-zinc-400">
              {data.who_hurts.total_complaints > 0
                ? `${data.who_hurts.total_complaints} жалоб из ${data.who_hurts.sources_count} источников`
                : 'Нет данных'}
            </span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'who_hurts' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'who_hurts' && (
          <div className="px-3 pb-3 space-y-2">
            <ScoreDisplay
              value={data.who_hurts.severity_score.value}
              label="Серьёзность проблемы"
              formula={data.who_hurts.severity_score.formula}
              confidence={data.who_hurts.severity_score.confidence}
            />
            <FrustrationThermometer value={data.who_hurts.severity_score.value} />

            {/* Pain clusters with confidence badges — не кликабельные (кластер = агрегат нескольких постов) */}
            <div className="mt-3 space-y-2">
              {visibleComplaints.map((c, i) => (
                <div key={i} className="border-l-2 border-red-500/40 pl-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-zinc-200">{c.text}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-zinc-500">{c.source}</span>
                        {c.engagement > 0 && (
                          <span className="text-xs text-zinc-400">{c.engagement} упоминаний</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-1">
                      {c.pain_category && (
                        <span className="text-xs text-zinc-500">
                          {categoryLabels[c.pain_category] || c.pain_category}
                        </span>
                      )}
                      {c.confidence && <ConfidenceBadge confidence={c.confidence} />}
                    </div>
                  </div>
                </div>
              ))}
              {data.who_hurts.complaints.length > 5 && (
                <button
                  onClick={() => setShowAllComplaints(!showAllComplaints)}
                  className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {showAllComplaints ? 'Свернуть' : `Показать ещё ${data.who_hurts.complaints.length - 5}`}
                </button>
              )}
              {data.who_hurts.complaints.length === 0 && (
                <p className="text-sm text-zinc-400">Кластеров боли не обнаружено</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Как часто */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('how_often')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Как часто</span>
            <EvidenceBadge type="calculated" />
            {data.how_often.dynamics && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                data.how_often.dynamics === 'growing' ? 'bg-green-500/20 text-green-300' :
                data.how_often.dynamics === 'declining' ? 'bg-red-500/20 text-red-300' :
                'bg-zinc-500/20 text-zinc-300'
              }`}>
                {dynamicsLabel}
                {data.how_often.dynamics_ratio && data.how_often.dynamics_ratio !== 1.0
                  ? ` (×${data.how_often.dynamics_ratio})`
                  : ''}
              </span>
            )}
          </div>
          <span className="text-zinc-500">{expandedSection === 'how_often' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'how_often' && (
          <div className="px-3 pb-3 space-y-3">
            <ScoreDisplay
              value={data.how_often.frequency_score.value}
              label="Частота упоминаний"
              formula={data.how_often.frequency_score.formula}
              confidence={data.how_often.frequency_score.confidence}
            />
            {/* Хроническая боль */}
            {data.how_often.pain_is_chronic && (
              <div className="bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                <span className="text-xs text-amber-300">Хроническая боль — проблема существует давно, не только последние месяцы</span>
              </div>
            )}
            {/* Все источники динамически */}
            {data.how_often.all_sources && data.how_often.all_sources.length > 0 ? (
              <div className="grid gap-2 text-center" style={{
                gridTemplateColumns: `repeat(${Math.min(data.how_often.all_sources.length, 4)}, 1fr)`
              }}>
                {data.how_often.all_sources.map((src, i) => (
                  <div key={i} className="bg-zinc-800/50 rounded p-2">
                    <div className="text-lg font-bold">{src.count}</div>
                    <div className="text-xs text-zinc-400 capitalize">{src.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="text-lg font-bold">{data.how_often.reddit_post_count}</div>
                  <div className="text-xs text-zinc-400">Reddit</div>
                </div>
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="text-lg font-bold">{data.how_often.so_question_count}</div>
                  <div className="text-xs text-zinc-400">Stack Overflow</div>
                </div>
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="text-lg font-bold">
                    {data.how_often.google_trends ? `${data.how_often.google_trends.growth_rate}%` : '—'}
                  </div>
                  <div className="text-xs text-zinc-400">Trends рост</div>
                </div>
              </div>
            )}
            {data.how_often.google_trends && (
              <a
                href={data.how_often.google_trends.google_trends_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 block"
              >
                Google Trends: &quot;{data.how_often.google_trends.original_query || data.how_often.google_trends.search_query}&quot;
              </a>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Текущие решения (Paying Signals — НЕ дубликат) */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('solutions')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Текущие решения</span>
            <EvidenceBadge type={data.current_solutions.total_reviews > 0 ? 'real_data' : 'no_data'} />
            <span className="text-xs text-zinc-400">
              {data.current_solutions.total_reviews > 0
                ? `${data.current_solutions.total_reviews} платящих пользователей`
                : 'Платящих не найдено'}
            </span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'solutions' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'solutions' && (
          <div className="px-3 pb-3 space-y-2">
            {/* Competitor mentions */}
            {data.current_solutions.competitor_mentions && data.current_solutions.competitor_mentions.length > 0 && (
              <div className="bg-zinc-800/50 rounded-lg p-3 mb-2">
                <div className="text-xs text-zinc-400 mb-2">Упомянутые конкуренты</div>
                <div className="flex flex-wrap gap-2">
                  {data.current_solutions.competitor_mentions.map((c, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        c.sentiment === 'negative'
                          ? 'bg-red-500/10 text-red-300'
                          : 'bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {c.competitor}
                      <span className="text-zinc-500">({c.mention_count})</span>
                      {c.sentiment === 'negative' && <span className="text-red-400">-</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Paying signals */}
            {visibleReviews.map((r, i) => (
              <SourceCard
                key={i}
                title={r.title}
                url={r.url}
                source={r.source}
                snippet={r.snippet}
                rating={r.rating}
                dataType="real_data"
              />
            ))}
            {data.current_solutions.reviews.length > 5 && (
              <button
                onClick={() => setShowAllReviews(!showAllReviews)}
                className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {showAllReviews ? 'Свернуть' : `Показать ещё ${data.current_solutions.reviews.length - 5}`}
              </button>
            )}
            {data.current_solutions.reviews.length === 0 && (
              <p className="text-sm text-zinc-400">Платящих пользователей не найдено в данной нише</p>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Готовность платить */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('willingness')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Готовность платить</span>
            <EvidenceBadge type={data.willingness_to_pay.paid_solution_count > 0 ? 'real_data' : 'no_data'} />
            <span className="text-xs text-zinc-400">
              {data.willingness_to_pay.paid_solution_count > 0
                ? `${data.willingness_to_pay.paid_solution_count} платящих`
                : 'Нет данных'}
            </span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'willingness' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'willingness' && (
          <div className="px-3 pb-3 space-y-3">
            {(data.willingness_to_pay.paying_ratio !== undefined && data.willingness_to_pay.paying_ratio > 0) && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-800/50 rounded p-2">
                    <div className="text-lg font-bold text-green-400">{data.willingness_to_pay.paying_ratio}%</div>
                    <div className="text-xs text-zinc-400">Платящие юзеры</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded p-2">
                    <div className="text-lg font-bold">{data.willingness_to_pay.paid_solution_count}</div>
                    <div className="text-xs text-zinc-400">Платят сейчас</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded p-2">
                    <div className="text-lg font-bold uppercase">{data.willingness_to_pay.context || '—'}</div>
                    <div className="text-xs text-zinc-400">Контекст</div>
                  </div>
                </div>
                {/* Paying score bar */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">Уверенность в готовности платить</span>
                    <span className="text-sm font-bold">{data.willingness_to_pay.paying_score || 0}</span>
                  </div>
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (data.willingness_to_pay.paying_score || 0) >= 40 ? 'bg-green-500' :
                        (data.willingness_to_pay.paying_score || 0) >= 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, ((data.willingness_to_pay.paying_score || 0) / 100) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {(data.willingness_to_pay.paying_score || 0) >= 40 ? 'Высокая готовность — люди уже платят за решения' :
                     (data.willingness_to_pay.paying_score || 0) >= 20 ? 'Средняя — часть пользователей платит' :
                     'Низкая — мало сигналов об оплате'}
                  </div>
                </div>
              </div>
            )}
            {/* Pricing cards если есть */}
            {data.willingness_to_pay.pricing_data.filter(pd => pd.pricing_url || pd.prices_found?.length > 0).map((pd, i) => (
              <div key={i} className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{pd.competitor}</span>
                  {pd.pricing_url && (
                    <a
                      href={pd.pricing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Страница цен
                    </a>
                  )}
                </div>
                {pd.prices_found?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pd.prices_found.map((p, j) => (
                      <span key={j} className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-300 rounded text-xs">
                        {p.amount}
                        <span className="text-zinc-500">
                          {p.period === 'yr' ? '/год' : p.period === 'user/mo' ? '/юзер/мес' : '/мес'}
                        </span>
                        {p.plan && <span className="text-zinc-500">({p.plan})</span>}
                      </span>
                    ))}
                  </div>
                ) : pd.pricing_snippet ? (
                  <p className="text-xs text-zinc-400">{pd.pricing_snippet}</p>
                ) : null}
              </div>
            ))}
            {(!data.willingness_to_pay.paying_ratio || data.willingness_to_pay.paying_ratio === 0) &&
             data.willingness_to_pay.pricing_data.filter(pd => pd.pricing_url || pd.prices_found?.length > 0).length === 0 && (
              <p className="text-sm text-zinc-400">Данные о ценах не найдены. Детальные цены конкурентов — в блоке Продаваемость.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
