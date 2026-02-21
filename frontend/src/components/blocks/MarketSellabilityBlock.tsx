'use client';

import React, { useState } from 'react';
import EvidenceBadge, { ScoreDisplay } from '../EvidenceBadge';
import SourceCard from '../SourceCard';

interface MarketSellabilityData {
  who_pays: {
    buyer_discussions: Array<{
      text: string;
      source: string;
      source_url: string;
      engagement: number;
    }>;
    buyer_profiles: Array<{
      text: string;
      source: string;
      source_url: string;
      rating?: number;
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
  };
  sales_cycle: {
    complexity: string;
    reasoning: string;
  };
  verdict: {
    value: number;
    formula?: string;
    confidence: number;
  };
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

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <ScoreDisplay
          value={data.verdict.value}
          label="Продаваемость"
          formula={data.verdict.formula}
          confidence={data.verdict.confidence}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 text-center">
          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${segmentColors[data.market_segment.segment_type] || segmentColors.Mixed}`}>
            {data.market_segment.segment_type}
          </span>
          <div className="text-xs text-zinc-400 mt-1">{data.market_segment.confidence}% уверенность</div>
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

      {/* Section: Who pays */}
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
                url={d.source_url}
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
                url={p.source_url}
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

      {/* Section: Market segment */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800">
        <button onClick={() => toggle('segment')} className="w-full flex items-center justify-between p-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Сегмент рынка</span>
            <EvidenceBadge type="calculated" />
          </div>
          <span className="text-zinc-500">{expandedSection === 'segment' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'segment' && (
          <div className="px-3 pb-3 space-y-2">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {Object.entries(data.market_segment.signals).filter(([k]) => k !== 'total').map(([key, val]) => (
                <div key={key} className="bg-zinc-800/50 rounded p-2">
                  <div className="font-bold text-lg">{val as number}</div>
                  <div className="text-zinc-400">{key.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-zinc-400">
              Сигналы из анализа поисковых результатов (частота упоминаний ключевых слов)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
