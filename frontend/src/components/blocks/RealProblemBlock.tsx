'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';
import SourceCard from '../SourceCard';

interface RealProblemData {
  who_hurts: {
    complaints: Array<{
      text: string;
      source: string;
      source_url: string;
      engagement: number;
      data_type: string;
    }>;
    total_complaints: number;
    sources_count: number;
    severity_score: {
      value: number;
      formula?: string;
      confidence: number;
    };
  };
  how_often: {
    google_trends: {
      growth_rate: number;
      search_query: string;
      original_query?: string;
      google_trends_url: string;
    } | null;
    reddit_post_count: number;
    so_question_count: number;
    frequency_score: {
      value: number;
      formula?: string;
      confidence: number;
    };
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
  };
  willingness_to_pay: {
    pricing_data: Array<{
      competitor: string;
      pricing_url: string;
      pricing_snippet: string;
      prices_found: Array<{ amount: string; plan: string; period?: string }>;
    }>;
    paid_solution_count: number;
  };
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
  };
  ai_summary?: {
    text: string;
    data_type: string;
  } | null;
}

interface Props {
  data: RealProblemData | null;
  loading?: boolean;
  error?: string;
}

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

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Реальность проблемы"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
      </div>

      {/* AI Summary */}
      {data.ai_summary && (
        <div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20">
          <div className="flex items-center gap-2 mb-1">
            <EvidenceBadge type="ai_synthesis" />
            <span className="text-xs text-yellow-300 font-medium">Краткий вывод</span>
          </div>
          <p className="text-sm text-zinc-300">{data.ai_summary.text}</p>
        </div>
      )}

      {/* Section 1: Who hurts */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('who_hurts')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">У кого болит</span>
            <EvidenceBadge type="real_data" />
            <span className="text-xs text-zinc-400">{data.who_hurts.total_complaints} жалоб из {data.who_hurts.sources_count} источников</span>
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
            <div className="mt-3 space-y-2">
              {visibleComplaints.map((c, i) => (
                <SourceCard
                  key={i}
                  title={c.text}
                  url={c.source_url}
                  source={c.source}
                  engagement={c.engagement}
                  dataType="real_data"
                />
              ))}
              {data.who_hurts.complaints.length > 5 && (
                <button
                  onClick={() => setShowAllComplaints(!showAllComplaints)}
                  className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {showAllComplaints ? 'Свернуть' : `Показать ещё ${data.who_hurts.complaints.length - 5}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: How often */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('how_often')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Как часто</span>
            <EvidenceBadge type="calculated" />
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

      {/* Section 3: Current solutions */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('solutions')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Текущие решения</span>
            <EvidenceBadge type="real_data" />
            <span className="text-xs text-zinc-400">{data.current_solutions.total_reviews} отзывов</span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'solutions' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'solutions' && (
          <div className="px-3 pb-3 space-y-2">
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
              <p className="text-sm text-zinc-400">Отзывы не найдены</p>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Willingness to pay */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('willingness')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Готовность платить</span>
            <EvidenceBadge type="real_data" />
            <span className="text-xs text-zinc-400">{data.willingness_to_pay.paid_solution_count} платных решений</span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'willingness' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'willingness' && (
          <div className="px-3 pb-3 space-y-3">
            {data.willingness_to_pay.pricing_data.filter(pd => pd.pricing_url || pd.prices_found.length > 0).map((pd, i) => (
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
                {pd.prices_found.length > 0 ? (
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
            {data.willingness_to_pay.pricing_data.filter(pd => pd.pricing_url || pd.prices_found.length > 0).length === 0 && (
              <p className="text-sm text-zinc-400">Данные о ценах не найдены</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
