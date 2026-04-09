'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';
import SourceCard from '../SourceCard';

interface MarketSellabilityData {
  who_pays: {
    buyer_discussions: Array<{
      text: string;
      source: string;
      source_url?: string;
      engagement?: number;
      data_type?: string;
    }>;
    buyer_profiles: Array<{
      text: string;
      source: string;
      source_url?: string;
      rating?: number;
      data_type?: string;
    }>;
    total_data_points: number;
  };
  market_segment: {
    segment_type: string;
    confidence: number;
    signals: {
      enterprise: number;
      b2b: number;
      b2c: number;
      smb: number;
      total: number;
    };
    evidence_urls: Array<{ title: string; url: string }>;
  };
  average_ticket: {
    competitor_prices: Array<{
      competitor: string;
      price: string;
      url: string;
      plan_type: string;
      period?: string;
    }>;
    median_price: number | null;
    price_count: number;
    price_range?: string | null;
    price_min?: number | null;
    price_premium?: number | null;
    psychological_threshold?: number | null;
    payment_model?: string | null;
    has_trial_period?: boolean | null;
  };
  sales_cycle: {
    complexity: string;
    reasoning: string;
    days?: number | null;
    budget_exists?: boolean | null;
    deal_cycle_reasoning?: string | null;
    budget_signals?: {
      competitors_are_paid: boolean;
      commercial_intent_high: boolean;
      reddit_mentions_budget: boolean;
      signal_count: number;
    } | null;
    market_type?: string | null;
    has_trial_period?: boolean | null;
    pain_type?: string | null;
  };
  communities?: Array<{
    name: string;
    channel_type: string;
    url: string;
    member_count: number;
    mentioned_frequency: number;
    competitor_domain: string | null;
  }>;
  traffic_interception_points?: Array<{
    type: string;
    keyword: string;
    difficulty: string;
    tactics: string[];
  }>;
  path_to_money?: {
    path_to_first_payment: string | null;
    time_to_first_revenue_days: number | null;
    market_readiness_score: number | null;
    main_barrier: string | null;
  };
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
    label?: string;
  };
  intelligence?: SellabilityIntelligence | null;
}

interface SellabilityIntelligence {
  verdict_phrase?: string;
  verdict_sub?: string;
  price_interpretation?: string;
  cycle_interpretation?: string;
  channel_interpretation?: string;
  barrier_interpretation?: string;
  first_money_interpretation?: string;
  budget_interpretation?: string;
  key_factors?: string[];
  block5_connection?: string;
  conclusion_green?: string;
  conclusion_yellow?: string;
  conclusion_red?: string;
}

interface Props {
  data: MarketSellabilityData | null;
  loading?: boolean;
  error?: string;
}

