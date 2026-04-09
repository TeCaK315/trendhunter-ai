'use client';

import React, { useMemo } from 'react';

interface RadarBlock {
  block_number: number;
  name: string;
  score: number;
  diagnosis: string;
}

interface RadarChartProps {
  blocks: RadarBlock[];
  onBlockClick?: (block: RadarBlock) => void;
  size?: number;
}

const DIAGNOSIS_COLORS: Record<string, string> = {
  green: '#00F0A0',
  GREEN: '#00F0A0',
  yellow: '#FFB340',
  YELLOW: '#FFB340',
  red: '#FF4D6A',
  RED: '#FF4D6A',
};

const RING_LEVELS = [0.25, 0.5, 0.75, 1.0];

export default function RadarChart({ blocks, onBlockClick, size = 280 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 40; // leave room for labels

  // Ensure we always have 6 axes
  const axes = useMemo(() => {
    const padded: RadarBlock[] = [];
    for (let i = 1; i <= 6; i++) {
      const found = blocks.find(b => b.block_number === i);
      padded.push(found || { block_number: i, name: `Block ${i}`, score: 0, diagnosis: 'yellow' });
    }
    return padded;
  }, [blocks]);

  const angleStep = (2 * Math.PI) / 6;
  // Start from top (-PI/2)
  const startAngle = -Math.PI / 2;

  function polarToXY(angle: number, r: number): [number, number] {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // Build polygon points from scores
  const polygonPoints = axes.map((block, i) => {
    const angle = startAngle + i * angleStep;
    const r = (block.score / 10) * maxR;
    return polarToXY(angle, r);
  });

  const polygonPath = polygonPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';

  // Concentric rings
  const rings = RING_LEVELS.map(level => {
    const r = level * maxR;
    return { r, label: `${Math.round(level * 100)}%` };
  });

  // Label positions (further out than the last ring)
  const labelR = maxR + 28;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: 'visible' }}
      className="radar-chart"
    >
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#00F0A0" stopOpacity="0.05" />
        </radialGradient>
        <filter id="radarGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Concentric rings */}
      {rings.map((ring, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={ring.r}
          fill="none"
          stroke="#1A2E44"
          strokeWidth="1"
          strokeDasharray={i < rings.length - 1 ? '4 4' : 'none'}
          opacity={0.6}
          style={{ animation: `radarDraw 0.8s ${i * 0.15}s ease-out both` }}
        />
      ))}

      {/* Axis lines */}
      {axes.map((_, i) => {
        const angle = startAngle + i * angleStep;
        const [ex, ey] = polarToXY(angle, maxR);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={ex}
            y2={ey}
            stroke="#1A2E44"
            strokeWidth="1"
            opacity={0.5}
            style={{ animation: `axisGrow 0.6s ${0.3 + i * 0.1}s ease-out both` }}
          />
        );
      })}

      {/* Filled polygon */}
      <path
        d={polygonPath}
        fill="url(#radarFill)"
        stroke="#00D4FF"
        strokeWidth="1.5"
        opacity={0.9}
        filter="url(#radarGlow)"
        style={{ animation: 'radarDraw 1s 0.6s ease-out both' }}
      />

      {/* Score dots */}
      {axes.map((block, i) => {
        const angle = startAngle + i * angleStep;
        const r = (block.score / 10) * maxR;
        const [px, py] = polarToXY(angle, r);
        const color = DIAGNOSIS_COLORS[block.diagnosis] || '#FFB340';

        return (
          <g
            key={`dot-${i}`}
            style={{ cursor: onBlockClick ? 'pointer' : 'default', animation: `dotPop 0.4s ${0.8 + i * 0.1}s ease-out both` }}
            onClick={() => onBlockClick?.(block)}
          >
            {/* Glow */}
            <circle cx={px} cy={py} r="8" fill={color} opacity={0.2} />
            {/* Dot */}
            <circle cx={px} cy={py} r="4" fill={color} stroke="#0B1520" strokeWidth="1.5" />
          </g>
        );
      })}

      {/* Center dot (pulsing cyan) */}
      <circle cx={cx} cy={cy} r="3" fill="#00D4FF" style={{ animation: 'centerPulse 2s ease-in-out infinite' }} />
      <circle cx={cx} cy={cy} r="6" fill="none" stroke="#00D4FF" strokeWidth="0.5" opacity={0.4} style={{ animation: 'centerPulse 2s ease-in-out infinite' }} />

      {/* Labels */}
      {axes.map((block, i) => {
        const angle = startAngle + i * angleStep;
        const [lx, ly] = polarToXY(angle, labelR);
        // Text anchor based on position
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.cos(angle) > 0.3) anchor = 'start';
        else if (Math.cos(angle) < -0.3) anchor = 'end';

        // Truncate name for display
        const displayName = block.name.length > 14 ? block.name.slice(0, 12) + '...' : block.name;

        return (
          <text
            key={`label-${i}`}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="central"
            fill="#8899AA"
            fontSize="10"
            fontFamily="Inter, sans-serif"
            style={{ animation: `labelIn 0.4s ${1 + i * 0.08}s ease-out both` }}
          >
            {displayName}
          </text>
        );
      })}
    </svg>
  );
}
