'use client';

import { useState } from 'react';
import type { MarketingPlanResult } from '@/app/api/marketing-plan/route';

interface MarketingPlanProps {
  plan: MarketingPlanResult;
  language: string;
}

export default function MarketingPlan({ plan, language }: MarketingPlanProps) {
  const [activeTab, setActiveTab] = useState<'audience' | 'messaging' | 'channels' | 'ads' | 'checklist'>('audience');
  const [expandedChannel, setExpandedChannel] = useState<number | null>(null);

  const tabs = [
    { id: 'audience' as const, label: language === 'ru' ? 'Целевая аудитория' : 'Target Audience', icon: '🎯' },
    { id: 'messaging' as const, label: language === 'ru' ? 'Боли и hooks' : 'Pain Messaging', icon: '💬' },
    { id: 'channels' as const, label: language === 'ru' ? 'Каналы продвижения' : 'Channels', icon: '📢' },
    { id: 'ads' as const, label: language === 'ru' ? 'Готовые тексты' : 'Ad Copies', icon: '✍️' },
    { id: 'checklist' as const, label: language === 'ru' ? 'Чеклист запуска' : 'Launch Checklist', icon: '✅' },
  ];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📋</span>
          <div>
            <h3 className="text-xl font-bold text-white">
              {language === 'ru' ? 'Маркетинговый план' : 'Marketing Plan'}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              {language === 'ru'
                ? 'Конкретные шаги для продвижения вашего продукта, основанные на реальных данных рынка'
                : 'Actionable steps to promote your product, based on real market data'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-zinc-800 bg-zinc-900/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* TAB: Target Audience */}
        {activeTab === 'audience' && plan.target_audience && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <InfoCard
                icon="👥"
                title={language === 'ru' ? 'Основной сегмент' : 'Primary Segment'}
                content={plan.target_audience.primary_segment}
                badge={plan.target_audience.segment_type}
                badgeColor="bg-indigo-500/20 text-indigo-400"
              />
              <InfoCard
                icon="📊"
                title={language === 'ru' ? 'Размер аудитории' : 'Estimated Size'}
                content={plan.target_audience.estimated_size}
              />
            </div>
            <InfoCard
              icon="🧑‍💼"
              title={language === 'ru' ? 'Демография' : 'Demographics'}
              content={plan.target_audience.demographic}
            />
            <InfoCard
              icon="🧠"
              title={language === 'ru' ? 'Психография' : 'Psychographics'}
              content={plan.target_audience.psychographic}
            />
            {plan.target_audience.where_they_hang_out?.length > 0 && (
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                  <span>📍</span>
                  {language === 'ru' ? 'Где их искать' : 'Where to find them'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {plan.target_audience.where_they_hang_out.map((place, i) => (
                    <span key={i} className="px-3 py-1.5 bg-zinc-700/50 border border-zinc-600/50 rounded-full text-sm text-zinc-300">
                      {place}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Positioning sub-section */}
            {plan.positioning && (
              <div className="mt-6 space-y-4">
                <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span>🏆</span>
                  {language === 'ru' ? 'Позиционирование' : 'Positioning'}
                </h4>
                <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-sm text-zinc-400 mb-1">USP</p>
                  <p className="text-white font-medium">{plan.positioning.usp}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <p className="text-sm text-zinc-400 mb-1">One-liner</p>
                  <p className="text-zinc-200 italic">&ldquo;{plan.positioning.one_liner}&rdquo;</p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <p className="text-sm text-zinc-400 mb-1">Elevator Pitch (30 сек)</p>
                  <p className="text-zinc-300 text-sm">{plan.positioning.elevator_pitch}</p>
                </div>
                {plan.positioning.vs_competitors?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-400">
                      {language === 'ru' ? 'Против конкурентов:' : 'vs Competitors:'}
                    </p>
                    {plan.positioning.vs_competitors.map((vc, i) => (
                      <div key={i} className="bg-zinc-800/50 rounded-lg p-3 flex items-start gap-3">
                        <span className="text-lg mt-0.5">⚔️</span>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">{vc.competitor}</p>
                          <p className="text-red-400/80 text-xs mt-1">❌ {vc.their_weakness}</p>
                          <p className="text-emerald-400/80 text-xs mt-0.5">✅ {vc.our_advantage}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pricing strategy */}
            {plan.pricing_strategy && (
              <div className="mt-6 space-y-3">
                <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span>💰</span>
                  {language === 'ru' ? 'Стратегия ценообразования' : 'Pricing Strategy'}
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <InfoCard
                    icon="🏷️"
                    title={language === 'ru' ? 'Модель' : 'Model'}
                    content={plan.pricing_strategy.recommended_model}
                  />
                  <InfoCard
                    icon="💵"
                    title={language === 'ru' ? 'Цена входа' : 'Entry Price'}
                    content={plan.pricing_strategy.entry_price}
                  />
                </div>
                <InfoCard
                  icon="📊"
                  title={language === 'ru' ? 'Бенчмарк конкурентов' : 'Competitor Benchmark'}
                  content={plan.pricing_strategy.competitor_benchmark}
                />
                <InfoCard
                  icon="🎁"
                  title={language === 'ru' ? 'Бесплатный hook' : 'Free Tier Hook'}
                  content={plan.pricing_strategy.free_tier_hook}
                />
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <p className="text-sm text-zinc-400 mb-1">{language === 'ru' ? 'Обоснование' : 'Reasoning'}</p>
                  <p className="text-zinc-300 text-sm">{plan.pricing_strategy.reasoning}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Pain Messaging */}
        {activeTab === 'messaging' && (
          <div className="space-y-4">
            {plan.pain_messaging?.map((pm, i) => (
              <div key={i} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-bold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
                        {pm.source}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm mb-2 italic">&ldquo;{pm.pain}&rdquo;</p>
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mt-2">
                      <p className="text-amber-400 font-semibold text-sm mb-1">🎣 Hook:</p>
                      <p className="text-white font-medium">{pm.hook}</p>
                    </div>
                    <p className="text-zinc-300 text-sm mt-2">{pm.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Channels */}
        {activeTab === 'channels' && (
          <div className="space-y-3">
            {plan.channels?.map((ch, i) => (
              <div key={i} className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden">
                <button
                  onClick={() => setExpandedChannel(expandedChannel === i ? null : i)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-zinc-800/80 transition-colors"
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    ch.priority === 'high' ? 'bg-emerald-500' :
                    ch.priority === 'medium' ? 'bg-amber-500' : 'bg-zinc-500'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{ch.channel}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        ch.priority === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
                        ch.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-zinc-700 text-zinc-400'
                      }`}>
                        {ch.priority === 'high' ? (language === 'ru' ? 'Приоритет' : 'Priority') :
                         ch.priority === 'medium' ? (language === 'ru' ? 'Средний' : 'Medium') :
                         (language === 'ru' ? 'Низкий' : 'Low')}
                      </span>
                      {ch.estimated_cac && (
                        <span className="text-xs text-zinc-500">CAC: {ch.estimated_cac}</span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm mt-0.5">{ch.why}</p>
                  </div>
                  <svg className={`w-5 h-5 text-zinc-500 transition-transform ${expandedChannel === i ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedChannel === i && (
                  <div className="px-4 pb-4 pt-0 border-t border-zinc-700/50">
                    <div className="mt-3 mb-3">
                      <p className="text-sm text-zinc-400 mb-1">{language === 'ru' ? 'Тип контента:' : 'Content type:'}</p>
                      <p className="text-zinc-300 text-sm">{ch.content_type}</p>
                    </div>
                    {ch.first_steps?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1">
                          <span>⚡</span>
                          {language === 'ru' ? 'Первые шаги (неделя 1):' : 'First steps (week 1):'}
                        </p>
                        <ol className="space-y-1.5">
                          {ch.first_steps.map((step, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm">
                              <span className="text-amber-500/60 font-mono text-xs mt-0.5">{j + 1}.</span>
                              <span className="text-zinc-300">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: Ad Copies */}
        {activeTab === 'ads' && (
          <div className="space-y-4">
            {plan.ad_copies?.map((ad, i) => (
              <div key={i} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 font-medium">
                      {ad.platform}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {language === 'ru' ? 'Боль:' : 'Pain:'} {ad.target_pain}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const text = `${ad.headline}\n\n${ad.body}\n\n${ad.cta}`;
                      navigator.clipboard.writeText(text);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    <span>📋</span> {language === 'ru' ? 'Копировать' : 'Copy'}
                  </button>
                </div>
                <div className="bg-zinc-900/80 rounded-lg p-4 space-y-2">
                  <p className="text-white font-bold text-lg">{ad.headline}</p>
                  <p className="text-zinc-300 text-sm">{ad.body}</p>
                  <p className="text-amber-400 font-medium text-sm mt-2">{ad.cta}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Launch Checklist */}
        {activeTab === 'checklist' && (
          <div className="space-y-2">
            {plan.launch_checklist?.map((item, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                item.priority === 'critical' ? 'bg-red-500/5 border border-red-500/20' :
                item.priority === 'important' ? 'bg-amber-500/5 border border-amber-500/20' :
                'bg-zinc-800/50 border border-zinc-700/50'
              }`}>
                <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${
                  item.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                  item.priority === 'important' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{item.step}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      item.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      item.priority === 'important' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-zinc-700 text-zinc-400'
                    }`}>
                      {item.priority === 'critical' ? '!' :
                       item.priority === 'important' ? '~' : '?'}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component
function InfoCard({ icon, title, content, badge, badgeColor }: {
  icon: string;
  title: string;
  content: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <p className="text-sm text-zinc-400">{title}</p>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor || 'bg-zinc-700 text-zinc-400'}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-zinc-200 text-sm">{content}</p>
    </div>
  );
}
