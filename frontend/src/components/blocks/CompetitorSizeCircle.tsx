'use client';

import React from 'react';

const sizeMap = {
  large:  { px: 44, color: '#00F0A0', bg: 'rgba(0,240,160,0.15)' },
  medium: { px: 34, color: '#FFB340', bg: 'rgba(255,179,64,0.12)' },
  small:  { px: 24, color: '#2E4D68', bg: 'rgba(46,77,104,0.3)' },
  micro:  { px: 18, color: '#1A2E42', bg: 'rgba(26,46,66,0.3)' },
};

interface CompetitorSizeCircleProps {
  name: string;
  size: 'micro' | 'small' | 'medium' | 'large';
  index?: number;
}

export default function CompetitorSizeCircle({ name, size, index = 0 }: CompetitorSizeCircleProps) {
  const s = sizeMap[size] || sizeMap.small;
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: s.px, height: s.px,
        backgroundColor: s.bg,
        border: `2px solid ${s.color}`,
        color: s.color,
        fontSize: Math.max(s.px * 0.32, 9),
        fontFamily: 'Syne, sans-serif',
        animation: `circleScale 0.4s ease-out ${index * 0.1}s both`,
      }}
    >
      {initials}
    </div>
  );
}
