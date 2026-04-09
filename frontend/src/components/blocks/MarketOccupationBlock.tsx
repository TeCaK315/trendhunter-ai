'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';
import SourceCard from '../SourceCard';

interface CompetitorSize {
  domain: string;
  name: string;
  size: string | null;
  g2_reviews: number | null;
  primary_segment: string | null;
}

interface GapItem {
  category: string;
  type: 'strategic' | 'execution';
  quote: string;
  competitor: string;
  reasoning?: string;
}

interface CompetitionIntelligence {
  verdict_phrase?: string;
  verdict_sub?: string;
  gap_interpretation?: string;
  entry_interpretation?: string;
  competitor_size_interpretation?: string;
  window_urgency?: string;
  key_factors?: string[];
  block5_connection?: string;
  conclusion_green?: string;
  conclusion_yellow?: string;
  conclusion_red?: string;
}

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
      source: string;
      score: number;
    }>;
    total_signals: number;
  };
  differentiation: {
    feature_gaps_found: number;
    negative_reviews_found: number;
    positioning_opportunities: string[];
    opportunities_data_type: string;
    entry_point?: string | null;
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
  gap_type?: string;
  strategic_gap_summary?: string | null;
  entry_point_reasoning?: string | null;
  competitor_sizes?: CompetitorSize[];
  classification_details?: {
    total_reviews_analyzed: number;
    strategic_count: number;
    execution_count: number;
  } | null;
  feature_gap_matrix?: GapItem[] | null;
  pricing_benchmark?: Array<{ domain: string; segment: string; size: string | null }> | null;
  traffic_sources?: any | null;
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
    label?: string;
  };
  intelligence?: CompetitionIntelligence | null;
}

interface Props {
  data: MarketOccupationData | null;
  loading?: boolean;
  error?: string;
}

const sizeLabels: Record<string, string> = {
  micro: '< 100 клиентов',
  small: '100-1К клиентов',
  medium: '1К-10К клиентов',
  large: '10К+ клиентов',
};

const sizeColors: Record<string, string> = {
  micro: 'bg-zinc-700 text-zinc-300',
  small: 'bg-blue-900/30 text-blue-300',
  medium: 'bg-yellow-900/30 text-yellow-300',
  large: 'bg-red-900/30 text-red-300',
};

const gapTypeDisplay: Record<string, { label: string; color: string; desc: string }> = {
  strategic: { label: 'Strategic Gap', color: 'text-green-400', desc: 'Конкурент не может исправить' },
  execution: { label: 'Execution Gap', color: 'text-yellow-400', desc: 'Конкурент может исправить за квартал' },
  none: { label: 'Нет gap', color: 'text-red-400', desc: 'Поле закрыто' },
};

