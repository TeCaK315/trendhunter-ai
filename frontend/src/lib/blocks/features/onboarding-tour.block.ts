import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/OnboardingTour.tsx': `'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete?: () => void;
  storageKey?: string;
}

export default function OnboardingTour({ steps, onComplete, storageKey = 'onboarding_done' }: OnboardingTourProps) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = localStorage.getItem(storageKey);
    if (!done) {
      setTimeout(() => setActive(true), 1000);
    }
  }, [storageKey]);

  const updatePosition = useCallback(() => {
    if (!active || step >= steps.length) return;
    const el = document.querySelector(steps[step].target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [active, step, steps]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [updatePosition]);

  function next() {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      complete();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function complete() {
    setActive(false);
    localStorage.setItem(storageKey, 'true');
    onComplete?.();
  }

  if (!active || steps.length === 0) return null;

  const currentStep = steps[step];
  const tooltipPosition = currentStep.position || 'bottom';

  let tooltipStyle: any = {};
  if (tooltipPosition === 'bottom') {
    tooltipStyle = { top: pos.top + pos.height + 12, left: pos.left };
  } else if (tooltipPosition === 'top') {
    tooltipStyle = { top: pos.top - 12, left: pos.left, transform: 'translateY(-100%)' };
  } else if (tooltipPosition === 'right') {
    tooltipStyle = { top: pos.top, left: pos.left + pos.width + 12 };
  } else {
    tooltipStyle = { top: pos.top, left: pos.left - 12, transform: 'translateX(-100%)' };
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={complete}
      />

      {/* Highlight */}
      <div
        className="absolute z-[9999] rounded-xl ring-4 pointer-events-none transition-all duration-300"
        style={{
          top: pos.top - 4,
          left: pos.left - 4,
          width: pos.width + 8,
          height: pos.height + 8,
          boxShadow: '0 0 0 3px ${t.primary}',
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-[10000] w-72 rounded-2xl border shadow-xl p-5 transition-all duration-300"
        style={{
          ...tooltipStyle,
          background: '${t.bg}',
          borderColor: '${t.primary40}',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: '${t.primary10}', color: '${t.primary}' }}>
            {step + 1} / {steps.length}
          </span>
          <button onClick={complete} className="p-1 rounded hover:opacity-70" style={{ color: '${t.text50}' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <h4 className="font-semibold text-sm mb-1" style={{ color: '${t.text}' }}>{currentStep.title}</h4>
        <p className="text-xs mb-4" style={{ color: '${t.text70}' }}>{currentStep.description}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={step === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 flex items-center gap-1"
            style={{ color: '${t.text70}' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Назад
          </button>
          <button
            onClick={next}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1"
            style={{ background: '${t.gradientPrimary}' }}
          >
            {step === steps.length - 1 ? (
              <><Check className="w-3.5 h-3.5" /> Готово</>
            ) : (
              <>Далее <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
`,
  };
}
