'use client';

import React from 'react';

interface RevenueRangeBarProps {
  low: number;
  mid: number;
  high: number;
  monthlyLow: number;
  monthlyMid: number;
  monthlyHigh: number;
  dataQualityScore: number;
}

function fmt(n: number): string {
  if (!n || isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function fmtMonthly(n: number): string {
  if (!n || isNaN(n)) return '—';
  return `$${Math.round(n / 1_000)}K/мес`;
}

export default function RevenueRangeBar({ low, mid, high, monthlyLow, monthlyMid, monthlyHigh, dataQualityScore }: RevenueRangeBarProps) {
  return (
    <div className="bg-[#0C1520] border border-[#1A2E42] rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-[14px] font-bold text-[#7AAAC8]" style={{ fontFamily: 'Syne, sans-serif' }}>Revenue Range · потенциал ниши</span>
        <span className="flex-1 h-px bg-[#1A2E42]" />
      </div>

      {/* Range bar with markers */}
      <div className="relative mt-8 mb-20">
        <div className="h-[10px] rounded-[5px] overflow-visible"
          style={{ background: 'linear-gradient(90deg, rgba(255,78,91,0.08), rgba(255,179,64,0.09), rgba(0,240,160,0.08))' }}>
          <div className="h-full rounded-[5px]"
            style={{ background: 'linear-gradient(90deg, rgba(255,78,91,0.4), rgba(255,179,64,0.6), rgba(0,240,160,0.7))', animation: 'barIn 1.2s 0.4s ease both' }} />
        </div>

        {/* LOW marker */}
        <div className="absolute top-1/2 left-0 flex flex-col items-center" style={{ transform: 'translateX(-50%)', animation: 'markerPop 0.5s 0.8s ease both', opacity: 0 }}>
          <div className="w-[14px] h-[14px] rounded-full bg-[#FF4E5B] border-2 border-[#060A0E] -mt-[7px]" />
          <div className="mt-2.5 text-center">
            <div className="text-[13px] font-extrabold text-[#FF4E5B] whitespace-nowrap" style={{ fontFamily: 'Syne, sans-serif' }}>{fmt(low)}</div>
            <div className="text-[10px] text-[#3E6480]" style={{ fontFamily: 'Syne, sans-serif' }}>LOW</div>
          </div>
        </div>

        {/* MID marker */}
        <div className="absolute top-1/2 left-1/2 flex flex-col items-center" style={{ transform: 'translateX(-50%)', animation: 'markerPop 0.5s 1.0s ease both', opacity: 0 }}>
          <div className="w-[18px] h-[18px] rounded-full bg-[#FFB340] border-2 border-[#060A0E] -mt-[9px]" style={{ animation: 'markerGlow 2s 1.5s ease infinite' }} />
          <div className="mt-2.5 text-center">
            <div className="text-[15px] font-extrabold text-[#FFB340] whitespace-nowrap" style={{ fontFamily: 'Syne, sans-serif' }}>{fmt(mid)}</div>
            <div className="text-[10px] text-[#3E6480]" style={{ fontFamily: 'Syne, sans-serif' }}>MID</div>
            <div className="text-[10px] text-[#FFB340]">↑ базовый</div>
          </div>
        </div>

        {/* HIGH marker */}
        <div className="absolute top-1/2 right-0 flex flex-col items-center" style={{ transform: 'translateX(50%)', animation: 'markerPop 0.5s 1.2s ease both', opacity: 0 }}>
          <div className="w-[14px] h-[14px] rounded-full bg-[#00F0A0] border-2 border-[#060A0E] -mt-[7px]" />
          <div className="mt-2.5 text-center">
            <div className="text-[13px] font-extrabold text-[#00F0A0] whitespace-nowrap" style={{ fontFamily: 'Syne, sans-serif' }}>{fmt(high)}</div>
            <div className="text-[10px] text-[#3E6480]" style={{ fontFamily: 'Syne, sans-serif' }}>HIGH</div>
          </div>
        </div>
      </div>

      {/* Monthly row */}
      <div className="grid grid-cols-3 gap-0 mb-4">
        {[
          { val: monthlyLow, label: 'LOW SCENARIO', color: '#3E6480' },
          { val: monthlyMid, label: 'MID SCENARIO', color: '#FFB340' },
          { val: monthlyHigh, label: 'HIGH SCENARIO', color: '#00F0A0' },
        ].map((s, i) => (
          <div key={i} className={`text-center py-2 ${i === 1 ? 'border-x border-[#1A2E42]' : ''}`}>
            <div className="text-[16px] font-bold" style={{ fontFamily: 'Syne, sans-serif', color: s.color }}>{fmtMonthly(s.val)}</div>
            <div className="text-[10px] text-[#3E6480]" style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Data quality bar */}
      <div className="pt-3.5 border-t border-[#1A2E42]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[12px] text-[#7AAAC8] font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>Качество данных</span>
          <span className="text-[12px] text-[#00F0A0] font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>{dataQualityScore}/10</span>
        </div>
        <div className="h-[6px] bg-[#162435] rounded-[3px] overflow-hidden mb-1.5">
          <div className="h-full rounded-[3px]" style={{
            background: 'linear-gradient(90deg, #00D4FF, #00F0A0)',
            width: `${dataQualityScore * 10}%`,
            animation: 'barIn 1s 0.8s ease both',
          }} />
        </div>
        <div className="flex justify-between text-[10px] text-[#3E6480] font-mono">
          <span>0</span><span>3</span><span>5</span><span>7</span><span>10</span>
        </div>
      </div>
    </div>
  );
}
