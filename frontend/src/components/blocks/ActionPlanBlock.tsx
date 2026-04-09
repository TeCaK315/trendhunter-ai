'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';

interface ActionPlanData {
  query: string;
  overall_readiness: {
    score: number;
    assessment: 'go' | 'no_go' | 'pivot' | 'more_data';
    confidence: number;
    blocks_analyzed: number;
    data_type: string;
    formula: string;
    block_scores: Record<string, number>;
    block_confidences: Record<string, number>;
  };
  executive_summary: {
    text: string;
    data_type: string;
    sources_cited: number;
  } | null;
  priority_actions: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    reasoning: string;
    evidence_source: string;
    evidence_url?: string;
  }>;
  unit_economics: {
    estimated_cac: number | null;
    ltv_cac_score: number | null;
    ltv_cac_formula: string | null;
    business_model: string | null;
    median_price: number | null;
    scalability_score: number | null;
    market_revenue: string | null;
    market_customers: number | null;
  };
  target_customer: {
    segment: string | null;
    segment_confidence: number;
    price_sensitivity: string;
    sales_complexity: string | null;
    top_complaints: Array<{
      text: string;
      source: string;
      url: string;
      engagement: number;
    }>;
  };
  competitive_landscape: {
    competitor_count: number;
    blue_ocean_score: number | null;
    saturation: number | null;
    top_competitors: Array<{ text: string; source_url: string }>;
    key_weaknesses: Array<{ text: string; source: string; source_url: string }>;
    unmet_needs: Array<{ text: string; source: string; source_url: string }>;
  };
  next_steps: Array<{
    step: string;
    category: 'research' | 'build' | 'validate' | 'grow';
    done: boolean;
  }>;
  smoke_test?: {
    duration: string;
    steps: Array<{
      step: number;
      action: string;
      description: string;
      tools: string;
      cost: string;
    }>;
    success_criteria: Array<{
      metric: string;
      threshold: string;
      description: string;
    }>;
  };
  kill_switch?: {
    description: string;
    metrics: Array<{
      metric: string;
      threshold: string;
      current_estimate: string;
      action: string;
    }>;
  };
  insufficient_data?: boolean;
  message?: string;
  blocks_completed?: number;
  blocks_required?: number;
  generated_at: string;
}

interface Props {
  data: ActionPlanData | null;
  loading?: boolean;
  error?: string;
}

