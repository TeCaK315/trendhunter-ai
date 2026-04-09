'use client';

import React from 'react';

const SPOT_TYPES: Record<string, { description: string }> = {
  lockin_opportunity: { description: 'Конкурент создал зависимость' },
  unserved_segment: { description: 'Сегмент без решения' },
  pricing_gap: { description: 'Ценовой разрыв' },
  tech_shift: { description: 'Технологический сдвиг' },
  intent_mismatch: { description: 'Несоответствие намерений' },
};

interface SpotTypeLegendProps {
  detectedTypes: string[];
}

export default function SpotTypeLegend({ detectedTypes }: SpotTypeLegendProps) {
  const normalizedDetected = (detectedTypes || []).map((t) => t.toLowerCase());

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: '#0C1520',
        border: '1px solid #1E3044',
      }}
    >
      {Object.entries(SPOT_TYPES).map(([key, { description }], i) => {
        const isDetected = normalizedDetected.includes(key);

        return (
          <div
            key={key}
            className="flex items-center gap-2.5 py-2.5"
            style={{
              borderBottom:
                i < Object.keys(SPOT_TYPES).length - 1
                  ? '1px solid #111C28'
                  : 'none',
              fontSize: '13px',
            }}
          >
            {/* Dot */}
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                background: isDetected ? '#00F0A0' : '#2A3A50',
              }}
            />

            {/* Name */}
            <span
              className="font-mono text-xs font-medium min-w-[150px]"
              style={{ color: '#E2EBF4' }}
            >
              {key}
            </span>

            {/* Status badge */}
            <span
              className="inline-flex items-center gap-1 rounded-full font-mono font-semibold"
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                background: isDetected
                  ? 'rgba(0,240,160,0.1)'
                  : 'rgba(74,96,128,0.08)',
                border: isDetected
                  ? '1px solid rgba(0,240,160,0.3)'
                  : '1px solid #111C28',
                color: isDetected ? '#00F0A0' : '#4A6080',
              }}
            >
              {isDetected ? 'НАЙДЕНО' : 'НЕ НАЙДЕНО'}
            </span>

            {/* Description */}
            <span
              className="text-xs flex-1"
              style={{ color: '#4A6080' }}
            >
              — {'\u00AB'}{description}{'\u00BB'}
            </span>

            {/* Condition tag */}
            <span
              className="font-mono whitespace-nowrap rounded ml-auto"
              style={{
                fontSize: '10px',
                color: '#2A3A50',
                background: '#111C28',
                padding: '2px 7px',
              }}
            >
              условие
            </span>
          </div>
        );
      })}
    </div>
  );
}