export default function MarketSellabilityBlock({ data, loading, error }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAllDiscussions, setShowAllDiscussions] = useState(false);
  const [showAllProfiles, setShowAllProfiles] = useState(false);

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

  const segmentColors: Record<string, string> = {
    Enterprise: 'bg-purple-500/20 text-purple-300',
    B2B: 'bg-blue-500/20 text-blue-300',
    B2C: 'bg-green-500/20 text-green-300',
    SMB: 'bg-yellow-500/20 text-yellow-300',
    Mixed: 'bg-zinc-500/20 text-zinc-300',
  };

  const discussionsToShow = showAllDiscussions
    ? data.who_pays.buyer_discussions
    : data.who_pays.buyer_discussions.slice(0, 5);

  const profilesToShow = showAllProfiles
    ? data.who_pays.buyer_profiles
    : data.who_pays.buyer_profiles.slice(0, 3);

  const paymentModelLabels: Record<string, string> = {
    subscription: 'Подписка',
    one_time: 'Единоразово',
    freemium: 'Freemium',
    usage_based: 'По использованию',
    pay_per_use: 'За использование',
  };

  const difficultyColors: Record<string, string> = {
    easy: 'text-green-400',
    medium: 'text-yellow-400',
    hard: 'text-red-400',
  };

  return (
    <div className="space-y-4">
      {/* Verdict + Intelligence hero */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Продаваемость"
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
          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${segmentColors[data.market_segment.segment_type] || segmentColors.Mixed}`}>
            {data.market_segment.segment_type}
          </span>
          <div className="text-xs text-zinc-400 mt-1">{Math.round(data.market_segment.confidence * 100)}% уверенность</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-xl font-bold">
            {data.average_ticket.median_price ? `$${data.average_ticket.median_price}` : '—'}
          </div>
          <div className="text-xs text-zinc-400">Медианная цена</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-xl font-bold capitalize">{data.sales_cycle.complexity}</div>
          <div className="text-xs text-zinc-400">Цикл сделки</div>
        </div>
      </div>

      {/* Section 1: Ценообразование */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('pricing')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Ценообразование</span>
            <EvidenceBadge type={data.average_ticket.price_count > 0 ? 'real_data' : 'no_data'} />
          </div>
          <span className="text-zinc-500">{expandedSection === 'pricing' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'pricing' && (
          <div className="px-3 pb-3 space-y-3">
            {/* Price range bar */}
            {data.average_ticket.price_range && (
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-400">Диапазон цен</span>
                  <span className="text-sm font-bold text-white">{data.average_ticket.price_range}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  {data.average_ticket.price_min != null && (
                    <span>Мин: <span className="text-zinc-300">${data.average_ticket.price_min}</span></span>
                  )}
                  {data.average_ticket.median_price != null && (
                    <span>Медиана: <span className="text-yellow-300 font-medium">${data.average_ticket.median_price}</span></span>
                  )}
                  {data.average_ticket.price_premium != null && (
                    <span>Premium: <span className="text-zinc-300">${data.average_ticket.price_premium}</span></span>
                  )}
                </div>
              </div>
            )}

            {/* Payment model + trial */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {data.average_ticket.payment_model && (
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="font-medium text-white">{paymentModelLabels[data.average_ticket.payment_model] || data.average_ticket.payment_model}</div>
                  <div className="text-zinc-500">Модель</div>
                </div>
              )}
              {data.average_ticket.has_trial_period != null && (
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className={`font-medium ${data.average_ticket.has_trial_period ? 'text-green-400' : 'text-zinc-400'}`}>
                    {data.average_ticket.has_trial_period ? 'Да' : 'Нет'}
                  </div>
                  <div className="text-zinc-500">Trial</div>
                </div>
              )}
              {data.average_ticket.psychological_threshold != null && (
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="font-medium text-white">${data.average_ticket.psychological_threshold}</div>
                  <div className="text-zinc-500">Порог</div>
                </div>
              )}
            </div>

            {/* Competitor prices list */}
            {data.average_ticket.competitor_prices.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-zinc-400 font-medium">Цены конкурентов</div>
                {data.average_ticket.competitor_prices.map((cp, i) => (
                  <div key={i} className="flex justify-between items-center text-xs bg-zinc-800/30 rounded px-2 py-1.5">
                    <span className="text-zinc-300">{cp.competitor}</span>
                    <span className="text-white font-medium">{cp.price}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Intelligence interpretation */}
            {intel?.price_interpretation && (
              <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-xs font-medium text-indigo-300">AI-интерпретация</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{intel.price_interpretation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Почему такой цикл сделки */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('cycle')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Почему такой цикл сделки</span>
            <EvidenceBadge type="calculated" />
            {data.sales_cycle.days != null && (
              <span className="text-xs text-zinc-400">{data.sales_cycle.days}д</span>
            )}
          </div>
          <span className="text-zinc-500">{expandedSection === 'cycle' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'cycle' && (
          <div className="px-3 pb-3 space-y-3">
            {/* Deal cycle reasoning — 6 signals */}
            {data.sales_cycle.deal_cycle_reasoning && (
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-2">Логика расчёта (6 сигналов)</div>
                <div className="space-y-1.5">
                  {data.sales_cycle.deal_cycle_reasoning.split(' → ').map((signal, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-indigo-400 mt-0.5 shrink-0">#{i + 1}</span>
                      <span className="text-zinc-300">{signal}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Context chips */}
            <div className="flex flex-wrap gap-2">
              {data.sales_cycle.market_type && (
                <span className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-300">
                  {data.sales_cycle.market_type}
                </span>
              )}
              {data.sales_cycle.pain_type && (
                <span className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-300">
                  Боль: {data.sales_cycle.pain_type.replace(/_/g, ' ')}
                </span>
              )}
              {data.sales_cycle.has_trial_period != null && (
                <span className={`px-2 py-1 rounded text-xs ${data.sales_cycle.has_trial_period ? 'bg-green-900/30 text-green-300' : 'bg-zinc-800 text-zinc-400'}`}>
                  Trial: {data.sales_cycle.has_trial_period ? 'Да' : 'Нет'}
                </span>
              )}
            </div>

            {/* Budget signals */}
            {data.sales_cycle.budget_signals && (
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-400">Бюджетная категория</span>
                  <span className={`text-xs font-medium ${data.sales_cycle.budget_exists ? 'text-green-400' : 'text-red-400'}`}>
                    {data.sales_cycle.budget_exists ? 'Существует' : 'Не существует'} ({data.sales_cycle.budget_signals.signal_count}/3)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs text-center">
                  <div className={`rounded py-1 ${data.sales_cycle.budget_signals.competitors_are_paid ? 'bg-green-900/30 text-green-300' : 'bg-zinc-700/30 text-zinc-500'}`}>
                    Платные конкур.
                  </div>
                  <div className={`rounded py-1 ${data.sales_cycle.budget_signals.commercial_intent_high ? 'bg-green-900/30 text-green-300' : 'bg-zinc-700/30 text-zinc-500'}`}>
                    Комм. интент
                  </div>
                  <div className={`rounded py-1 ${data.sales_cycle.budget_signals.reddit_mentions_budget ? 'bg-green-900/30 text-green-300' : 'bg-zinc-700/30 text-zinc-500'}`}>
                    Reddit бюджеты
                  </div>
                </div>
              </div>
            )}

            {/* Intelligence interpretation */}
            {intel?.cycle_interpretation && (
              <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-xs font-medium text-indigo-300">AI-интерпретация</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{intel.cycle_interpretation}</p>
              </div>
            )}
            {intel?.budget_interpretation && (
              <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-xs font-medium text-indigo-300">Бюджет — AI-интерпретация</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{intel.budget_interpretation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Где найти первых покупателей */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('channels')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Где найти первых покупателей</span>
            <EvidenceBadge type={(data.communities?.length || 0) > 0 ? 'real_data' : 'ai_synthesis'} />
            <span className="text-xs text-zinc-400">
              {(data.communities?.length || 0) + (data.traffic_interception_points?.length || 0)} точек
            </span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'channels' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'channels' && (
          <div className="px-3 pb-3 space-y-3">
            {/* Communities */}
            {data.communities && data.communities.length > 0 && (
              <div>
                <div className="text-xs text-zinc-400 font-medium mb-2">Сообщества</div>
                <div className="space-y-1.5">
                  {data.communities.map((comm, i) => (
                    <a
                      key={i}
                      href={comm.url !== '#' ? comm.url : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block bg-zinc-800/50 rounded-lg p-2.5 ${comm.url !== '#' ? 'hover:bg-zinc-700/50 cursor-pointer' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-sm text-white font-medium">{comm.name}</span>
                          <span className="text-xs text-zinc-500 ml-2">{comm.channel_type}</span>
                        </div>
                        {comm.member_count > 0 && (
                          <span className="text-xs text-zinc-400">{comm.member_count.toLocaleString()} участн.</span>
                        )}
                      </div>
                      {comm.competitor_domain && (
                        <div className="text-xs text-zinc-500 mt-1">Найдено через: {comm.competitor_domain}</div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Traffic interception points */}
            {data.traffic_interception_points && data.traffic_interception_points.length > 0 && (
              <div>
                <div className="text-xs text-zinc-400 font-medium mb-2">Точки перехвата трафика</div>
                <div className="space-y-1.5">
                  {data.traffic_interception_points.map((point, i) => {
                    const typeLabels: Record<string, string> = {
                      problem_search: 'Поиск проблемы',
                      alternative_search: 'Альтернативы',
                      comparison_search: 'Сравнение',
                      education: 'Обучение',
                      community: 'Сообщество',
                    };
                    return (
                      <div key={i} className="bg-zinc-800/50 rounded-lg p-2.5">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                              {typeLabels[point.type] || point.type}
                            </span>
                            <span className="text-sm text-white">&quot;{point.keyword}&quot;</span>
                          </div>
                          <span className={`text-xs ${difficultyColors[point.difficulty] || 'text-zinc-400'}`}>
                            {point.difficulty}
                          </span>
                        </div>
                        {point.tactics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {point.tactics.map((t, j) => (
                              <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-300">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fallback: old who_pays data */}
            {(!data.communities || data.communities.length === 0) && (!data.traffic_interception_points || data.traffic_interception_points.length === 0) && (
              <div className="space-y-2">
                {discussionsToShow.map((d, i) => (
                  <SourceCard
                    key={i}
                    title={d.text}
                    url={d.source_url || '#'}
                    source={d.source}
                    engagement={d.engagement}
                    dataType="real_data"
                  />
                ))}
                {data.who_pays.buyer_discussions.length > 5 && (
                  <button
                    onClick={() => setShowAllDiscussions(!showAllDiscussions)}
                    className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showAllDiscussions ? 'Свернуть' : `Показать ещё ${data.who_pays.buyer_discussions.length - 5}`}
                  </button>
                )}
                {profilesToShow.map((p, i) => (
                  <SourceCard
                    key={`profile-${i}`}
                    title={p.text}
                    url={p.source_url || '#'}
                    source={p.source}
                    rating={p.rating}
                    dataType="real_data"
                  />
                ))}
                {data.who_pays.buyer_profiles.length > 3 && (
                  <button
                    onClick={() => setShowAllProfiles(!showAllProfiles)}
                    className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showAllProfiles ? 'Свернуть' : `Показать ещё ${data.who_pays.buyer_profiles.length - 3}`}
                  </button>
                )}
              </div>
            )}

            {/* Intelligence interpretation */}
            {intel?.channel_interpretation && (
              <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-xs font-medium text-indigo-300">AI-интерпретация</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{intel.channel_interpretation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Путь к первым деньгам */}
      {data.path_to_money && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('money')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Путь к первым деньгам</span>
              <EvidenceBadge type="calculated" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'money' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'money' && (
            <div className="px-3 pb-3 space-y-3">
              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-2">
                {data.path_to_money.time_to_first_revenue_days != null && (
                  <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{data.path_to_money.time_to_first_revenue_days}</div>
                    <div className="text-xs text-zinc-400">дней до первого дохода</div>
                  </div>
                )}
                {data.path_to_money.market_readiness_score != null && (
                  <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{data.path_to_money.market_readiness_score}/10</div>
                    <div className="text-xs text-zinc-400">готовность рынка</div>
                  </div>
                )}
              </div>

              {/* Main barrier */}
              {data.path_to_money.main_barrier && (
                <div className="bg-red-900/15 border border-red-800/30 rounded-lg p-3">
                  <div className="text-xs text-red-400 font-medium mb-1">Главный барьер</div>
                  <p className="text-sm text-zinc-300">{data.path_to_money.main_barrier}</p>
                  {intel?.barrier_interpretation && (
                    <p className="text-xs text-zinc-400 mt-2 pt-2 border-t border-red-800/20">{intel.barrier_interpretation}</p>
                  )}
                </div>
              )}

              {/* Path to first payment */}
              {data.path_to_money.path_to_first_payment && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-400 font-medium mb-1">Путь к первой оплате</div>
                  <p className="text-sm text-zinc-300">{data.path_to_money.path_to_first_payment}</p>
                </div>
              )}

              {/* Intelligence interpretation */}
              {intel?.first_money_interpretation && (
                <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px]">⚡</span>
                    <span className="text-xs font-medium text-indigo-300">AI-интерпретация</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{intel.first_money_interpretation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section: Who pays (legacy — shown if no structured communities/traffic) */}
      {(data.communities?.length || 0) > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('who_pays')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Кто платит</span>
              <EvidenceBadge type={data.who_pays.total_data_points > 0 ? 'real_data' : 'no_data'} />
              <span className="text-xs text-zinc-400">{data.who_pays.total_data_points > 0 ? `${data.who_pays.total_data_points} обсуждений` : 'Нет данных'}</span>
            </div>
            <span className="text-zinc-500">{expandedSection === 'who_pays' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'who_pays' && (
            <div className="px-3 pb-3 space-y-2">
              {discussionsToShow.map((d, i) => (
                <SourceCard
                  key={i}
                  title={d.text}
                  url={d.source_url || '#'}
                  source={d.source}
                  engagement={d.engagement}
                  dataType="real_data"
                />
              ))}
              {data.who_pays.buyer_discussions.length > 5 && (
                <button
                  onClick={() => setShowAllDiscussions(!showAllDiscussions)}
                  className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {showAllDiscussions ? 'Свернуть' : `Показать ещё ${data.who_pays.buyer_discussions.length - 5}`}
                </button>
              )}
              {profilesToShow.map((p, i) => (
                <SourceCard
                  key={`profile-${i}`}
                  title={p.text}
                  url={p.source_url || '#'}
                  source={p.source}
                  rating={p.rating}
                  dataType="real_data"
                />
              ))}
              {data.who_pays.buyer_profiles.length > 3 && (
                <button
                  onClick={() => setShowAllProfiles(!showAllProfiles)}
                  className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {showAllProfiles ? 'Свернуть' : `Показать ещё ${data.who_pays.buyer_profiles.length - 3}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section: Market segment — из Layer 2 market_type */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Сегмент рынка</span>
            <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${segmentColors[data.market_segment.segment_type] || segmentColors.Mixed}`}>
              {data.market_segment.segment_type}
            </span>
          </div>
          <EvidenceBadge type="calculated" />
        </div>
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
