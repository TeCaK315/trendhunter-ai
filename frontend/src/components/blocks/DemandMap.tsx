'use client';

import React from 'react';

interface DemandMapProps {
  demandIndex: number;       // 0-100
  commercialRatio: number;   // 0-1
  title: string;
}

export default function DemandMap({ demandIndex, commercialRatio, title }: DemandMapProps) {
  // Clamp values to safe range with padding so dot never touches edges
  const clampedX = Math.max(8, Math.min(92, demandIndex));
  const clampedY = Math.max(8, Math.min(92, (1 - commercialRatio) * 100));

  return (
    <div
      className="rounded-xl border border-slate-700 relative"
      style={{ height: 260, background: '#0f172a' }}
    >
      {/* Quadrant labels */}
      <div className="absolute top-3 right-3 text-[10px] font-medium" style={{ color: 'rgba(52,211,153,0.5)' }}>
        GO зона · коммерческий рынок
      </div>
      <div className="absolute top-3 left-3 text-[10px] font-medium" style={{ color: 'rgba(251,191,36,0.5)' }}>
        Слабый объём · есть интент
      </div>
      <div className="absolute bottom-3 right-3 text-[10px] font-medium" style={{ color: 'rgba(96,165,250,0.5)' }}>
        Высокий объём · инфо запросы
      </div>
      <div className="absolute bottom-3 left-3 text-[10px] font-medium" style={{ color: 'rgba(100,116,139,0.6)' }}>
        Нишевый · мало данных
      </div>

      {/* Axis labels */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono" style={{ color: '#334155' }}>
        ОБЪЁМ →
      </div>
      <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-mono" style={{ color: '#334155' }}>
        ИНТЕНТ →
      </div>

      {/* Dividers */}
      <div className="absolute top-0 bottom-0" style={{ left: '45%', width: 1, background: 'rgba(51,65,85,0.5)' }} />
      <div className="absolute left-0 right-0" style={{ top: '50%', height: 1, background: 'rgba(51,65,85,0.5)' }} />

      {/* Label above dot */}
      <div
        className="absolute z-20"
        style={{
          left: `${clampedX}%`,
          top: `${clampedY}%`,
          transform: 'translate(-50%, -32px)',
        }}
      >
        <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: '#34d399' }}>
          {title} ↗
        </span>
      </div>

      {/* Dot — inline styles for guaranteed visibility */}
      <div
        className="absolute z-20"
        style={{
          left: `${clampedX}%`,
          top: `${clampedY}%`,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#34d399',
          boxShadow: '0 0 0 5px rgba(52,211,153,0.25), 0 0 12px rgba(52,211,153,0.4)',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}
