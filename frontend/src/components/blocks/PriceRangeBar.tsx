'use client';

import React, { useEffect, useState } from 'react';

interface PriceRangeBarProps {
  min: number;
  median: number;
  premium: number;
  threshold: number;
}

const ANCHORS = [9, 19, 29, 49, 79, 99, 149, 199, 299];

export default function PriceRangeBar({ min, median, premium, threshold }: PriceRangeBarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  const pct = premium !== min
    ? Math.min(Math.max(((threshold - min) / (premium - min)) * 100, 5), 95)
    : 50;
  const nearest = ANCHORS.reduce((prev, curr) =>
    Math.abs(curr - threshold) < Math.abs(prev - threshold) ? curr : prev
  );

  return (
    <div className="relative mt-2 mb-2">
      {/* Track */}
      <div className="h-[6px] rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(90deg, #9D7FFF, #FFB340, #00F0A0)' }}>
      </div>

      {/* Marker dot on track */}
      <div
        className="absolute top-[-4px] transition-all duration-[1200ms] ease-out"
        style={{ left: mounted ? `${pct}%` : '0%', transform: 'translateX(-50%)' }}
      >
        <div className="w-[14px] h-[14px] rounded-full bg-[#00F0A0] border-2 border-[#0C1520]"
          style={{ boxShadow: '0 0 8px rgba(0,240,160,0.6), 0 0 20px rgba(0,240,160,0.3)' }} />
      </div>

      {/* Labels below track */}
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-[#3E6480] font-mono">${min}</span>
        <span className="text-[10px] text-[#3E6480] font-mono">${premium}</span>
      </div>

      {/* Threshold label below, aligned to marker position */}
      <div className="relative h-4 mt-0.5">
        <div
          className="absolute transition-all duration-[1200ms] ease-out whitespace-nowrap"
          style={{ left: mounted ? `${pct}%` : '0%', transform: 'translateX(-50%)' }}
        >
          <span className="text-[11px] font-bold text-[#00F0A0] font-mono">${threshold}</span>
          <span className="text-[9px] text-[#3E6480] ml-1">ближайший: ${nearest}</span>
        </div>
      </div>
    </div>
  );
}
