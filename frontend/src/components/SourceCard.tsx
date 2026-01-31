'use client';

import React from 'react';
import EvidenceBadge from './EvidenceBadge';

interface SourceCardProps {
  title: string;
  url: string;
  source: string;
  snippet?: string;
  engagement?: number;
  rating?: number;
  dataType?: 'real_data' | 'calculated' | 'ai_synthesis' | 'ai_hypothesis';
  className?: string;
}

const sourceIcons: Record<string, string> = {
  reddit: 'R',
  hacker_news: 'HN',
  twitter: 'X',
  quora: 'Q',
  stackoverflow: 'SO',
  g2: 'G2',
  capterra: 'C',
  trustpilot: 'TP',
  producthunt: 'PH',
  google_trends: 'GT',
  google_search: 'G',
  google_news: 'GN',
  youtube: 'YT',
  linkedin: 'LI',
};

const sourceColors: Record<string, string> = {
  reddit: 'bg-orange-500',
  hacker_news: 'bg-orange-600',
  twitter: 'bg-zinc-300 text-black',
  quora: 'bg-red-600',
  stackoverflow: 'bg-yellow-600',
  g2: 'bg-red-500',
  capterra: 'bg-blue-600',
  trustpilot: 'bg-green-600',
  producthunt: 'bg-orange-500',
  google_trends: 'bg-blue-500',
  google_search: 'bg-blue-600',
  google_news: 'bg-blue-700',
  youtube: 'bg-red-600',
  linkedin: 'bg-blue-700',
};

export default function SourceCard({
  title,
  url,
  source,
  snippet,
  engagement,
  rating,
  dataType = 'real_data',
  className = '',
}: SourceCardProps) {
  const icon = sourceIcons[source] || source.substring(0, 2).toUpperCase();
  const bgColor = sourceColors[source] || 'bg-zinc-600';

  return (
    <div className={`border border-zinc-700 rounded-xl p-3 hover:border-zinc-600 transition-colors ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`${bgColor} text-white text-xs font-bold rounded-md w-8 h-8 flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 line-clamp-2"
            >
              {title}
            </a>
            <EvidenceBadge type={dataType} className="flex-shrink-0" />
          </div>
          {snippet && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
              {snippet}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-zinc-500">{source.replace('_', ' ')}</span>
            {engagement !== undefined && engagement > 0 && (
              <span className="text-xs text-zinc-400">
                {engagement > 1000 ? `${(engagement / 1000).toFixed(1)}k` : engagement} engagement
              </span>
            )}
            {rating !== undefined && (
              <span className="text-xs text-yellow-400">{rating}/5</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact version for lists
interface SourceListItemProps {
  title: string;
  url: string;
  source: string;
  metric?: string;
}

export function SourceListItem({ title, url, source, metric }: SourceListItemProps) {
  const icon = sourceIcons[source] || source.substring(0, 2).toUpperCase();
  const bgColor = sourceColors[source] || 'bg-zinc-600';

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className={`${bgColor} text-white text-[10px] font-bold rounded w-5 h-5 flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-indigo-400 hover:text-indigo-300 truncate flex-1"
      >
        {title}
      </a>
      {metric && <span className="text-xs text-zinc-500 flex-shrink-0">{metric}</span>}
    </div>
  );
}
