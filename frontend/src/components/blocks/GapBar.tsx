'use client';

import React from 'react';

interface GapBarProps {
  category: string;
  percent: number;
  gapType: 'strategic' | 'execution';
  animationDelay: number;
}

export default function GapBar({ category, percent, gapType, animationDelay }: GapBarProps) {
  const color = gapType === 'strategic' ? '#00F0A0' : '#FFB340';
  const badgeColor = gapType === 'strategic'
    ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
    : 'bg-amber-400/10 text-amber-400 border-amber-400/20';

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-[11px] text-[#7AAAC8] w-[100px] shrink-0 truncate">{category}</span>
      <div className="flex-1 h-[6px] bg-[#1A2E42] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: color,
            width: `${percent}%`,
            animation: `gapBarIn 0.8s ease-out ${animationDelay}s both`,
            ['--target-width' as string]: `${percent}%`,
          }}
        />
      </div>
      <span className="text-[10px] text-[#3E6480] font-mono w-[30px] text-right shrink-0">{percent}%</span>
      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeColor}`}>
        {gapType === 'strategic' ? 'STRATEGIC' : 'EXECUTION'}
      </span>
    </div>
  );
}
