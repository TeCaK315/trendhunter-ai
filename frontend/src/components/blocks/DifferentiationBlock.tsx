'use client';

import React, { useState } from 'react';
import EvidenceBadge from '../EvidenceBadge';

interface DifferentiationData {
  positioning_vectors: Array<{
    vector: string;
    description: string;
    target_audience: string;
    evidence: string[];
    effort: 'low' | 'medium' | 'high';
  }>;
  usp: {
    for_whom: string;
    what_does: string;
    how_different: string;
    full_usp: string;
  };
  blue_ocean_strategy: {
    eliminate: string[];
    reduce: string[];
    raise: string[];
    create: string[];
  };
  competitor_weaknesses: Array<{
    competitor: string;
    weakness: string;
    opportunity: string;
  }>;
  blue_ocean_score: number;
  data_inputs: {
    competitors_count: number;
    negative_reviews_count: number;
    unmet_needs_count: number;
    complaints_count: number;
    feature_gaps_count: number;
  };
}

interface Props {
  data: DifferentiationData | null;
  loading?: boolean;
  error?: string;
  onGenerate?: () => void;
  hasEvidenceData?: boolean;
}

export default function DifferentiationBlock({ data, loading, error, onGenerate, hasEvidenceData }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>('vectors');

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

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
          <span className="text-4xl mb-3 block">🎯</span>
          <h3 className="text-lg font-semibold text-white mb-2">Дифференциация и Blue Ocean</h3>
          <p className="text-sm text-zinc-400 mb-4 max-w-md mx-auto">
            Анализ позиционирования, генерация USP и стратегия Blue Ocean на основе слабых мест конкурентов.
          </p>
          {!hasEvidenceData && (
            <p className="text-xs text-amber-400 mb-3">
              Для лучших результатов сначала соберите данные в разделе &quot;Исследование&quot;
            </p>
          )}
          {onGenerate && (
            <button
              onClick={onGenerate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Сгенерировать стратегию
            </button>
          )}
        </div>
      </div>
    );
  }

  const toggle = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  const effortColors: Record<string, string> = {
    low: 'bg-green-500/20 text-green-300',
    medium: 'bg-yellow-500/20 text-yellow-300',
    high: 'bg-red-500/20 text-red-300',
  };

  const effortLabels: Record<string, string> = {
    low: 'Лёгкий',
    medium: 'Средний',
    high: 'Сложный',
  };

  const quadrantColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    eliminate: { bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-300', icon: '✕' },
    reduce: { bg: 'bg-orange-500/5', border: 'border-orange-500/20', text: 'text-orange-300', icon: '↓' },
    raise: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-300', icon: '↑' },
    create: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-300', icon: '★' },
  };

  const quadrantLabels: Record<string, string> = {
    eliminate: 'Убрать',
    reduce: 'Уменьшить',
    raise: 'Увеличить',
    create: 'Создать',
  };

  return (
    <div className="space-y-4">
      {/* USP */}
      {data.usp.full_usp && (
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💎</span>
            <span className="text-sm font-medium text-white">Уникальное торговое предложение (USP)</span>
            <EvidenceBadge type="ai_synthesis" />
          </div>
          <p className="text-lg text-white font-medium leading-relaxed">
            &ldquo;{data.usp.full_usp}&rdquo;
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-zinc-800/40 rounded-lg p-2.5">
              <div className="text-[10px] text-zinc-500 uppercase">Для кого</div>
              <div className="text-xs text-zinc-300 mt-0.5">{data.usp.for_whom}</div>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-2.5">
              <div className="text-[10px] text-zinc-500 uppercase">Что делает</div>
              <div className="text-xs text-zinc-300 mt-0.5">{data.usp.what_does}</div>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-2.5">
              <div className="text-[10px] text-zinc-500 uppercase">Чем отличается</div>
              <div className="text-xs text-zinc-300 mt-0.5">{data.usp.how_different}</div>
            </div>
          </div>
        </div>
      )}

      {/* Positioning Vectors */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('vectors')} className="w-full flex items-center justify-between p-4 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Векторы дифференциации</span>
            <EvidenceBadge type="ai_synthesis" />
            <span className="text-xs text-zinc-500">{data.positioning_vectors.length} векторов</span>
          </div>
          <span className="text-zinc-500">{expandedSection === 'vectors' ? '\u2212' : '+'}</span>
        </button>
        {expandedSection === 'vectors' && (
          <div className="px-4 pb-4 space-y-3">
            {data.positioning_vectors.map((v, i) => (
              <div key={i} className="bg-zinc-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{v.vector}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${effortColors[v.effort]}`}>
                    {effortLabels[v.effort]}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-2">{v.description}</p>
                {v.target_audience && (
                  <div className="text-xs text-zinc-500 mb-2">
                    <span className="text-zinc-600">ЦА:</span> {v.target_audience}
                  </div>
                )}
                {v.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {v.evidence.map((e, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/15">
                        {e}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blue Ocean Strategy Canvas */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('blue-ocean')} className="w-full flex items-center justify-between p-4 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Blue Ocean Strategy</span>
            <EvidenceBadge type="ai_synthesis" />
          </div>
          <span className="text-zinc-500">{expandedSection === 'blue-ocean' ? '\u2212' : '+'}</span>
        </button>
        {expandedSection === 'blue-ocean' && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {(['eliminate', 'reduce', 'raise', 'create'] as const).map((quadrant) => {
                const items = data.blue_ocean_strategy[quadrant];
                const colors = quadrantColors[quadrant];
                if (!items || items.length === 0) return null;

                return (
                  <div key={quadrant} className={`${colors.bg} border ${colors.border} rounded-lg p-3`}>
                    <div className={`text-xs font-semibold ${colors.text} uppercase tracking-wider mb-2 flex items-center gap-1.5`}>
                      <span>{colors.icon}</span>
                      {quadrantLabels[quadrant]}
                    </div>
                    <ul className="space-y-1.5">
                      {items.map((item, i) => (
                        <li key={i} className="text-xs text-zinc-300 flex items-start gap-1.5">
                          <span className="text-zinc-600 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Competitor Weaknesses */}
      {data.competitor_weaknesses.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button onClick={() => toggle('weaknesses')} className="w-full flex items-center justify-between p-4 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Слабости конкурентов</span>
              <EvidenceBadge type="ai_synthesis" />
            </div>
            <span className="text-zinc-500">{expandedSection === 'weaknesses' ? '\u2212' : '+'}</span>
          </button>
          {expandedSection === 'weaknesses' && (
            <div className="px-4 pb-4 space-y-2">
              {data.competitor_weaknesses.map((w, i) => (
                <div key={i} className="bg-zinc-800/30 rounded-lg p-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-xs text-red-300 flex-shrink-0 font-bold">
                    {w.competitor.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-300">{w.competitor}</div>
                    <div className="text-xs text-red-400 mt-0.5">{w.weakness}</div>
                    <div className="text-xs text-emerald-400 mt-1">{w.opportunity}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Data inputs summary */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-600 px-1">
        <span>На основе: {data.data_inputs.competitors_count} конкурентов</span>
        <span>•</span>
        <span>{data.data_inputs.negative_reviews_count} отзывов</span>
        <span>•</span>
        <span>{data.data_inputs.unmet_needs_count} потребностей</span>
      </div>
    </div>
  );
}
