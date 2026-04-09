'use client';

import React from 'react';

interface UpstreamConfidenceDotsProps {
  confidence?: { b1: string; b2: string; b3: string; b4: string; b5: string };
  dependsOn: number[];
  overallConfidence: string; // 'high' | 'medium' | 'low'
}

const CONFIDENCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  high: {
    bg: 'rgba(0,240,160,0.15)',
    border: 'rgba(0,240,160,0.4)',
    text: '#00F0A0',
  },
  medium: {
    bg: 'rgba(255,179,64,0.12)',
    border: 'rgba(255,179,64,0.35)',
    text: '#FFB340',
  },
  low: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    text: '#EF4444',
  },
};

const BAR_WIDTHS: Record<string, string> = {
  high: '92%',
  medium: '60%',
  low: '30%',
};

const BAR_COLORS: Record<string, string> = {
  high: '#00F0A0',
  medium: '#FFB340',
  low: '#EF4444',
};

export default function UpstreamConfidenceDots({
  confidence,
  dependsOn,
  overallConfidence,
}: UpstreamConfidenceDotsProps) {
  const level = (overallConfidence || 'medium').toLowerCase();
  const barWidth = BAR_WIDTHS[level] || '60%';
  const barColor = BAR_COLORS[level] || '#FFB340';

  const dots = [
    { key: 'b1', label: 'B1', value: confidence?.b1 || 'unknown' },
    { key: 'b2', label: 'B2', value: confidence?.b2 || 'unknown' },
    { key: 'b3', label: 'B3', value: confidence?.b3 || 'unknown' },
    { key: 'b4', label: 'B4', value: confidence?.b4 || 'unknown' },
    { key: 'b5', label: 'B5', value: confidence?.b5 || 'unknown' },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className="font-mono text-[11px] min-w-[130px]"
        style={{ color: '#4A6080' }}
      >
        upstream confidence
      </span>

      {/* Bar */}
      <div
        className="flex-1 h-1 rounded overflow-hidden min-w-[80px]"
        style={{ background: '#111C28' }}
      >
        <div
          className="h-full rounded"
          style={{
            background: barColor,
            width: barWidth,
            animation: 'barGrow 1.2s ease 0.4s both',
          }}
        />
      </div>

      {/* Value */}
      <span
        className="font-mono text-[11px] font-semibold min-w-[30px]"
        style={{ color: barColor }}
      >
        {level.toUpperCase()}
      </span>

      {/* Dots */}
      <div className="flex gap-1.5 items-center">
        {dots.map((dot, i) => {
          const blockNum = i + 1;
          const isActive = dependsOn.includes(blockNum);
          const dotLevel = (dot.value || 'unknown').toLowerCase();
          const colors = CONFIDENCE_COLORS[dotLevel] || CONFIDENCE_COLORS.medium;

          return (
            <div
              key={dot.key}
              className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-mono text-[10px] font-semibold"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                opacity: isActive ? 1 : 0.4,
                transition: 'opacity 0.3s',
              }}
            >
              {dot.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
