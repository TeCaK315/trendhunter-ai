'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/i18n';

const STORAGE_KEY = 'trendhunter_welcome_completed';

interface WelcomeWizardProps {
  onComplete?: () => void;
}

export default function WelcomeWizard({ onComplete }: WelcomeWizardProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  const steps = [
    {
      icon: '🚀',
      title: t.onboarding.welcome.step1Title,
      desc: t.onboarding.welcome.step1Desc,
      visual: (
        <div className="flex items-center justify-center gap-3 mt-6">
          {['Google Trends', 'SerpAPI', 'AI Analysis'].map((label, i) => (
            <div key={i} className="px-3 py-2 bg-zinc-800/80 rounded-lg border border-zinc-700/50 text-xs text-zinc-300">
              {label}
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: '🔍',
      title: t.onboarding.welcome.step2Title,
      desc: t.onboarding.welcome.step2Desc,
      visual: (
        <div className="grid grid-cols-3 gap-2 mt-6 max-w-xs mx-auto">
          {[
            { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Low' },
            { color: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50', label: '12 players' },
            { color: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50', label: '$1-5K' },
          ].map((item, i) => (
            <div key={i} className={`px-3 py-2 rounded-lg border text-xs text-center ${item.color}`}>
              {item.label}
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: '📊',
      title: t.onboarding.welcome.step3Title,
      desc: t.onboarding.welcome.step3Desc,
      visual: (
        <div className="flex flex-col items-center gap-2 mt-6">
          <div className="flex items-center gap-2">
            {['Evidence', 'Business', 'MVP'].map((label, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-zinc-600 text-xs">→</span>}
                <div className="px-3 py-1.5 bg-indigo-500/15 border border-indigo-500/30 rounded-lg text-xs text-indigo-300">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md mx-4 bg-[#16161a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 p-4 pb-0">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-indigo-500' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 pt-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl">
            {current.icon}
          </div>

          <h2 className="text-xl font-bold text-white mb-3">{current.title}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">{current.desc}</p>

          {current.visual}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-6 pt-2">
          <button
            onClick={complete}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {t.onboarding.skip}
          </button>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
              >
                {t.onboarding.back}
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {t.onboarding.next}
              </button>
            ) : (
              <button
                onClick={complete}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/25"
              >
                {t.onboarding.welcome.getStarted}
              </button>
            )}
          </div>
        </div>

        {/* Step counter */}
        <div className="text-center text-xs text-zinc-600 pb-4">
          {step + 1} {t.onboarding.stepOf} {steps.length}
        </div>
      </div>
    </div>
  );
}