const categoryLabels: Record<string, string> = {
  pricing_model: 'Ценообразование',
  missing_feature: 'Отсутствует функция',
  ux_bug: 'UX / Баги',
  performance: 'Производительность',
  support: 'Поддержка',
  integration: 'Интеграции',
};

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
  const intel = data.intelligence;

  const displayedReviews = showAllReviews
    ? data.why_gaps_exist.negative_reviews
    : data.why_gaps_exist.negative_reviews.slice(0, 4);

  const displayedNeeds = showAllNeeds
    ? data.why_gaps_exist.unmet_needs
    : data.why_gaps_exist.unmet_needs.slice(0, 4);

  const displayedCompetitors = showAllCompetitors
    ? data.competitors_exist.competitors
    : data.competitors_exist.competitors.slice(0, 10);

  // Match competitor_sizes by domain for enrichment
  const sizeMap = new Map<string, CompetitorSize>();
  (data.competitor_sizes || []).forEach(cs => {
    sizeMap.set(cs.domain, cs);
    sizeMap.set(cs.name, cs);
  });

  const gapInfo = gapTypeDisplay[data.gap_type || 'none'] || gapTypeDisplay.none;

  return (
    <div className="space-y-4">
      {/* Verdict + Intelligence hero */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Возможности на рынке"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
        {intel?.verdict_phrase && (
          <div className="mt-3 pt-3 border-t border-zinc-700/50">
            <p className="text-sm font-medium text-white">{intel.verdict_phrase}</p>
            {intel.verdict_sub && (
              <p className="text-xs text-zinc-400 mt-1">{intel.verdict_sub}</p>
            )}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-xl font-bold">{data.competitors_exist.count}</div>
          <div className="text-xs text-zinc-400">Конкурентов</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-sm text-zinc-300">{data.red_ocean.saturation_score.level}</div>
          <div className="text-xs text-zinc-400 mt-1">Насыщенность</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className={`text-sm font-bold ${gapInfo.color}`}>{gapInfo.label}</div>
          <div className="text-xs text-zinc-400 mt-1">{gapInfo.desc}</div>
        </div>
      </div>

      {/* Gap interpretation from Intelligence */}
      {intel?.gap_interpretation && (
        <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px]">⚡</span>
            <span className="text-xs font-medium text-indigo-300">Тип gap — AI-интерпретация</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">{intel.gap_interpretation}</p>
        </div>
      )}

      {/* Warning if no competitors */}
      {data.competitors_exist.no_competitors_is_bad && (
        <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
          <p className="text-sm text-orange-300">{data.competitors_exist.note}</p>
        </div>
      )}

      {/* Section: Competitors with sizes */}
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
                {displayedCompetitors.map((c, i) => {
                  const sizeInfo = sizeMap.get(c.name) || sizeMap.get(c.website?.replace('https://', '') || '');
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-700 last:border-0">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.name}</span>
                          {sizeInfo?.size && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${sizeColors[sizeInfo.size] || 'bg-zinc-700 text-zinc-300'}`}>
                              {sizeLabels[sizeInfo.size] || sizeInfo.size}
                            </span>
                          )}
                          {sizeInfo?.g2_reviews != null && sizeInfo.g2_reviews > 0 && (
                            <span className="text-[10px] text-zinc-500">{sizeInfo.g2_reviews} G2 отзывов</span>
                          )}
                        </div>
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
                  );
                })}
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
            {intel?.competitor_size_interpretation && (
              <div className="mt-3 bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-xs font-medium text-indigo-300">Размер конкурентов — AI-интерпретация</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{intel.competitor_size_interpretation}</p>
              </div>
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
            {/* Structured gap items from feature_gap_matrix */}
            {data.feature_gap_matrix && data.feature_gap_matrix.length > 0 && (
              <div className="space-y-2">
                {data.feature_gap_matrix.map((g, i) => (
                  <div key={i} className={`rounded-lg p-3 ${g.type === 'strategic' ? 'bg-green-900/15 border border-green-800/30' : 'bg-zinc-800/50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${g.type === 'strategic' ? 'bg-green-900/30 text-green-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
                        {g.type === 'strategic' ? 'STRATEGIC' : 'EXECUTION'}
                      </span>
                      <span className="text-xs text-zinc-400">{categoryLabels[g.category] || g.category}</span>
                      <span className="text-xs text-zinc-500">@ {g.competitor}</span>
                    </div>
                    <p className="text-sm text-zinc-300 italic">&ldquo;{g.quote}&rdquo;</p>
                    {g.reasoning && (
                      <p className="text-xs text-zinc-400 mt-1">{g.reasoning}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Legacy negative reviews */}
            {data.why_gaps_exist.negative_reviews.length > 0 && !data.feature_gap_matrix && (
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
                <h4 className="text-xs font-medium text-zinc-400 mb-2">Execution Gaps</h4>
                {displayedNeeds.map((n, i) => (
                  <SourceCard
                    key={i}
                    title={n.title}
                    url={n.url}
                    source={n.source || "g2"}
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
            {data.why_gaps_exist.total_signals === 0 && !data.feature_gap_matrix && (
              <p className="text-sm text-zinc-400">Пробелы не обнаружены</p>
            )}
          </div>
        )}
      </div>

      {/* Section: Competitor Complaints */}
      {data.competitor_complaints && data.competitor_complaints.entries.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('complaints')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Жалобы на конкурентов</span>
              <EvidenceBadge type="real_data" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'complaints' ? '−' : '+'}</span>
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
                          <span className="text-xs text-red-300 font-medium">{categoryLabels[cat.category] || cat.category}</span>
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

      {/* Section: Differentiation + Entry Point */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('diff')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Дифференциация</span>
            <EvidenceBadge type="ai_synthesis" />
          </div>
          <span className="text-zinc-500">{expandedSection === 'diff' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'diff' && (
          <div className="px-3 pb-3 space-y-3">
            {/* Strategic gap summary */}
            {data.strategic_gap_summary && (
              <div className="p-3 border border-green-800/30 rounded-lg bg-green-950/20">
                <p className="text-xs text-green-400 mb-1">Почему конкурент не может ответить</p>
                <p className="text-sm text-zinc-300">{data.strategic_gap_summary}</p>
              </div>
            )}

            {/* Entry point */}
            {data.differentiation.entry_point && (
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-400 mb-1">Точка входа</p>
                <p className="text-sm text-white font-medium">{data.differentiation.entry_point}</p>
              </div>
            )}

            {/* Entry point reasoning */}
            {data.entry_point_reasoning && (
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-400 mb-1">Обоснование точки входа</p>
                <p className="text-sm text-zinc-300">{data.entry_point_reasoning}</p>
              </div>
            )}

            {/* Positioning vectors */}
            <ul className="space-y-2">
              {data.differentiation.positioning_opportunities.map((opp, i) => (
                <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5 shrink-0">{i + 1}.</span>
                  {typeof opp === 'string' ? opp : JSON.stringify(opp)}
                </li>
              ))}
            </ul>

            {/* Intelligence interpretations */}
            {intel?.entry_interpretation && (
              <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-xs font-medium text-indigo-300">Точка входа — AI-интерпретация</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{intel.entry_interpretation}</p>
              </div>
            )}
            {intel?.window_urgency && (
              <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-xs font-medium text-indigo-300">Временное окно</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{intel.window_urgency}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Intelligence: Key factors + connection to Block 5 */}
      {intel?.key_factors && intel.key_factors.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-3 space-y-2">
          <div className="text-xs text-zinc-400 font-medium">Ключевые факторы диагноза</div>
          {intel.key_factors.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-indigo-400 mt-0.5 shrink-0">{i + 1}.</span>
              <span className="text-zinc-300">{f}</span>
            </div>
          ))}
          {intel.block5_connection && (
            <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-700/50">
              → Блок 5: {intel.block5_connection}
            </div>
          )}
        </div>
      )}

      {/* Intelligence: Conclusion by diagnosis */}
      {intel && (data.verdict.label === 'green' || data.verdict.label === 'yellow' || data.verdict.label === 'red') && (
        <div className={`rounded-xl border p-3 ${
          data.verdict.label === 'green' ? 'bg-green-900/15 border-green-800/30' :
          data.verdict.label === 'yellow' ? 'bg-yellow-900/15 border-yellow-800/30' :
          'bg-red-900/15 border-red-800/30'
        }`}>
          <div className={`text-xs font-medium mb-1 ${
            data.verdict.label === 'green' ? 'text-green-400' :
            data.verdict.label === 'yellow' ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            Итог
          </div>
          <p className="text-sm text-zinc-300">
            {data.verdict.label === 'green' ? intel.conclusion_green :
             data.verdict.label === 'yellow' ? intel.conclusion_yellow :
             intel.conclusion_red}
          </p>
        </div>
      )}
    </div>
  );
}
