'use client';

import React, { useState } from 'react';
import EvidenceBadge from '../EvidenceBadge';

interface AcquisitionChannel {
  channel: string;
  strategy: string;
  evidence: string;
  estimated_cac: string;
  estimated_monthly_leads: string;
  priority: 'high' | 'medium' | 'low';
}

interface MetricTarget {
  users: string;
  mrr: string;
  churn: string;
  key_action: string;
}

interface GtmPlanData {
  positioning: {
    tagline: string;
    value_proposition: string;
    differentiators: Array<{
      point: string;
      vs_competitor: string;
      evidence: string;
    }>;
    target_icp: string;
  };
  acquisition_channels: {
    tier1_free: AcquisitionChannel[];
    tier2_paid: AcquisitionChannel[];
    tier3_scale: AcquisitionChannel[];
  };
  pricing_strategy: {
    model: string;
    recommended_price: string;
    reasoning: string;
    tiers: Array<{
      name: string;
      price: string;
      features: string;
      target: string;
    }>;
  };
  metrics: {
    north_star: string;
    month1: MetricTarget;
    month3: MetricTarget;
    month6: MetricTarget;
  };
  launch_phases: Array<{
    phase: string;
    duration: string;
    actions: string[];
    success_criteria: string;
  }>;
  evidence_used: {
    complaints: number;
    competitors: number;
    prices: number;
    channels: number;
    cpc_keywords: number;
  };
  generated_at: string;
  insufficient_data?: boolean;
  message?: string;
}

interface Props {
  trendTitle: string;
  evidenceData: Record<string, any>;
}

