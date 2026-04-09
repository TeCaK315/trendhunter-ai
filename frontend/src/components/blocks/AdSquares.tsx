'use client';

import React from 'react';

interface AdSquaresProps {
  density: number; // 0-1
}

export default function AdSquares({ density }: AdSquaresProps) {
  const paidCount = Math.round(density * 10);

  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`w-[22px] h-[22px] rounded-[5px] transition-colors ${
            i < paidCount
              ? 'bg-cyan-400 opacity-85'
              : 'bg-slate-700 border border-slate-600'
          }`}
        />
      ))}
    </div>
  );
}
