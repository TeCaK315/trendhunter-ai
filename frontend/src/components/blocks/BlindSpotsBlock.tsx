'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';

interface BlindSpot {
  index: number;
  type: string;
  title: string;
  insight: string;
  teaser: string;
  impact: 'high' | 'medium' | 'low';
  data_signals: string[];
}

interface BlindSpotsData {
  diagnosis: 'green' | 'yellow' | 'red';
  score: number;
  key_metric: string;
  blind_spots_count: number;
  first_spot: {
    title: string;
    insight: string;
    impact: 'high' | 'medium' | 'low';
  } | null;
  first_spot_teaser: string;
  remaining_locked: number;
  // premium
  all_blind_spots?: BlindSpot[];
  blind_spots_impact?: 'high' | 'medium' | 'low';
  has_revenue_multiplier?: boolean;
  block_context?: any;
}

interface Props {
  data: BlindSpotsData | null;
  loading?: boolean;
  error?: string;
}

const impactColors: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  low: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
};

const typeLabels: Record<string, string> = {
  unserved_segment: 'Неохваченный сегмент',
  pricing_gap: 'Ценовой разрыв',
  tech_shift: 'Технологический сдвиг',
  intent_mismatch: 'Несовпадение намерений',
  lockin_opportunity: 'Возможность удержания',
};

const impactLabels: Record<string, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export default function BlindSpotsBlock({ data, loading, error }: Props) {
  const [expandedSpot, setExpandedSpot] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-4 bg-zinc-800 rounded w-1/2" />
        <div className="h-20 bg-zinc-800 rounded" />
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

  const diagnosisToScore = {
    green: 8,
    yellow: 5,
    red: 3,
  };

  const verdictValue = data.score || diagnosisToScore[data.diagnosis] || 5;
  const spots = data.all_blind_spots || (data.first_spot ? [{
    index: 0,
    type: 'unserved_segment',
    title: data.first_spot.title,
    insight: data.first_spot.insight,
    teaser: '',
    impact: data.first_spot.impact,
    data_signals: [],
  }] : []);

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={verdictValue}
          label="Слепые пятна"
          formula={data.key_metric}
          confidence={data.diagnosis === 'green' ? 0.8 : data.diagnosis === 'yellow' ? 0.6 : 0.4}
        />
      </div>

      {/* Summary */}
      {data.has_revenue_multiplier && (
        <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm font-medium">Revenue Multiplier</span>
          </div>
          <p className="text-sm text-zinc-300 mt-1">
            Обнаружены возможности для кратного увеличения выручки
          </p>
        </div>
      )}

      {/* Blind Spots List */}
      {spots.length > 0 ? (
        <div className="space-y-3">
          {spots.map((spot, i) => {
            const colors = impactColors[spot.impact] || impactColors.medium;
            const isExpanded = expandedSpot === i;

            return (
              <div
                key={i}
                className={`rounded-xl border ${colors.border} overflow-hidden`}
              >
                <button
                  onClick={() => setExpandedSpot(isExpanded ? null : i)}
                  className="w-full flex items-start justify-between p-3 text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                        {typeLabels[spot.type] || spot.type}
                      </span>
                      <span className={`text-xs ${colors.text}`}>
                        Impact: {impactLabels[spot.impact] || spot.impact}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-white">{spot.title}</span>
                  </div>
                  <span className="text-zinc-500 ml-2">{isExpanded ? '\u2212' : '+'}</span>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-sm text-zinc-300">{spot.insight}</p>

                    {spot.data_signals?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-zinc-500 font-medium">Data signals:</span>
                        <ul className="mt-1 space-y-1">
                          {spot.data_signals.map((signal, j) => (
                            <li key={j} className="text-xs text-zinc-400 flex items-start gap-1.5">
                              <span className="text-zinc-600 mt-0.5">&bull;</span>
                              {signal}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 text-center">
          <p className="text-sm text-zinc-400">Слепые пятна не обнаружены</p>
        </div>
      )}

      {/* Locked spots teaser */}
      {data.remaining_locked > 0 && !data.all_blind_spots && (
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 border-dashed text-center">
          <EvidenceBadge type="ai_synthesis" />
          <p className="text-sm text-zinc-400 mt-1">
            Ещё {data.remaining_locked} скрытых пятен
          </p>
          {data.first_spot_teaser && (
            <p className="text-xs text-zinc-500 mt-1 italic">{data.first_spot_teaser}</p>
          )}
        </div>
      )}
    </div>
  );
}
