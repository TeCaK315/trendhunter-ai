'use client';

import { useState, useEffect } from 'react';
import OnboardingTour, { resetOnboardingTour } from './OnboardingTour';
import { useTranslations } from '@/lib/i18n';

const HINT_STORAGE_KEY = 'trendhunter_help_hint_shown';

export default function HelpButton() {
  const [showTour, setShowTour] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  // Show hint for first-time users
  useEffect(() => {
    setMounted(true);
    const hintShown = localStorage.getItem(HINT_STORAGE_KEY);
    if (!hintShown) {
      // Show hint after a short delay
      const timer = setTimeout(() => {
        setShowHint(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissHint = () => {
    setShowHint(false);
    localStorage.setItem(HINT_STORAGE_KEY, 'true');
  };

  const handleStartTour = () => {
    setShowMenu(false);
    setShowHint(false);
    localStorage.setItem(HINT_STORAGE_KEY, 'true');
    resetOnboardingTour();
    setShowTour(true);
  };

  const handleOpenMenu = () => {
    setShowMenu(!showMenu);
    if (showHint) {
      dismissHint();
    }
  };

  const handleTourComplete = () => {
    setShowTour(false);
  };

  return (
    <>
      {/* Help Button */}
      <div className="fixed bottom-6 right-24 z-50">
        <div className="relative">
          {/* Menu */}
          {showMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 animate-fadeIn">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 px-2">
                {t.help.title}
              </div>

              <button
                onClick={handleStartTour}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors group"
              >
                <span className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <div>
                  <div className="font-medium text-sm">{t.help.showTour}</div>
                  <div className="text-xs text-zinc-500">{t.help.tourDescription}</div>
                </div>
              </button>

              <a
                href="https://github.com/your-repo/trendhunter-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors group"
              >
                <span className="w-8 h-8 bg-zinc-700/50 rounded-lg flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </span>
                <div>
                  <div className="font-medium text-sm">{t.help.documentation}</div>
                  <div className="text-xs text-zinc-500">{t.help.githubRepo}</div>
                </div>
              </a>

              <div className="border-t border-zinc-800 mt-2 pt-2">
                <div className="px-3 py-2 text-xs text-zinc-600">
                  TrendHunter AI {t.help.version} 1.0
                </div>
              </div>
            </div>
          )}

          {/* Hint bubble for first-time users */}
          {mounted && showHint && !showMenu && (
            <div className="absolute bottom-full right-0 mb-3 animate-fadeIn">
              <div className="relative bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-lg max-w-[220px]">
                <button
                  onClick={dismissHint}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <p className="text-sm font-medium">
                  {t.help.hintText || 'Нужна помощь? Нажми сюда для обзора функций'}
                </p>
                {/* Arrow pointing down */}
                <div className="absolute -bottom-2 right-4 w-4 h-4 bg-indigo-600 rotate-45" />
              </div>
            </div>
          )}

          {/* Button */}
          <button
            onClick={handleOpenMenu}
            className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
              showMenu
                ? 'bg-zinc-700 text-white'
                : showHint
                ? 'bg-indigo-600 text-white animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105'
            }`}
            aria-label={t.help.title}
          >
            {showMenu ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <span className="text-xl font-bold">?</span>
            )}
          </button>
        </div>
      </div>

      {/* Backdrop for menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Tour component */}
      {showTour && (
        <OnboardingTour forceShow={true} onComplete={handleTourComplete} />
      )}
    </>
  );
}
