'use client';

import React from 'react';

interface SplitBarProps {
  commercialRatio: number; // 0-1
}

export default function SplitBar({ commercialRatio }: SplitBarProps) {
  const commercial = Math.round(commercialRatio * 100);
  const informational = 100 - commercial;

  return (
    <div className="h-[22px] rounded-md overflow-hidden flex w-full bg-slate-700">
      <div
        className="h-full bg-emerald-400 flex items-center justify-center transition-all duration-700 ease-out"
        style={{ width: `${commercial}%` }}
      >
        {commercial >= 15 && (
          <span className="text-[10px] font-bold text-slate-900 whitespace-nowrap">
            {commercial}% КУПИТЬ
          </span>
        )}
      </div>
      <div className="h-full flex-1 flex items-center justify-center">
        {informational >= 15 && (
          <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
            {informational}% ПОНЯТЬ
          </span>
        )}
      </div>
    </div>
  );
}
