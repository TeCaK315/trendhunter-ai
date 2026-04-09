'use client';

import React from 'react';

interface LockedSpotsCardProps {
  remainingLocked: number;
  teaser: string;
  trendId: string;
}

function spotWord(n: number): string {
  if (n === 1) return 'пятно';
  if (n >= 2 && n <= 4) return 'пятна';
  return 'пятен';
}

export default function LockedSpotsCard({
  remainingLocked,
  teaser,
}: LockedSpotsCardProps) {
  if (remainingLocked <= 0) return null;

  return (
    <div
      className="rounded-[14px] p-5 text-center"
      style={{
        background: 'rgba(8,12,16,0.6)',
        border: '1px dashed #1E3044',
      }}
    >
      <div className="text-2xl mb-2 opacity-50">
        {'\uD83D\uDD12'}
      </div>

      <div
        className="text-[15px] font-bold mb-1"
        style={{ color: '#4A6080' }}
      >
        {'Ещё'} {remainingLocked} {spotWord(remainingLocked)} {'скрыто'}
      </div>

      {teaser && (
        <div
          className="italic text-xs mb-4"
          style={{
            color: '#2A3A50',
            maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          }}
        >
          {teaser}
        </div>
      )}

      <div className="flex gap-2.5 justify-center">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg font-mono text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
          style={{
            padding: '8px 18px',
            background: 'transparent',
            border: '1px solid #1E3044',
            color: '#4A6080',
          }}
        >
          {'\u23F0'} 1 бесплатно завтра
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg font-mono text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
          style={{
            padding: '8px 18px',
            background: '#00F0A0',
            border: 'none',
            color: '#080C10',
          }}
        >
          {'\uD83D\uDD13'} Все за 5 токенов
        </button>
      </div>

      <div
        className="font-mono mt-2.5"
        style={{ fontSize: '10px', color: '#2A3A50' }}
      >
        5 токенов {'\u00B7'} безвозвратно {'\u00B7'} доступно сразу
      </div>
    </div>
  );
}
