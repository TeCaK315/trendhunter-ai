'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';
import SourceCard from '../SourceCard';

interface MarketOccupationData {
  competitors_exist: {
    count: number;
    competitors: Array<{ name: string; website?: string; target_market?: string }>;
    no_competitors_is_bad: boolean;
    note: string;
  };
  why_gaps_exist: {
    negative_reviews: Array<{
      title: string;
      url: string;
      snippet: string;
      source: string;
    }>;
    unmet_needs: Array<{
      title: string;
      url: string;
      subreddit: string;
      score: number;
    }>;
    total_signals: number;
  };
  differentiation: {
    feature_gaps_found: number;
    negative_reviews_found: number;
    positioning_opportunities: string[];
    opportunities_data_type: string;
  };
  red_ocean: {
    saturation_score: {
      level: string;
      formula: string;
    };
    blue_ocean_score: {
      value: number;
      formula?: string;
      confidence: number;
    };
  };
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
  };
}

interface Props {
  data: MarketOccupationData | null;
  loading?: boolean;
  error?: string;
}

export default function MarketOccupationBlock({ data, loading, error }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showAllNeeds, setShowAllNeeds] = useState(false);
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-20 bg-zinc-800 rounded" />
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-400 text-sm">{error}</div>;
  if (!data) return <div className="p-4 text-zinc-400 text-sm">Нажмите &quot;Анализировать&quot; для запуска</div>;

  const toggle = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  const saturationColors: Record<string, string> = {
    low: 'text-green-300 bg-green-500/20',
    medium: 'text-yellow-300 bg-yellow-500/20',
    high: 'text-red-300 bg-red-500/20',
  };

  const displayedReviews = showAllReviews
    ? data.why_gaps_exist.negative_reviews
    : data.why_gaps_exist.negative_reviews.slice(0, 4);

  const displayedNeeds = showAllNeeds
    ? data.why_gaps_exist.unmet_needs
    : data.why_gaps_exist.unmet_needs.slice(0, 4);

  const displayedCompetitors = showAllCompetitors
    ? data.competitors_exist.competitors
    : data.competitors_exist.competitors.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Возможности на рынке"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-xl font-bold">{data.competitors_exist.count}</div>
          <div className="text-xs text-zinc-400">Конкурентов</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${saturationColors[data.red_ocean.saturation_score.level] || ''}`}>
            {data.red_ocean.saturation_score.level.toUpperCase()}
          </span>
          <div className="text-xs text-zinc-400 mt-1">Насыщенность</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-xl font-bold">{data.red_ocean.blue_ocean_score.value}</div>
          <div className="text-xs text-zinc-400">Blue Ocean</div>
        </div>
      </div>

      {/* Warning if no competitors */}
      {data.competitors_exist.no_competitors_is_bad && (
        <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
          <p className="text-sm text-orange-300">
            {data.competitors_exist.note}
          </p>
        </div>
      )}

      {/* Section: Competitors */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('competitors')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Конкуренты</span>
            <EvidenceBadge type="real_data" />
          </div>
          <span className="text-zinc-500">{expandedSection === 'competitors' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'competitors' && (
          <div className="px-3 pb-3">
            {data.competitors_exist.competitors.length > 0 ? (
              <div className="space-y-1">
                {displayedCompetitors.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-700 last:border-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{c.name}</span>
                      {c.website ? (
                        <a
                          href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          {c.website}
                        </a>
                      ) : (
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(c.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                        >
                          Найти в Google
                        </a>
                      )}
                    </div>
                    {c.target_market && <span className="text-xs text-zinc-400">{c.target_market}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Конкуренты не найдены</p>
            )}
            {data.competitors_exist.competitors.length > 10 && (
              <button
                onClick={() => setShowAllCompetitors(!showAllCompetitors)}
                className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {showAllCompetitors ? 'Свернуть' : `Показать ещё ${data.competitors_exist.competitors.length - 10}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section: Gaps */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('gaps')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Пробелы конкурентов</span>
            <EvidenceBadge type={data.why_gaps_exist.total_signals > 0 ? 'real_data' : 'no_data'} />
            <span className="text-xs text-zinc-400">{data.why_gaps_exist.total_signals > 0 ? `${data.why_gaps_exist.total_signals} сигналов` : 'Нет данных'}</span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'gaps' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'gaps' && (
          <div className="px-3 pb-3 space-y-3">
            {data.why_gaps_exist.negative_reviews.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-2">Негативные отзывы</h4>
                {displayedReviews.map((r, i) => (
                  <SourceCard
                    key={i}
                    title={r.title}
                    url={r.url}
                    source={r.source}
                    snippet={r.snippet}
                    dataType="real_data"
                  />
                ))}
                {data.why_gaps_exist.negative_reviews.length > 4 && (
                  <button
                    onClick={() => setShowAllReviews(!showAllReviews)}
                    className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showAllReviews ? 'Свернуть' : `Показать ещё ${data.why_gaps_exist.negative_reviews.length - 4}`}
                  </button>
                )}
              </div>
            )}
            {data.why_gaps_exist.unmet_needs.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-2">Неудовлетворённые потребности</h4>
                {displayedNeeds.map((n, i) => (
                  <SourceCard
                    key={i}
                    title={n.title}
                    url={n.url}
                    source="reddit"
                    engagement={n.score}
                    dataType="real_data"
                  />
                ))}
                {data.why_gaps_exist.unmet_needs.length > 4 && (
                  <button
                    onClick={() => setShowAllNeeds(!showAllNeeds)}
                    className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showAllNeeds ? 'Свернуть' : `Показать ещё ${data.why_gaps_exist.unmet_needs.length - 4}`}
                  </button>
                )}
              </div>
            )}
            {data.why_gaps_exist.total_signals === 0 && (
              <p className="text-sm text-zinc-400">Пробелы не обнаружены</p>
            )}
          </div>
        )}
      </div>

      {/* Section: Differentiation */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('diff')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Дифференциация</span>
            <EvidenceBadge type={data.differentiation.opportunities_data_type === 'ai_synthesis' ? 'ai_synthesis' : 'no_data'} />
          </div>
          <span className="text-zinc-500">{expandedSection === 'diff' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'diff' && (
          <div className="px-3 pb-3">
            <ul className="space-y-2">
              {data.differentiation.positioning_opportunities.map((opp, i) => (
                <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">-</span>
                  {opp}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
