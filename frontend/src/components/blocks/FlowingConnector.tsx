'use client';

import React from 'react';

export default function FlowingConnector() {
  return (
    <div className="w-full py-2 hidden sm:block" style={{ animation: 'flowPulse 3s ease-in-out infinite' }}>
      <svg viewBox="0 0 880 20" className="w-full h-5" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00F0A0" stopOpacity="0" />
            <stop offset="30%" stopColor="#00F0A0" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#00D4FF" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#9D7FFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,10 Q220,2 440,10 Q660,18 880,10"
          fill="none"
          stroke="url(#flowGrad)"
          strokeWidth="2"
          strokeDasharray="8 4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