const assessmentConfig = {
  go: { label: 'GO', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30', description: 'Данные подтверждают жизнеспособность ниши' },
  no_go: { label: 'NO GO', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', description: 'Данные указывают на высокие риски' },
  pivot: { label: 'PIVOT', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30', description: 'Нужна корректировка позиционирования' },
  more_data: { label: 'МАЛО ДАННЫХ', color: 'text-zinc-400', bg: 'bg-zinc-800/50 border-zinc-700', description: 'Соберите больше Evidence данных' },
};

const priorityConfig = {
  high: { label: 'Высокий', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  medium: { label: 'Средний', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  low: { label: 'Низкий', color: 'text-zinc-400', bg: 'bg-zinc-800/50 border-zinc-700' },
};

const categoryConfig = {
  research: { icon: '🔍', label: 'Исследование' },
  validate: { icon: '✓', label: 'Валидация' },
  build: { icon: '🔨', label: 'Разработка' },
  grow: { icon: '📈', label: 'Рост' },
};

const blockLabels: Record<string, string> = {
  problem: 'Проблема',
  demand: 'Спрос',
  sellability: 'Продажи',
  occupation: 'Рынок',
  economics: 'Экономика',
};

export default function ActionPlanBlock({ data, loading, error }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>('actions');

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-6 bg-zinc-800 rounded w-1/3" />
        <div className="h-32 bg-zinc-800 rounded" />
        <div className="h-24 bg-zinc-800 rounded" />
        <div className="h-24 bg-zinc-800 rounded" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">{error}</div>;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6">
          <span className="text-4xl">📋</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">План действий</h3>
        <p className="text-zinc-400 text-center max-w-md">
          Соберите Evidence данные (минимум 2 блока), затем нажмите &quot;Сгенерировать план&quot;
        </p>
      </div>
    );
  }

  // Insufficient data case
  if (data.insufficient_data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
          <span className="text-4xl">⚠️</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Недостаточно данных</h3>
        <p className="text-zinc-400 text-center max-w-md mb-4">{data.message}</p>
        <div className="text-sm text-zinc-500">
          Собрано блоков: {data.blocks_completed} / минимум {data.blocks_required}
        </div>
      </div>
    );
  }

  const assessment = assessmentConfig[data.overall_readiness.assessment];

  const toggle = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-4">
      {/* Overall Readiness + Assessment */}
      <div className={`rounded-xl p-5 border ${assessment.bg}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${assessment.color}`}>{assessment.label}</span>
              <EvidenceBadge type="calculated" label={`${data.overall_readiness.blocks_analyzed} блоков`} />
            </div>
            <p className="text-zinc-400 text-sm mt-1">{assessment.description}</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${assessment.color}`}>
              {data.overall_readiness.score}/10
            </div>
            <div className="text-xs text-zinc-500">
              Уверенность: {data.overall_readiness.confidence}%
            </div>
          </div>
        </div>

        {/* Block scores mini-chart */}
        <div className="grid grid-cols-5 gap-2 mt-4">
          {Object.entries(data.overall_readiness.block_scores).map(([key, score]) => {
            const pct = (score / 10) * 100;
            let barColor = 'bg-zinc-600';
            if (pct >= 70) barColor = 'bg-green-500';
            else if (pct >= 40) barColor = 'bg-yellow-500';
            else if (pct > 0) barColor = 'bg-red-500';

            return (
              <div key={key} className="text-center">
                <div className="text-xs text-zinc-500 mb-1">{blockLabels[key] || key}</div>
                <div className="w-full bg-zinc-700 rounded-full h-1.5">
                  <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{score > 0 ? `${score}/10` : '—'}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Executive Summary */}
      {data.executive_summary && (
        <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-indigo-300">Executive Summary</span>
            <EvidenceBadge type="ai_synthesis" label={`На основе ${data.executive_summary.sources_cited} блоков`} />
          </div>
          <div className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">
            {data.executive_summary.text}
          </div>
        </div>
      )}

      {/* Priority Actions */}
      <Section
        title="Приоритетные действия"
        icon="🎯"
        count={data.priority_actions.length}
        expanded={expandedSection === 'actions'}
        onToggle={() => toggle('actions')}
      >
        {data.priority_actions.length === 0 ? (
          <p className="text-zinc-500 text-sm">Нет действий — соберите больше Evidence данных</p>
        ) : (
          <div className="space-y-3">
            {data.priority_actions.map((action, i) => {
              const pConfig = priorityConfig[action.priority];
              return (
                <div key={i} className={`rounded-lg p-3 border ${pConfig.bg}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${pConfig.bg} ${pConfig.color}`}>
                      {pConfig.label}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{action.action}</p>
                      <p className="text-xs text-zinc-400 mt-1">{action.reasoning}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <EvidenceBadge type="real_data" label={action.evidence_source} />
                        {action.evidence_url && (
                          <a
                            href={action.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            Источник
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Unit Economics Summary */}
      <Section
        title="Юнит-экономика"
        icon="📊"
        expanded={expandedSection === 'economics'}
        onToggle={() => toggle('economics')}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="CAC (оценка)"
            value={data.unit_economics.estimated_cac ? `$${data.unit_economics.estimated_cac}` : '—'}
            type="calculated"
          />
          <MetricCard
            label="LTV/CAC Score"
            value={data.unit_economics.ltv_cac_score ? `${data.unit_economics.ltv_cac_score}/10` : '—'}
            type="calculated"
            sublabel={data.unit_economics.ltv_cac_formula || undefined}
          />
          <MetricCard
            label="Бизнес-модель"
            value={data.unit_economics.business_model || '—'}
            type="calculated"
          />
          <MetricCard
            label="Медианная цена"
            value={data.unit_economics.median_price ? `$${data.unit_economics.median_price}/мес` : '—'}
            type="real_data"
          />
        </div>
        {data.unit_economics.market_revenue && (
          <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Объём рынка:</span>
              <span className="text-sm font-medium text-white">{data.unit_economics.market_revenue}</span>
              {data.unit_economics.market_customers && (
                <span className="text-sm text-zinc-500">
                  (~{data.unit_economics.market_customers.toLocaleString()} клиентов)
                </span>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Target Customer */}
      <Section
        title="Целевой клиент"
        icon="👤"
        expanded={expandedSection === 'customer'}
        onToggle={() => toggle('customer')}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard
            label="Сегмент"
            value={data.target_customer.segment || '—'}
            type="calculated"
            sublabel={data.target_customer.segment_confidence > 0 ? `${Math.round(data.target_customer.segment_confidence * 100)}% уверенности` : undefined}
          />
          <MetricCard
            label="Ценовая чувствительность"
            value={data.target_customer.price_sensitivity}
            type="calculated"
          />
          <MetricCard
            label="Сложность продажи"
            value={data.target_customer.sales_complexity || '—'}
            type="calculated"
          />
          <MetricCard
            label="Топ жалоб"
            value={`${data.target_customer.top_complaints.length}`}
            type="real_data"
          />
        </div>

        {data.target_customer.top_complaints.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-medium">Ключевые жалобы (по engagement):</p>
            {data.target_customer.top_complaints.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-zinc-600 font-mono text-xs mt-0.5">{i + 1}.</span>
                <div className="flex-1">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-300 hover:text-white"
                  >
                    {c.text}
                  </a>
                  <span className="text-xs text-zinc-600 ml-2">
                    {c.source} / {c.engagement} engagement
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Competitive Landscape */}
      <Section
        title="Конкурентная среда"
        icon="🏟️"
        expanded={expandedSection === 'competition'}
        onToggle={() => toggle('competition')}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <MetricCard
            label="Конкурентов"
            value={`${data.competitive_landscape.competitor_count}`}
            type="real_data"
          />
          <MetricCard
            label="Blue Ocean"
            value={data.competitive_landscape.blue_ocean_score !== null ? `${data.competitive_landscape.blue_ocean_score}/10` : '—'}
            type="calculated"
          />
          <MetricCard
            label="Насыщенность"
            value={data.competitive_landscape.saturation !== null ? `${data.competitive_landscape.saturation}/10` : '—'}
            type="calculated"
          />
        </div>

        {data.competitive_landscape.key_weaknesses.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-zinc-500 font-medium mb-2">Слабости конкурентов:</p>
            {data.competitive_landscape.key_weaknesses.map((w, i) => (
              <div key={i} className="text-sm text-zinc-300 mb-1">
                <span className="text-red-400 mr-1">-</span>
                <a href={w.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {w.text}
                </a>
                <span className="text-xs text-zinc-600 ml-1">({w.source})</span>
              </div>
            ))}
          </div>
        )}

        {data.competitive_landscape.unmet_needs.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 font-medium mb-2">Неудовлетворённые потребности:</p>
            {data.competitive_landscape.unmet_needs.map((n, i) => (
              <div key={i} className="text-sm text-zinc-300 mb-1">
                <span className="text-green-400 mr-1">+</span>
                <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {n.text}
                </a>
                <span className="text-xs text-zinc-600 ml-1">({n.source})</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Next Steps Checklist */}
      <Section
        title="Чеклист следующих шагов"
        icon="✅"
        count={data.next_steps.filter(s => s.done).length}
        total={data.next_steps.length}
        expanded={expandedSection === 'steps'}
        onToggle={() => toggle('steps')}
      >
        <div className="space-y-1">
          {Object.entries(categoryConfig).map(([catKey, catInfo]) => {
            const categorySteps = data.next_steps.filter(s => s.category === catKey);
            if (categorySteps.length === 0) return null;
            return (
              <div key={catKey} className="mb-3">
                <p className="text-xs text-zinc-500 font-medium mb-1.5">
                  {catInfo.icon} {catInfo.label}
                </p>
                {categorySteps.map((step, i) => (
                  <label key={i} className="flex items-center gap-2 py-1 cursor-default">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                      step.done
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'border-zinc-700 text-zinc-600'
                    }`}>
                      {step.done ? '✓' : ''}
                    </span>
                    <span className={`text-sm ${step.done ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                      {step.step}
                    </span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Smoke Test */}
      {data.smoke_test && (
        <Section
          title="Smoke Test — проверка за 48ч"
          icon="🔥"
          expanded={expandedSection === 'smoke'}
          onToggle={() => toggle('smoke')}
        >
          <div className="space-y-3">
            {data.smoke_test.steps.map((s) => (
              <div key={s.step} className="flex items-start gap-3 bg-zinc-800/30 rounded-lg p-3">
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300 flex-shrink-0">
                  {s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{s.action}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{s.description}</div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
                    <span>Инструменты: {s.tools}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">{s.cost}</span>
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3">
              <div className="text-xs font-medium text-emerald-400 mb-2">Критерии успеха:</div>
              <div className="grid grid-cols-2 gap-2">
                {data.smoke_test.success_criteria.map((c, i) => (
                  <div key={i} className="bg-zinc-800/40 rounded p-2">
                    <div className="text-xs font-medium text-white">{c.metric}</div>
                    <div className="text-sm font-bold text-emerald-300">{c.threshold}</div>
                    <div className="text-[10px] text-zinc-500">{c.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Kill-Switch Metrics */}
      {data.kill_switch && (
        <Section
          title="Kill-Switch метрики"
          icon="🛑"
          expanded={expandedSection === 'killswitch'}
          onToggle={() => toggle('killswitch')}
        >
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 mb-3">{data.kill_switch.description}</p>
            {data.kill_switch.metrics.map((m, i) => (
              <div key={i} className="bg-zinc-800/30 rounded-lg p-3 border-l-2 border-red-500/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{m.metric}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-300 font-mono">{m.threshold}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Текущая оценка: <span className="text-zinc-300">{m.current_estimate}</span></span>
                </div>
                <div className="text-[10px] text-red-400/80 mt-1">{m.action}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-zinc-600 pt-2">
        <span>Сгенерировано: {new Date(data.generated_at).toLocaleString('ru-RU')}</span>
        <EvidenceBadge type="calculated" label="Все расчёты детерминированные" />
      </div>
    </div>
  );
}

// === Sub-components ===

function Section({
  title,
  icon,
  count,
  total,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  count?: number;
  total?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="font-medium text-white">{title}</span>
          {count !== undefined && total !== undefined ? (
            <span className="text-xs text-zinc-500">{count}/{total}</span>
          ) : count !== undefined ? (
            <span className="text-xs text-zinc-500">{count}</span>
          ) : null}
        </div>
        <span className="text-zinc-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  type,
  sublabel,
}: {
  label: string;
  value: string;
  type: 'real_data' | 'calculated';
  sublabel?: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-sm font-medium text-white">{value}</div>
      {sublabel && <div className="text-xs text-zinc-600 mt-0.5">{sublabel}</div>}
      <div className="mt-1">
        <EvidenceBadge type={type} className="text-[9px]" />
      </div>
    </div>
  );
}
