'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';

// ── Helpers ──────────────────────────────────────────────────
function adDensityText(density: number): string {
  if (density >= 0.5)
    return 'Больше половины выдачи — платная реклама. Конкуренты активно тратят бюджет — монетизация в нише работает.';
  if (density >= 0.2)
    return 'Есть платные конкуренты. Кто-то уже проверил что CAC окупается.';
  if (density > 0)
    return 'Мало рекламы. Либо нишевый B2B где не рекламируются, либо монетизация не отработана.';
  return 'Платной рекламы нет. Это тревожный сигнал — либо рынка нет, либо все работают только органически.';
}

function block1ConnectionText(painType?: string): string {
  if (painType === 'bad_solution')
    return 'Блок 1 подтвердил: люди платят конкурентам и злятся. Блок 2 проверяет: активно ли они ищут замену?';
  if (painType === 'no_solution')
    return 'Блок 1 подтвердил: решения не существует. Блок 2 проверяет: достаточно ли людей ищут его?';
  if (painType === 'expensive_solution')
    return 'Блок 1 подтвердил: решение есть но недоступно. Блок 2 проверяет: ищут ли люди более доступную альтернативу?';
  return 'Блок 1 подтвердил боль. Блок 2 проверяет: активно ли люди ищут решение?';
}

// ── Types ────────────────────────────────────────────────────
interface DemandIntelligence {
  verdict_phrase?: string;
  verdict_sub?: string;
  intent_interpretation?: string;
  ad_density_interpretation?: string;
  trend_interpretation?: string;
  competitors_interpretation?: string;
  seasonality_interpretation?: string;
  buying_stage_interpretation?: string;
  competitor_trend_interpretation?: string;
  key_factors?: string[];
  block3_connection?: string;
  conclusion_green?: string;
  conclusion_yellow?: string;
  conclusion_red?: string;
  hype_warning?: string;
}

interface DemandGrowthData {
  growing_or_dying: {
    trends_12m: {
      growth_rate: number | null;
      search_query: string;
      original_query?: string;
      google_trends_url: string;
      interest_timeline: Array<{ date: string; value: number }>;
    } | null;
    trends_3m: {
      growth_rate: number | null;
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
    new_entrants_count: number;
    competitors_found?: Array<{
      name: string;
      domain: string;
      source: string;
      query?: string;
      position?: number;
    }>;
  };
  search_intent?: {
    commercial_percent: number;
    informational_percent: number;
    commercial_signals: number;
    informational_signals: number;
    total_signals: number;
    intent_type: 'commercial' | 'mixed' | 'informational';
    top_keywords?: Array<{
      query: string;
      intent: string;
      volume: number;
    }>;
  };
  geo_breakdown?: Array<{
    region: string;
    label: string;
    value: number;
  }>;
  seasonality?: {
    monthly_avg: number[];
    peak_months: number[];
    low_months: number[];
    has_seasonality: boolean;
    current_phase: string;
    interpretation: string;
  } | null;
  buying_stage?: {
    awareness: number;
    consideration: number;
    decision: number;
    dominant_stage: 'awareness' | 'consideration' | 'decision';
    interpretation: string;
  } | null;
  competitor_trends?: Array<{
    name: string;
    domain: string;
    growth: number | null;
    direction: 'up' | 'down' | 'stable';
  }>;
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
    label?: string;
  };
  // Метаданные
  _block_context?: {
    serp_ad_density?: number;
    competitors_found?: Array<{ source: string; [k: string]: any }>;
    [k: string]: any;
  };
  _raw_diagnosis?: string;
  intelligence?: DemandIntelligence;
}

interface Props {
  data: DemandGrowthData | null;
  loading?: boolean;
  error?: string;
  block1Context?: { pain_type?: string; [k: string]: any } | null;
}