export default function GtmPlanGenerator({ trendTitle, evidenceData }: Props) {
  const [plan, setPlan] = useState<GtmPlanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gtm-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trendTitle,
          evidenceData: {
            problem: evidenceData.problem || null,
            demand: evidenceData.demand || null,
            sellability: evidenceData.sellability || null,
            occupation: evidenceData.occupation || null,
            economics: evidenceData.economics || null,
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlan(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Evidence counts
  const hasComplaints = (evidenceData.problem?.who_hurts?.complaints?.length || 0) > 0;
  const hasCompetitors = (evidenceData.occupation?.competitors_exist?.competitors?.length || 0) > 0;
  const hasPricing = (evidenceData.sellability?.average_ticket?.competitor_prices?.length || 0) > 0;
  const hasCpc = (evidenceData.economics?.cac?.keyword_cpc?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Go-to-Market Strategy</h2>
          <p className="text-zinc-400 text-sm mt-1">
            GTM план на основе Evidence данных: позиционирование, каналы, ценообразование, метрики.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {plan ? 'Обновить GTM' : 'Сгенерировать GTM план'}
        </button>
      </div>

      {/* Evidence badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <EvidenceBadge type="ai_synthesis" label="AI-синтез из Evidence" />
        {hasComplaints && <EvidenceBadge type="real_data" label={`${evidenceData.problem.who_hurts.complaints.length} жалоб`} />}
        {hasCompetitors && <EvidenceBadge type="real_data" label={`${evidenceData.occupation.competitors_exist.competitors.length} конкурентов`} />}
        {hasPricing && <EvidenceBadge type="real_data" label={`${evidenceData.sellability.average_ticket.competitor_prices.length} цен`} />}
        {hasCpc && <EvidenceBadge type="real_data" label={`${evidenceData.economics.cac.keyword_cpc.length} CPC`} />}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Insufficient data */}
      {plan?.insufficient_data && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-sm text-yellow-300">{plan.message}</p>
        </div>
      )}

      {/* Plan content */}
      {plan && !plan.insufficient_data && (
        <>
          {/* Evidence coverage stats */}
          <div className="flex items-center gap-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <Stat label="Жалоб" value={plan.evidence_used.complaints} />
            <Stat label="Конкурентов" value={plan.evidence_used.competitors} />
            <Stat label="Цен" value={plan.evidence_used.prices} />
            <Stat label="Каналов" value={plan.evidence_used.channels} />
            <Stat label="CPC слов" value={plan.evidence_used.cpc_keywords} />
          </div>

          {/* 1. Positioning */}
          <Section icon="🎯" title="Позиционирование">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-5">
                <p className="text-lg font-bold text-white">{plan.positioning.tagline}</p>
                <p className="text-sm text-zinc-300 mt-2">{plan.positioning.value_proposition}</p>
              </div>

              <div className="bg-zinc-800/30 rounded-lg p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Идеальный клиент (ICP)</p>
                <p className="text-sm text-zinc-300">{plan.positioning.target_icp}</p>
              </div>

              {plan.positioning.differentiators.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Дифференциаторы</p>
                  {plan.positioning.differentiators.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 bg-zinc-800/30 rounded-lg p-3">
                      <span className="text-green-400 mt-0.5">✦</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{d.point}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-zinc-500">vs {d.vs_competitor}</span>
                          <span className="text-[10px] text-zinc-600">|</span>
                          <span className="text-[10px] text-indigo-400">{d.evidence}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* 2. Acquisition Channels */}
          <Section icon="📡" title="Каналы привлечения">
            <div className="space-y-4">
              <ChannelTier
                title="Tier 1 — Бесплатные"
                subtitle="Контент, сообщества, SEO"
                channels={plan.acquisition_channels.tier1_free}
                color="green"
              />
              <ChannelTier
                title="Tier 2 — Платные"
                subtitle="Реклама, спонсорство"
                channels={plan.acquisition_channels.tier2_paid}
                color="yellow"
              />
              <ChannelTier
                title="Tier 3 — Масштабирование"
                subtitle="Партнёрства, marketplace"
                channels={plan.acquisition_channels.tier3_scale}
                color="purple"
              />
            </div>
          </Section>

          {/* 3. Pricing Strategy */}
          <Section icon="💰" title="Ценообразование">
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="bg-zinc-800/30 rounded-lg px-4 py-2">
                  <span className="text-xs text-zinc-500">Модель</span>
                  <p className="text-sm font-medium text-white">{plan.pricing_strategy.model}</p>
                </div>
                <div className="bg-zinc-800/30 rounded-lg px-4 py-2">
                  <span className="text-xs text-zinc-500">Рекомендуемая цена</span>
                  <p className="text-sm font-medium text-green-400">{plan.pricing_strategy.recommended_price}</p>
                </div>
              </div>

              <p className="text-xs text-zinc-400">{plan.pricing_strategy.reasoning}</p>

              {plan.pricing_strategy.tiers.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {plan.pricing_strategy.tiers.map((tier, i) => (
                    <div
                      key={i}
                      className={`border rounded-xl p-4 ${
                        i === 1
                          ? 'border-indigo-500/30 bg-indigo-500/5'
                          : 'border-zinc-800 bg-zinc-900/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">{tier.name}</span>
                        {i === 1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Рекомендуем
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-bold text-white">{tier.price}</p>
                      <p className="text-xs text-zinc-400 mt-2">{tier.features}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">{tier.target}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* 4. Metrics */}
          <Section icon="📊" title="Метрики и цели">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-xs text-green-400 uppercase tracking-wider">North Star Metric</p>
                <p className="text-sm font-medium text-white mt-1">{plan.metrics.north_star}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetricCard period="Месяц 1" data={plan.metrics.month1} />
                <MetricCard period="Месяц 3" data={plan.metrics.month3} />
                <MetricCard period="Месяц 6" data={plan.metrics.month6} />
              </div>
            </div>
          </Section>

          {/* 5. Launch Phases */}
          {plan.launch_phases.length > 0 && (
            <Section icon="🚀" title="Фазы запуска">
              <div className="space-y-3">
                {plan.launch_phases.map((phase, i) => (
                  <div key={i} className="bg-zinc-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{phase.phase}</p>
                        <p className="text-[10px] text-zinc-500">{phase.duration}</p>
                      </div>
                    </div>
                    <div className="space-y-1 ml-10">
                      {phase.actions.map((action, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <span className="text-zinc-600 mt-0.5 text-xs">→</span>
                          <span className="text-xs text-zinc-300">{action}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 ml-10">
                      <span className="text-[10px] text-green-400/70">Критерий: {phase.success_criteria}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-zinc-800">
        <span className="text-lg">{icon}</span>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function ChannelTier({
  title,
  subtitle,
  channels,
  color,
}: {
  title: string;
  subtitle: string;
  channels: AcquisitionChannel[];
  color: 'green' | 'yellow' | 'purple';
}) {
  if (channels.length === 0) return null;

  const colorMap = {
    green: 'border-green-500/20 bg-green-500/5',
    yellow: 'border-yellow-500/20 bg-yellow-500/5',
    purple: 'border-purple-500/20 bg-purple-500/5',
  };
  const labelColor = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  };

  const priorityConfig = {
    high: { label: 'Высокий', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    medium: { label: 'Средний', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    low: { label: 'Низкий', color: 'text-zinc-400', bg: 'bg-zinc-700/30 border-zinc-600/20' },
  };

  return (
    <div className={`border rounded-xl ${colorMap[color]}`}>
      <div className="px-4 py-3 border-b border-zinc-800/50">
        <p className={`text-sm font-medium ${labelColor[color]}`}>{title}</p>
        <p className="text-[10px] text-zinc-500">{subtitle}</p>
      </div>
      <div className="divide-y divide-zinc-800/30">
        {channels.map((ch, i) => {
          const prio = priorityConfig[ch.priority];
          return (
            <div key={i} className="p-3 hover:bg-zinc-800/20 transition-colors">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{ch.channel}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${prio.bg} ${prio.color}`}>
                  {prio.label}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-1">{ch.strategy}</p>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
                <span>CAC: <span className="text-zinc-300">{ch.estimated_cac}</span></span>
                <span>Leads/мес: <span className="text-zinc-300">{ch.estimated_monthly_leads}</span></span>
              </div>
              <p className="text-[10px] text-indigo-400/70 mt-1">{ch.evidence}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ period, data }: { period: string; data: MetricTarget }) {
  return (
    <div className="bg-zinc-800/30 rounded-xl p-4">
      <p className="text-xs text-zinc-500 font-medium mb-3">{period}</p>
      <div className="space-y-2">
        <div>
          <span className="text-[10px] text-zinc-600">Users</span>
          <p className="text-sm font-bold text-white">{data.users}</p>
        </div>
        <div>
          <span className="text-[10px] text-zinc-600">MRR</span>
          <p className="text-sm font-bold text-green-400">{data.mrr}</p>
        </div>
        <div>
          <span className="text-[10px] text-zinc-600">Churn</span>
          <p className="text-sm font-bold text-zinc-300">{data.churn}</p>
        </div>
        <div className="pt-2 border-t border-zinc-700/50">
          <p className="text-[10px] text-indigo-300">{data.key_action}</p>
        </div>
      </div>
    </div>
  );
}
