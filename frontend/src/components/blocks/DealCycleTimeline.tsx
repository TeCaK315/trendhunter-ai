'use client';

import React from 'react';

interface DealCycleTimelineProps {
  activeStep?: number; // 0-4, default 2 (Демо active)
}

const STEPS = ['Боль', 'Бюджет', 'Демо', 'Триал', 'Оплата'];

export default function DealCycleTimeline({ activeStep = 2 }: DealCycleTimelineProps) {
  return (
    <div className="flex items-center gap-0 w-full mt-3">
      {STEPS.map((step, i) => {
        const status = i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending';
        const isLast = i === STEPS.length - 1;

        return (
          <React.Fragment key={i}>
            {/* Step circle + label */}
            <div
              className="flex flex-col items-center gap-1 shrink-0"
              style={{ animation: `fadeUp 0.4s ease-out ${i * 150}ms both` }}
            >
              <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                status === 'done'
                  ? 'bg-cyan-400/20 border-cyan-400 text-cyan-400'
                  : status === 'active'
                  ? 'bg-emerald-400/20 border-emerald-400 text-emerald-400'
                  : 'bg-[#1A2E42] border-[#243A52] text-[#3E6480]'
              }`}
              style={status === 'active' ? {
                animation: 'pulse 2s ease-in-out infinite',
              } : undefined}
              >
                {status === 'done' ? '✓' : i + 1}
              </div>
              <span className={`text-[9px] font-medium ${
                status === 'done' ? 'text-cyan-400'
                : status === 'active' ? 'text-emerald-400'
                : 'text-[#3E6480]'
              }`}>
                {step}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 h-[2px] min-w-[12px] mx-0.5" style={{
                background: status === 'done' && i + 1 < activeStep
                  ? '#00D4FF'
                  : status === 'done' && i + 1 === activeStep
                  ? 'linear-gradient(90deg, #00D4FF, #00F0A0)'
                  : 'transparent',
                borderTop: status !== 'done' || i + 1 > activeStep
                  ? '2px dashed #243A52'
                  : 'none',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
