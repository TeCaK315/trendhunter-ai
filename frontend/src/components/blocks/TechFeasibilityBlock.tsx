'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';

interface TechFeasibilityData {
  complexity: {
    score: number;
    level: 'low' | 'medium' | 'high';
    factors: Array<{ factor: string; impact: number; description: string }>;
  };
  stack_recommendations: {
    frontend: string;
    backend: string;
    database: string;
    hosting: string;
    reasoning: string;
  } | null;
  regulatory: {
    checks: Array<{
      regulation: string;
      applies: boolean;
      description: string;
      severity: 'info' | 'warning' | 'critical';
    }>;
    critical_count: number;
    has_blockers: boolean;
  };
  mvp_timeline: {
    weeks: number;
    description: string;
  } | null;
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
  };
}

interface Props {
  data: TechFeasibilityData | null;
  loading?: boolean;
  error?: string;
}

export default function TechFeasibilityBlock({ data, loading, error }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-20 bg-zinc-800 rounded" />
        <div className="h-20 bg-zinc-800 rounded" />
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-400 text-sm">{error}</div>;
  if (!data) return <div className="p-4 text-zinc-400 text-sm">Нажмите &quot;Анализировать&quot; для запуска</div>;

  const toggle = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  const complexityColor = data.complexity.level === 'low'
    ? 'text-green-300 bg-green-500/20'
    : data.complexity.level === 'medium'
    ? 'text-yellow-300 bg-yellow-500/20'
    : 'text-red-300 bg-red-500/20';

  const impactDots = (impact: number) => {
    return Array.from({ length: 3 }, (_, i) => (
      <span
        key={i}
        className={`w-2 h-2 rounded-full inline-block ${
          i < impact ? 'bg-orange-400' : 'bg-zinc-700'
        }`}
      />
    ));
  };

  const severityStyles: Record<string, string> = {
    info: 'border-blue-500/30 bg-blue-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    critical: 'border-red-500/30 bg-red-500/5',
  };

  const severityIcons: Record<string, string> = {
    info: '\u2139\uFE0F',
    warning: '\u26A0\uFE0F',
    critical: '\u{1F6D1}',
  };

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Техническая реализуемость"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-xl font-bold">{data.complexity.score}/10</div>
          <div className="text-xs text-zinc-400">Сложность</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${complexityColor}`}>
            {data.complexity.level.toUpperCase()}
          </span>
          <div className="text-xs text-zinc-400 mt-1">Уровень</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <div className="text-xl font-bold">
            {data.mvp_timeline ? `${data.mvp_timeline.weeks}` : '\u2014'}
          </div>
          <div className="text-xs text-zinc-400">Недель на MVP</div>
        </div>
      </div>

      {/* Regulatory warning */}
      {data.regulatory.has_blockers && (
        <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
          <p className="text-sm text-red-300">
            {severityIcons.critical} Обнаружено {data.regulatory.critical_count} критических регуляторных требований
          </p>
        </div>
      )}

      {/* Section: Complexity factors */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('complexity')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Факторы сложности</span>
            <EvidenceBadge type="ai_synthesis" />
          </div>
          <span className="text-zinc-500">{expandedSection === 'complexity' ? '\u2212' : '+'}</span>
        </button>
        {expandedSection === 'complexity' && (
          <div className="px-3 pb-3 space-y-2">
            {data.complexity.factors.map((f, i) => (
              <div key={i} className="bg-zinc-800/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-zinc-200">{f.factor}</span>
                  <div className="flex items-center gap-1">
                    {impactDots(f.impact)}
                  </div>
                </div>
                <p className="text-xs text-zinc-400">{f.description}</p>
              </div>
            ))}
            {data.complexity.factors.length === 0 && (
              <p className="text-sm text-zinc-400">Факторы не определены</p>
            )}
          </div>
        )}
      </div>

      {/* Section: Stack recommendations */}
      {data.stack_recommendations && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('stack')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Рекомендации по стеку</span>
              <EvidenceBadge type="ai_synthesis" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'stack' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'stack' && (
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['Frontend', data.stack_recommendations.frontend, 'bg-blue-500/10 border-blue-500/20'],
                  ['Backend', data.stack_recommendations.backend, 'bg-green-500/10 border-green-500/20'],
                  ['Database', data.stack_recommendations.database, 'bg-purple-500/10 border-purple-500/20'],
                  ['Hosting', data.stack_recommendations.hosting, 'bg-orange-500/10 border-orange-500/20'],
                ] as const).map(([label, value, style]) => (
                  <div key={label} className={`rounded-lg p-2.5 border ${style}`}>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{label}</div>
                    <div className="text-sm font-medium text-zinc-200 mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
              {data.stack_recommendations.reasoning && (
                <p className="text-xs text-zinc-400 mt-2">{data.stack_recommendations.reasoning}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section: Regulatory */}
      {data.regulatory.checks.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('regulatory')} className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Регуляторные требования</span>
              <EvidenceBadge type="ai_synthesis" />
              {data.regulatory.has_blockers && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/20 text-red-300">
                  {data.regulatory.critical_count} критических
                </span>
              )}
            </div>
            <span className="text-zinc-500">{expandedSection === 'regulatory' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'regulatory' && (
            <div className="px-3 pb-3 space-y-2">
              {data.regulatory.checks.map((r, i) => (
                <div key={i} className={`rounded-lg p-3 border ${severityStyles[r.severity] || severityStyles.info}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{severityIcons[r.severity]}</span>
                    <span className="text-sm font-medium text-zinc-200">{r.regulation}</span>
                    {!r.applies && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">Не применимо</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MVP Timeline */}
      {data.mvp_timeline && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-white">Таймлайн MVP</span>
            <EvidenceBadge type="ai_synthesis" />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-indigo-400">{data.mvp_timeline.weeks} нед.</div>
            <p className="text-xs text-zinc-400 flex-1">{data.mvp_timeline.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
