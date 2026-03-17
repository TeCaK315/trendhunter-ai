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
  feature_gap_matrix?: {
    features: Array<{ feature: string; competitors: Record<string, boolean> }>;
    competitors: string[];
  } | null;
  pricing_benchmark?: {
    entries: Array<{ competitor: string; plan: string; price: string; trial: boolean }>;
  } | null;
  traffic_sources?: {
    entries: Array<{ competitor: string; seo: number; ads: number; social: number; direct: number }>;
  } | null;
  competitor_complaints?: {
    entries: Array<{
      competitor: string;
      categories: Array<{ category: string; count: number; examples: string[] }>;
    }>;
  } | null;
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

      {/* Section: Feature Gap Matrix */}
      {data.feature_gap_matrix && data.feature_gap_matrix.features.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('feature_gap')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Feature Gap Analysis</span>
              <EvidenceBadge type="ai_synthesis" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'feature_gap' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'feature_gap' && (
            <div className="px-3 pb-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-2 pr-3 text-zinc-400 font-medium">Feature</th>
                    {data.feature_gap_matrix.competitors.map(c => (
                      <th key={c} className="text-center py-2 px-2 text-zinc-400 font-medium whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.feature_gap_matrix.features.map((f, i) => {
                    const allHave = data.feature_gap_matrix!.competitors.every(c => f.competitors[c]);
                    const noneHave = data.feature_gap_matrix!.competitors.every(c => !f.competitors[c]);
                    return (
                      <tr key={i} className={`border-b border-zinc-800 ${noneHave ? 'bg-green-500/5' : ''}`}>
                        <td className={`py-2 pr-3 ${noneHave ? 'text-green-300 font-medium' : 'text-zinc-300'}`}>
                          {f.feature}
                          {noneHave && <span className="ml-1 text-green-400 text-[10px]">GAP</span>}
                        </td>
                        {data.feature_gap_matrix!.competitors.map(c => (
                          <td key={c} className="text-center py-2 px-2">
                            {f.competitors[c]
                              ? <span className="text-green-400">{'\u2713'}</span>
                              : <span className="text-red-400">{'\u2717'}</span>
                            }
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[10px] text-zinc-500 mt-2">GAP = ни один конкурент не закрывает — возможность для вас</p>
            </div>
          )}
        </div>
      )}

      {/* Section: Pricing Benchmark */}
      {data.pricing_benchmark && data.pricing_benchmark.entries.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('pricing')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Ценообразование конкурентов</span>
              <EvidenceBadge type="ai_synthesis" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'pricing' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'pricing' && (
            <div className="px-3 pb-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-2 pr-3 text-zinc-400 font-medium">Конкурент</th>
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">План</th>
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">Цена</th>
                    <th className="text-center py-2 px-2 text-zinc-400 font-medium">Триал</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pricing_benchmark.entries.map((p, i) => (
                    <tr key={i} className="border-b border-zinc-800">
                      <td className="py-2 pr-3 text-zinc-300 font-medium">{p.competitor}</td>
                      <td className="py-2 px-2 text-zinc-400">{p.plan}</td>
                      <td className="py-2 px-2 text-green-300 font-medium">{p.price}</td>
                      <td className="py-2 px-2 text-center">
                        {p.trial ? <span className="text-green-400">{'\u2713'}</span> : <span className="text-zinc-600">{'\u2014'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Section: Traffic Sources */}
      {data.traffic_sources && data.traffic_sources.entries.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('traffic')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Источники трафика</span>
              <EvidenceBadge type="ai_synthesis" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'traffic' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'traffic' && (
            <div className="px-3 pb-3 space-y-3">
              {data.traffic_sources.entries.map((t, i) => (
                <div key={i}>
                  <div className="text-xs font-medium text-zinc-300 mb-1">{t.competitor}</div>
                  <div className="h-4 flex rounded overflow-hidden">
                    {t.seo > 0 && <div className="bg-blue-500" style={{ width: `${t.seo}%` }} title={`SEO: ${t.seo}%`} />}
                    {t.ads > 0 && <div className="bg-orange-500" style={{ width: `${t.ads}%` }} title={`Ads: ${t.ads}%`} />}
                    {t.social > 0 && <div className="bg-purple-500" style={{ width: `${t.social}%` }} title={`Social: ${t.social}%`} />}
                    {t.direct > 0 && <div className="bg-green-500" style={{ width: `${t.direct}%` }} title={`Direct: ${t.direct}%`} />}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 text-[10px] text-zinc-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> SEO</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Ads</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Social</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Direct</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section: Competitor Complaints */}
      {data.competitor_complaints && data.competitor_complaints.entries.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('complaints')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Жалобы на конкурентов</span>
              <EvidenceBadge type="real_data" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'complaints' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'complaints' && (
            <div className="px-3 pb-3 space-y-3">
              {data.competitor_complaints.entries.map((cc, i) => (
                <div key={i} className="bg-zinc-800/30 rounded-lg p-3">
                  <div className="text-sm font-medium text-zinc-200 mb-2">{cc.competitor}</div>
                  <div className="space-y-1.5">
                    {cc.categories.filter(cat => cat.count > 0).map((cat, j) => (
                      <div key={j}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-300 font-medium">{cat.category}</span>
                          <span className="text-[10px] text-zinc-500">({cat.count})</span>
                        </div>
                        {cat.examples.length > 0 && (
                          <div className="ml-3 mt-0.5">
                            {cat.examples.map((ex, k) => (
                              <p key={k} className="text-[11px] text-zinc-400 italic">&ldquo;{ex}&rdquo;</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
