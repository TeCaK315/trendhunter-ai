'use client';

import { useState } from 'react';
import { useLanguage, Language } from '@/lib/i18n';

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

interface LanguageSwitcherProps {
  compact?: boolean;
}

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = languages.find(l => l.code === language) || languages[0];

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  if (compact) {
    // Simple toggle button for compact mode
    return (
      <button
        onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 hover:text-white transition-all"
        title={language === 'ru' ? 'Switch to English' : 'Переключить на русский'}
      >
        <span className="text-base">{currentLang.flag}</span>
        <span className="hidden sm:inline text-xs font-medium uppercase">{language}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-xl text-sm text-zinc-300 hover:text-white transition-all"
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="font-medium">{currentLang.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-40 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors ${
                  language === lang.code
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-zinc-300'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="font-medium">{lang.label}</span>
                {language === lang.code && (
                  <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
