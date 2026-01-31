'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';
import { SourceListItem } from '../SourceCard';

interface DemandGrowthData {
  growing_or_dying: {
    trends_12m: {
      growth_rate: number;
      search_query: string;
      original_query?: string;
      google_trends_url: string;
      interest_timeline: Array<{ date: string; value: number }>;
    } | null;
    trends_3m: {
      growth_rate: number;
      search_query: string;
      original_query?: string;
      google_trends_url: string;
    } | null;
    growth_comparison: {
      value: number;
      formula?: string;
      confidence: number;
    };
    error?: string;
  };
  hype_or_stable: {
    stability_score: {
      value: number;
      formula?: string;
      confidence: number;
    };
    std_deviation: number;
    timeline_points: number;
  };
  new_players: {
    producthunt_launches: Array<{
      title: string;
      url: string;
      upvotes: number;
      snippet: string;
    }>;
    show_hn_posts: Array<{
      title: string;
      url: string;
      points: number;
      snippet: string;
    }>;
    funding_news: Array<{
      title: string;
      url: string;
      snippet: string;
      date?: string;
    }>;
    new_entrants_count: number;
  };
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
  };
}

interface Props {
  data: DemandGrowthData | null;
  loading?: boolean;
  error?: string;
}

export default function DemandGrowthBlock({ data, loading, error }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAllPH, setShowAllPH] = useState(false);
  const [showAllHN, setShowAllHN] = useState(false);
  const [showAllNews, setShowAllNews] = useState(false);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-32 bg-zinc-800 rounded" />
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

  // Simple sparkline
  const timeline = data.growing_or_dying.trends_12m?.interest_timeline || [];
  const maxVal = Math.max(...timeline.map(t => t.value), 1);

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Уровень спроса"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
      </div>

      {/* Section 1: Growing or dying */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('growth')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Растёт или умирает</span>
            <EvidenceBadge type="real_data" />
          </div>
          <span className="text-zinc-500">{expandedSection === 'growth' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'growth' && (
          <div className="px-3 pb-3 space-y-3">
            <ScoreDisplay
              value={data.growing_or_dying.growth_comparison.value}
              label="Динамика роста"
              formula={data.growing_or_dying.growth_comparison.formula}
              confidence={data.growing_or_dying.growth_comparison.confidence}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded p-3 text-center">
                <div className="text-xl font-bold">
                  {data.growing_or_dying.trends_12m ? `${data.growing_or_dying.trends_12m.growth_rate}%` : '—'}
                </div>
                <div className="text-xs text-zinc-400">Рост за 12 мес</div>
              </div>
              <div className="bg-zinc-800/50 rounded p-3 text-center">
                <div className="text-xl font-bold">
                  {data.growing_or_dying.trends_3m ? `${data.growing_or_dying.trends_3m.growth_rate}%` : '—'}
                </div>
                <div className="text-xs text-zinc-400">Рост за 3 мес</div>
              </div>
            </div>

            {/* Mini timeline chart */}
            {timeline.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-zinc-400 mb-1">Google Trends (12 мес)</div>
                <div className="flex items-end gap-0.5 h-16">
                  {timeline.map((point, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-indigo-500 rounded-t-sm hover:bg-indigo-400 transition-colors"
                      style={{ height: `${(point.value / maxVal) * 100}%`, minHeight: '2px' }}
                      title={`${point.date}: ${point.value}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {data.growing_or_dying.trends_12m && (
              <a
                href={data.growing_or_dying.trends_12m.google_trends_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 block"
              >
                Открыть в Google Trends
              </a>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Hype or stable */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('stability')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Хайп или устойчивый</span>
            <EvidenceBadge type="calculated" />
          </div>
          <span className="text-zinc-500">{expandedSection === 'stability' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'stability' && (
          <div className="px-3 pb-3 space-y-3">
            <ScoreDisplay
              value={data.hype_or_stable.stability_score.value}
              label="Стабильность тренда"
              formula={data.hype_or_stable.stability_score.formula}
              confidence={data.hype_or_stable.stability_score.confidence}
            />
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-zinc-800/50 rounded p-2">
                <div className="text-lg font-bold">{data.hype_or_stable.std_deviation}</div>
                <div className="text-xs text-zinc-400">Волатильность</div>
              </div>
              <div className="bg-zinc-800/50 rounded p-2">
                <div className="text-lg font-bold">{data.hype_or_stable.timeline_points}</div>
                <div className="text-xs text-zinc-400">Месяцев анализа</div>
              </div>
            </div>
            <div className="text-sm text-zinc-300 mt-2">
              {data.hype_or_stable.stability_score.value >= 7
                ? 'Стабильный тренд — устойчивый интерес'
                : data.hype_or_stable.stability_score.value >= 4
                ? 'Умеренная волатильность — возможен хайп'
                : 'Высокая волатильность — вероятно хайп'}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: New players */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('new_players')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Новые игроки</span>
            <EvidenceBadge type="real_data" />
            <span className="text-xs text-zinc-400">{data.new_players.new_entrants_count} найдено</span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'new_players' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'new_players' && (
          <div className="px-3 pb-3 space-y-3">
            {data.new_players.producthunt_launches.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-1">Product Hunt</h4>
                {(showAllPH ? data.new_players.producthunt_launches : data.new_players.producthunt_launches.slice(0, 3)).map((p, i) => (
                  <SourceListItem key={i} title={p.title} url={p.url} source="producthunt" metric={`${p.upvotes} upvotes`} />
                ))}
                {data.new_players.producthunt_launches.length > 3 && (
                  <button
                    onClick={() => setShowAllPH(!showAllPH)}
                    className="w-full py-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showAllPH ? 'Свернуть' : `+ ещё ${data.new_players.producthunt_launches.length - 3}`}
                  </button>
                )}
              </div>
            )}
            {data.new_players.show_hn_posts.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-1">Show HN</h4>
                {(showAllHN ? data.new_players.show_hn_posts : data.new_players.show_hn_posts.slice(0, 3)).map((p, i) => (
                  <SourceListItem key={i} title={p.title} url={p.url} source="hacker_news" metric={`${p.points} pts`} />
                ))}
                {data.new_players.show_hn_posts.length > 3 && (
                  <button
                    onClick={() => setShowAllHN(!showAllHN)}
                    className="w-full py-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showAllHN ? 'Свернуть' : `+ ещё ${data.new_players.show_hn_posts.length - 3}`}
                  </button>
                )}
              </div>
            )}
            {data.new_players.funding_news.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-1">Новости инвестиций</h4>
                {(showAllNews ? data.new_players.funding_news : data.new_players.funding_news.slice(0, 3)).map((n, i) => (
                  <SourceListItem key={i} title={n.title} url={n.url} source="google_news" metric={n.date || ''} />
                ))}
                {data.new_players.funding_news.length > 3 && (
                  <button
                    onClick={() => setShowAllNews(!showAllNews)}
                    className="w-full py-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showAllNews ? 'Свернуть' : `+ ещё ${data.new_players.funding_news.length - 3}`}
                  </button>
                )}
              </div>
            )}
            {data.new_players.new_entrants_count === 0 && (
              <p className="text-sm text-zinc-400">Новые игроки не найдены</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
