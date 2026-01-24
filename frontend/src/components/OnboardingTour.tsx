'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from '@/lib/i18n';

interface TourStepConfig {
  target: string; // CSS selector
  stepKey: 'home' | 'research' | 'favorites' | 'projects' | 'generate' | 'trendCard';
  position: 'top' | 'bottom' | 'left' | 'right';
  highlight?: boolean;
}

const TOUR_STEPS_CONFIG: TourStepConfig[] = [
  {
    target: '[data-tour="nav-home"]',
    stepKey: 'home',
    position: 'right',
    highlight: true
  },
  {
    target: '[data-tour="nav-research"]',
    stepKey: 'research',
    position: 'right',
    highlight: true
  },
  {
    target: '[data-tour="nav-favorites"]',
    stepKey: 'favorites',
    position: 'right',
    highlight: true
  },
  {
    target: '[data-tour="nav-projects"]',
    stepKey: 'projects',
    position: 'right',
    highlight: true
  },
  {
    target: '[data-tour="generate-trends"]',
    stepKey: 'generate',
    position: 'bottom',
    highlight: true
  },
  {
    target: '[data-tour="trend-card"]',
    stepKey: 'trendCard',
    position: 'bottom',
    highlight: true
  }
];

const STORAGE_KEY = 'trendhunter_onboarding_completed';

interface OnboardingTourProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

export default function OnboardingTour({ forceShow = false, onComplete }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();

  // Check if should show tour
  useEffect(() => {
    setMounted(true);

    if (forceShow) {
      setIsActive(true);
      setCurrentStep(0);
      return;
    }

    // Don't auto-start tour anymore - user will click help button
    // Tour only starts when forceShow is true (from HelpButton)
  }, [forceShow]);

  // Update target element position
  const updateTargetPosition = useCallback(() => {
    if (!isActive) return;

    const stepConfig = TOUR_STEPS_CONFIG[currentStep];
    if (!stepConfig) return;

    const element = document.querySelector(stepConfig.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);

      // Scroll element into view if needed
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      // Skip to next step if element not found
      if (currentStep < TOUR_STEPS_CONFIG.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        completeTour();
      }
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    updateTargetPosition();

    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition);
    };
  }, [updateTargetPosition]);

  const nextStep = () => {
    if (currentStep < TOUR_STEPS_CONFIG.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const completeTour = () => {
    setIsActive(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
  };

  const skipTour = () => {
    completeTour();
  };

  if (!mounted || !isActive) return null;

  const stepConfig = TOUR_STEPS_CONFIG[currentStep];
  if (!stepConfig) return null;

  // Get translated content
  const stepTranslation = t.onboarding.steps[stepConfig.stepKey];

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { display: 'none' };

    const padding = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    let top = 0;
    let left = 0;

    switch (stepConfig.position) {
      case 'top':
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left - tooltipWidth - padding;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.right + padding;
        break;
    }

    // Keep tooltip within viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 10001
    };
  };

  // Get highlight style for target element
  const getHighlightStyle = (): React.CSSProperties => {
    if (!targetRect || !stepConfig.highlight) return { display: 'none' };

    const padding = 8;
    return {
      position: 'fixed',
      top: `${targetRect.top - padding}px`,
      left: `${targetRect.left - padding}px`,
      width: `${targetRect.width + padding * 2}px`,
      height: `${targetRect.height + padding * 2}px`,
      borderRadius: '8px',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
      zIndex: 9999,
      pointerEvents: 'none' as const
    };
  };

  return createPortal(
    <>
      {/* Overlay with highlight cutout */}
      <div style={getHighlightStyle()} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-5 animate-fadeIn"
      >
        {/* Progress indicator */}
        <div className="flex gap-1 mb-3">
          {TOUR_STEPS_CONFIG.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= currentStep ? 'bg-indigo-500' : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-white mb-2">{stepTranslation.title}</h3>
        <p className="text-zinc-400 text-sm leading-relaxed mb-4">{stepTranslation.content}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={skipTour}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            {t.onboarding.skip}
          </button>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="px-3 py-1.5 text-sm text-zinc-300 hover:text-white transition-colors"
              >
                {t.onboarding.back}
              </button>
            )}
            <button
              onClick={nextStep}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {currentStep === TOUR_STEPS_CONFIG.length - 1 ? t.onboarding.done : t.onboarding.next}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <div className="text-center text-xs text-zinc-600 mt-3">
          {currentStep + 1} {t.onboarding.stepOf} {TOUR_STEPS_CONFIG.length}
        </div>
      </div>
    </>,
    document.body
  );
}

// Export function to reset tour (for testing)
export function resetOnboardingTour() {
  localStorage.removeItem(STORAGE_KEY);
}

// Export function to check if tour completed
export function isOnboardingCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}
