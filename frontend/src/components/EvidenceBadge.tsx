'use client';

import React from 'react';

type DataType = 'real_data' | 'calculated' | 'ai_synthesis' | 'ai_hypothesis' | 'no_data' | 'not_available' | 'insufficient_data' | 'not_provided';

interface EvidenceBadgeProps {
  type: DataType;
  label?: string;
  className?: string;
}

const badgeConfig: Record<DataType, { color: string; bg: string; icon: string; defaultLabel: string }> = {
  real_data: {
    color: 'text-green-300',
    bg: 'bg-green-900/30 border-green-800',
    icon: '✓',
    defaultLabel: 'Реальные данные',
  },
  calculated: {
    color: 'text-blue-300',
    bg: 'bg-blue-900/30 border-blue-800',
    icon: 'ƒ',
    defaultLabel: 'Расчёт',
  },
  ai_synthesis: {
    color: 'text-yellow-300',
    bg: 'bg-yellow-900/30 border-yellow-800',
    icon: '⚡',
    defaultLabel: 'AI-синтез',
  },
  ai_hypothesis: {
    color: 'text-orange-300',
    bg: 'bg-orange-900/30 border-orange-800',
    icon: '?',
    defaultLabel: 'Гипотеза',
  },
  no_data: {
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/30 border-zinc-700',
    icon: '—',
    defaultLabel: 'Нет данных',
  },
  not_available: {
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/30 border-zinc-700',
    icon: '—',
    defaultLabel: 'Недоступно',
  },
  insufficient_data: {
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/30 border-zinc-700',
    icon: '—',
    defaultLabel: 'Мало данных',
  },
  not_provided: {
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/30 border-zinc-700',
    icon: '—',
    defaultLabel: 'Не предоставлено',
  },
};

export default function EvidenceBadge({ type, label, className = '' }: EvidenceBadgeProps) {
  const config = badgeConfig[type] || badgeConfig.no_data;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.color} ${className}`}
    >
      <span className="text-[10px]">{config.icon}</span>
      {label || config.defaultLabel}
    </span>
  );
}

// Score display with confidence
interface ScoreDisplayProps {
  value: number;
  maxValue?: number;
  confidence?: number;
  label: string;
  formula?: string;
}

export function ScoreDisplay({ value, maxValue = 10, confidence, label, formula }: ScoreDisplayProps) {
  const percentage = (value / maxValue) * 100;
  let barColor = 'bg-zinc-600';
  if (percentage >= 70) barColor = 'bg-green-500';
  else if (percentage >= 40) barColor = 'bg-yellow-500';
  else if (percentage > 0) barColor = 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <span className="text-sm font-bold text-white">{value}/{maxValue}</span>
      </div>
      <div className="w-full bg-zinc-700 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        {formula && <span title={formula}>Формула: {formula.substring(0, 40)}{formula.length > 40 ? '...' : ''}</span>}
        {confidence !== undefined && <span>Уверенность: {confidence}%</span>}
      </div>
    </div>
  );
}
