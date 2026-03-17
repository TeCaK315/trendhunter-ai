'use client';

import { useState } from 'react';
import type { Trend } from '@/types/trend';

type SortKey = 'title' | 'category' | 'growth_rate' | 'competition_level' | 'top_players_count' | 'entry_cost_estimate' | 'first_detected_at';

interface TableViewProps {
  trends: Trend[];
  onAnalyze: (trend: Trend) => void;
  onCompare: (trend: Trend) => void;
  compareList: string[];
}

const competitionOrder = { low: 1, medium: 2, high: 3 };

export default function TableView({ trends, onAnalyze, onCompare, compareList }: TableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('growth_rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...trends].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sortKey) {
      case 'title':
        return sortDir === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
      case 'category':
        return sortDir === 'asc' ? a.category.localeCompare(b.category) : b.category.localeCompare(a.category);
      case 'growth_rate':
        aVal = a.growth_rate || 0; bVal = b.growth_rate || 0;
        break;
      case 'competition_level':
        aVal = competitionOrder[a.competition_level || 'medium'];
        bVal = competitionOrder[b.competition_level || 'medium'];
        break;
      case 'top_players_count':
        aVal = a.top_players_count || 0; bVal = b.top_players_count || 0;
        break;
      case 'entry_cost_estimate':
        aVal = parseCost(a.entry_cost_estimate); bVal = parseCost(b.entry_cost_estimate);
        break;
      case 'first_detected_at':
        aVal = new Date(a.first_detected_at).getTime(); bVal = new Date(b.first_detected_at).getTime();
        break;
      default:
        return 0;
    }
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const SortHeader = ({ label, field, className }: { label: string; field: SortKey; className?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none ${className || ''}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === field && (
          <span className="text-indigo-400">{sortDir === 'desc' ? '↓' : '↑'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-800">
          <tr>
            <th className="px-3 py-3 w-10">
              <span className="text-xs text-zinc-500">VS</span>
            </th>
            <SortHeader label="Ниша" field="title" />
            <SortHeader label="Категория" field="category" className="hidden sm:table-cell" />
            <SortHeader label="Рост" field="growth_rate" />
            <SortHeader label="Конкуренция" field="competition_level" />
            <SortHeader label="Игроки" field="top_players_count" className="hidden md:table-cell" />
            <SortHeader label="Вход" field="entry_cost_estimate" className="hidden md:table-cell" />
            <th className="px-3 py-3 w-24"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {sorted.map((trend) => {
            const isSelected = compareList.includes(trend.id);
            return (
              <tr
                key={trend.id}
                className={`hover:bg-zinc-800/30 transition-colors ${isSelected ? 'bg-indigo-500/5' : ''}`}
              >
                <td className="px-3 py-3">
                  <button
                    onClick={() => onCompare(trend)}
                    className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                      isSelected
                        ? 'bg-indigo-500 border-indigo-500 text-white'
                        : 'border-zinc-600 hover:border-indigo-400'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <span className="text-white font-medium">{trend.title}</span>
                </td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  <span className="text-zinc-400 text-xs">{trend.category}</span>
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    (trend.growth_rate || 0) > 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                  }`}>
                    {(trend.growth_rate || 0) > 0 ? '+' : ''}{trend.growth_rate}%
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      trend.competition_level === 'low' ? 'bg-green-400' :
                      trend.competition_level === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
                    }`} />
                    <span className={`text-xs ${
                      trend.competition_level === 'low' ? 'text-green-400' :
                      trend.competition_level === 'medium' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {trend.competition_level === 'low' ? 'Низкая' :
                       trend.competition_level === 'medium' ? 'Средняя' : 'Высокая'}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className="text-zinc-300 text-xs">{trend.top_players_count ?? '—'}</span>
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className="text-zinc-300 text-xs">{trend.entry_cost_estimate || '—'}</span>
                </td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => onAnalyze(trend)}
                    className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                  >
                    Анализ
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function parseCost(cost?: string): number {
  if (!cost) return 0;
  const match = cost.match(/\$?([\d,.]+)/);
  if (!match) return 0;
  return parseFloat(match[1].replace(/,/g, '')) || 0;
}