export default function DemandGrowthBlock({ data, loading, error, block1Context }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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

  const intel = data.intelligence;
  const serpAdDensity = data._block_context?.serp_ad_density ?? 0;
  const allCompetitors = data.new_players.competitors_found || [];
  const paidCount = allCompetitors.filter(c => c.source === 'paid').length;
  const diagnosis = data._raw_diagnosis || '';

  return (
    <div className="space-y-4">
      {/* Block 1 Connection */}
      <p className="text-xs text-zinc-500 italic">
        {block1ConnectionText(block1Context?.pain_type)}
      </p>

      {/* Verdict */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        {intel?.verdict_phrase ? (
          <div className="mb-3">
            <div className="text-lg font-semibold text-white">{intel.verdict_phrase}</div>
            {intel.verdict_sub && (
              <div className="text-sm text-zinc-400 mt-0.5">{intel.verdict_sub}</div>
            )}
          </div>
        ) : null}
        <ScoreDisplay
          value={data.verdict.value}
          label="Уровень спроса"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
      </div>

      {/* Hype Warning */}
      {intel?.hype_warning && intel.hype_warning.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <div className="text-xs font-medium text-red-400 mb-1">Предупреждение: хайп</div>
          <div className="text-sm text-red-300">{intel.hype_warning}</div>
        </div>
      )}

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
                  {data.growing_or_dying.trends_12m?.growth_rate != null
                    ? `${data.growing_or_dying.trends_12m.growth_rate > 500 ? '500+' : data.growing_or_dying.trends_12m.growth_rate}%`
                    : '—'}
                </div>
                <div className="text-xs text-zinc-400">Рост за 12 мес</div>
                {data.growing_or_dying.trends_12m?.growth_rate == null && (
                  <div className="text-xs text-zinc-500 mt-0.5">Недостаточно данных</div>
                )}
              </div>
              <div className="bg-zinc-800/50 rounded p-3 text-center">
                <div className="text-xl font-bold">
                  {data.growing_or_dying.trends_3m?.growth_rate != null
                    ? `${data.growing_or_dying.trends_3m.growth_rate > 500 ? '500+' : data.growing_or_dying.trends_3m.growth_rate}%`
                    : '—'}
                </div>
                <div className="text-xs text-zinc-400">Рост за 3 мес</div>
                {data.growing_or_dying.trends_3m?.growth_rate == null && (
                  <div className="text-xs text-zinc-500 mt-0.5">Недостаточно данных</div>
                )}
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

            {intel?.trend_interpretation && (
              <div className="text-sm text-zinc-300 mt-2 italic">{intel.trend_interpretation}</div>
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

      {/* Section 3: Search Intent */}
      {data.search_intent && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button
            onClick={() => toggle('intent')}
            className="w-full flex items-center justify-between p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Интент покупки</span>
              <EvidenceBadge type="calculated" />
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                data.search_intent.intent_type === 'commercial'
                  ? 'bg-green-500/20 text-green-300'
                  : data.search_intent.intent_type === 'mixed'
                  ? 'bg-yellow-500/20 text-yellow-300'
                  : 'bg-blue-500/20 text-blue-300'
              }`}>
                {data.search_intent.commercial_percent}% коммерческий
              </span>
            </div>
            <span className="text-zinc-500">{expandedSection === 'intent' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'intent' && (
            <div className="px-3 pb-3 space-y-3">
              <div className="h-4 bg-zinc-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${data.search_intent.commercial_percent}%` }}
                  title={`Коммерческий: ${data.search_intent.commercial_percent}%`}
                />
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${data.search_intent.informational_percent}%` }}
                  title={`Информационный: ${data.search_intent.informational_percent}%`}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Коммерческий ({data.search_intent.commercial_signals})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Информационный ({data.search_intent.informational_signals})
                </span>
              </div>
              <div className="text-sm text-zinc-300">
                {intel?.intent_interpretation
                  ? intel.intent_interpretation
                  : data.search_intent.intent_type === 'commercial'
                  ? 'Люди активно ищут решения для покупки — высокий потенциал монетизации'
                  : data.search_intent.intent_type === 'mixed'
                  ? 'Смешанный интент — есть и покупатели, и исследователи'
                  : 'Преимущественно информационные запросы — потребуется работа над конверсией'}
              </div>
              {/* Top Keywords */}
              {data.search_intent.top_keywords && data.search_intent.top_keywords.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-medium text-zinc-400 mb-1.5">Топ запросы</div>
                  <div className="space-y-1">
                    {data.search_intent.top_keywords.slice(0, 8).map((kw, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${
                          kw.intent === 'commercial'
                            ? 'bg-green-500/20 text-green-300'
                            : kw.intent === 'informational'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-zinc-700 text-zinc-400'
                        }`}>
                          {kw.intent === 'commercial' ? '$' : kw.intent === 'informational' ? 'i' : '?'}
                        </span>
                        <span className="text-zinc-300 flex-1 truncate">{kw.query}</span>
                        <span className="text-zinc-500 shrink-0">{kw.volume}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-zinc-500 mt-2">
                На основе {data.search_intent.total_signals} запросов Google Trends
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 4: Geographic breakdown */}
      {data.geo_breakdown && data.geo_breakdown.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button
            onClick={() => toggle('geo')}
            className="w-full flex items-center justify-between p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">География спроса</span>
              <EvidenceBadge type="real_data" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'geo' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'geo' && (
            <div className="px-3 pb-3 space-y-2">
              {(() => {
                const maxValue = Math.max(...data.geo_breakdown!.map(g => g.value), 1);
                return data.geo_breakdown!.map((geo, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-28 shrink-0">{geo.label}</span>
                    <div className="flex-1 h-5 bg-zinc-700/50 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all bg-indigo-500/70"
                        style={{ width: `${Math.min(100, (geo.value / maxValue) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-10 text-right text-zinc-300">
                      {geo.value}
                    </span>
                  </div>
                ));
              })()}
              <div className="text-xs text-zinc-500 mt-1">
                Относительный интерес по регионам (Google Trends, 100 = макс.)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 5: Конкуренты в SERP */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button
          onClick={() => toggle('new_players')}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Конкуренты в SERP</span>
            <EvidenceBadge type={data.new_players.new_entrants_count > 0 ? 'real_data' : 'no_data'} />
            <span className="text-xs text-zinc-400">{data.new_players.new_entrants_count > 0 ? `${data.new_players.new_entrants_count} найдено` : 'Нет данных'}</span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'new_players' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'new_players' && (
          <div className="px-3 pb-3 space-y-3">
            {/* SERP Ad Density — визуальные квадраты */}
            {serpAdDensity > 0 && (
              <div>
                <div className="text-xs font-medium text-zinc-400 mb-1.5">Рекламная плотность SERP</div>
                <div className="flex gap-1 mb-1.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded-sm ${
                        i < Math.round(serpAdDensity * 10)
                          ? 'bg-yellow-500'
                          : 'bg-zinc-700/50'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-zinc-400 ml-1 self-center">
                    {Math.round(serpAdDensity * 100)}%
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  {intel?.ad_density_interpretation || adDensityText(serpAdDensity)}
                </p>
              </div>
            )}

            {/* Paid competitors note */}
            {paidCount > 0 && (
              <p className="text-sm text-zinc-400">
                {paidCount} из {allCompetitors.length} конкурентов платят за рекламу — это доказывает что монетизация в нише работает
              </p>
            )}

            {/* Competitors interpretation from intelligence */}
            {intel?.competitors_interpretation && (
              <p className="text-sm text-zinc-300 italic">{intel.competitors_interpretation}</p>
            )}

            {data.new_players.competitors_found && data.new_players.competitors_found.length > 0 ? (
              <div className="space-y-1">
                {data.new_players.competitors_found.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-zinc-800/50 last:border-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                      c.source === 'paid' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {c.source === 'paid' ? 'ADS' : 'SEO'}
                    </span>
                    <a
                      href={`https://${c.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-400 hover:text-indigo-300 truncate"
                    >
                      {c.name}
                    </a>
                    <span className="text-xs text-zinc-500 shrink-0">{c.domain}</span>
                    {c.position && (
                      <span className="text-xs text-zinc-600 shrink-0">#{c.position}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Конкуренты не найдены в SERP</p>
            )}
          </div>
        )}
      </div>
      {/* Section 6: Seasonality */}
      {data.seasonality && data.seasonality.has_seasonality && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button
            onClick={() => toggle('seasonality')}
            className="w-full flex items-center justify-between p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Сезонность спроса</span>
              <EvidenceBadge type="calculated" />
              <span className="text-xs text-zinc-400">{data.seasonality.current_phase}</span>
            </div>
            <span className="text-zinc-500">{expandedSection === 'seasonality' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'seasonality' && (
            <div className="px-3 pb-3 space-y-3">
              {/* Monthly bars */}
              <div>
                <div className="text-xs text-zinc-400 mb-1.5">Средний интерес по месяцам (5 лет)</div>
                <div className="flex items-end gap-1 h-20">
                  {data.seasonality.monthly_avg.map((val, i) => {
                    const maxMonth = Math.max(...data.seasonality!.monthly_avg, 1);
                    const isPeak = data.seasonality!.peak_months.includes(i);
                    const isLow = data.seasonality!.low_months.includes(i);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className={`w-full rounded-t-sm transition-colors ${
                            isPeak ? 'bg-green-500' : isLow ? 'bg-red-500/70' : 'bg-zinc-600'
                          }`}
                          style={{ height: `${(val / maxMonth) * 100}%`, minHeight: '2px' }}
                          title={`${['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][i]}: ${Math.round(val)}`}
                        />
                        <span className="text-[9px] text-zinc-500">
                          {['Я','Ф','М','А','М','И','И','А','С','О','Н','Д'][i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Пик</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/70 inline-block" /> Спад</span>
                </div>
              </div>
              {data.seasonality.interpretation && (
                <p className="text-sm text-zinc-300 italic">{data.seasonality.interpretation}</p>
              )}
              {intel?.seasonality_interpretation && (
                <p className="text-sm text-zinc-400 italic">{intel.seasonality_interpretation}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 7: Buying Stage */}
      {data.buying_stage && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button
            onClick={() => toggle('buying_stage')}
            className="w-full flex items-center justify-between p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Стадия покупки</span>
              <EvidenceBadge type="calculated" />
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                data.buying_stage.dominant_stage === 'decision'
                  ? 'bg-green-500/20 text-green-300'
                  : data.buying_stage.dominant_stage === 'consideration'
                  ? 'bg-yellow-500/20 text-yellow-300'
                  : 'bg-blue-500/20 text-blue-300'
              }`}>
                {data.buying_stage.dominant_stage === 'decision' ? 'Решение'
                  : data.buying_stage.dominant_stage === 'consideration' ? 'Сравнение'
                  : 'Осведомлённость'}
              </span>
            </div>
            <span className="text-zinc-500">{expandedSection === 'buying_stage' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'buying_stage' && (
            <div className="px-3 pb-3 space-y-3">
              {/* 3-segment bar */}
              <div className="h-6 bg-zinc-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${data.buying_stage.awareness}%` }}
                  title={`Осведомлённость: ${data.buying_stage.awareness}%`}
                />
                <div
                  className="bg-yellow-500 h-full transition-all"
                  style={{ width: `${data.buying_stage.consideration}%` }}
                  title={`Сравнение: ${data.buying_stage.consideration}%`}
                />
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${data.buying_stage.decision}%` }}
                  title={`Решение: ${data.buying_stage.decision}%`}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Осведомлённость {data.buying_stage.awareness}%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                  Сравнение {data.buying_stage.consideration}%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Решение {data.buying_stage.decision}%
                </span>
              </div>
              {data.buying_stage.interpretation && (
                <p className="text-sm text-zinc-300 italic">{data.buying_stage.interpretation}</p>
              )}
              {intel?.buying_stage_interpretation && (
                <p className="text-sm text-zinc-400 italic">{intel.buying_stage_interpretation}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 8: Competitor Trends */}
      {data.competitor_trends && data.competitor_trends.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button
            onClick={() => toggle('competitor_trends')}
            className="w-full flex items-center justify-between p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Тренды конкурентов</span>
              <EvidenceBadge type="real_data" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'competitor_trends' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'competitor_trends' && (
            <div className="px-3 pb-3 space-y-1.5">
              {data.competitor_trends.map((ct, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-zinc-800/50 last:border-0">
                  <span className={`text-lg shrink-0 ${
                    ct.direction === 'up' ? 'text-green-400' : ct.direction === 'down' ? 'text-red-400' : 'text-zinc-500'
                  }`}>
                    {ct.direction === 'up' ? '\u2197' : ct.direction === 'down' ? '\u2198' : '\u2192'}
                  </span>
                  <span className="text-sm text-zinc-300 flex-1 truncate">{ct.name}</span>
                  <span className="text-xs text-zinc-500 shrink-0">{ct.domain}</span>
                  <span className={`text-sm font-medium w-16 text-right ${
                    ct.growth != null
                      ? ct.growth >= 0 ? 'text-green-400' : 'text-red-400'
                      : 'text-zinc-500'
                  }`}>
                    {ct.growth != null ? `${ct.growth >= 0 ? '+' : ''}${ct.growth}%` : '—'}
                  </span>
                </div>
              ))}
              {intel?.competitor_trend_interpretation && (
                <p className="text-sm text-zinc-400 italic mt-1">{intel.competitor_trend_interpretation}</p>
              )}
              <div className="text-xs text-zinc-500 mt-1">
                Динамика поискового интереса за 12 мес (Google Trends)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conclusion from Intelligence Layer */}
      {intel && (
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs font-medium text-zinc-400 mb-2">Итог анализа спроса</div>
          <div className="text-sm text-zinc-200">
            {diagnosis === 'green' && intel.conclusion_green}
            {diagnosis === 'yellow' && intel.conclusion_yellow}
            {diagnosis === 'red' && intel.conclusion_red}
            {!['green', 'yellow', 'red'].includes(diagnosis) && (intel.conclusion_yellow || '')}
          </div>
          {intel.block3_connection && (
            <div className="text-xs text-zinc-500 mt-2">
              → Блок 3: {intel.block3_connection}
            </div>
          )}
          {intel.key_factors && intel.key_factors.length > 0 && (
            <div className="mt-3 space-y-1">
              {intel.key_factors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="text-zinc-600 mt-0.5">•</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
