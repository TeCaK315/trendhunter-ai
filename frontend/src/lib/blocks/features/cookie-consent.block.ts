import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/CookieConsent.tsx': `'use client';

import { useState, useEffect } from 'react';
import { Cookie, X, Settings, Check } from 'lucide-react';

interface CookieConsentProps {
  privacyUrl?: string;
  onAccept?: (preferences: CookiePreferences) => void;
}

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export default function CookieConsent({ privacyUrl = '/privacy', onAccept }: CookieConsentProps) {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    functional: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setTimeout(() => setVisible(true), 1500);
    }
  }, []);

  function acceptAll() {
    const all: CookiePreferences = { necessary: true, analytics: true, marketing: true, functional: true };
    save(all);
  }

  function acceptSelected() {
    save(preferences);
  }

  function rejectAll() {
    const min: CookiePreferences = { necessary: true, analytics: false, marketing: false, functional: false };
    save(min);
  }

  function save(prefs: CookiePreferences) {
    localStorage.setItem('cookie_consent', JSON.stringify(prefs));
    setVisible(false);
    onAccept?.(prefs);
  }

  if (!visible) return null;

  const categories = [
    { key: 'necessary' as const, label: 'Необходимые', desc: 'Обязательные для работы сайта', locked: true },
    { key: 'functional' as const, label: 'Функциональные', desc: 'Улучшают работу (язык, тема)', locked: false },
    { key: 'analytics' as const, label: 'Аналитические', desc: 'Помогают понять использование сайта', locked: false },
    { key: 'marketing' as const, label: 'Маркетинговые', desc: 'Используются для рекламы', locked: false },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4">
      <div className="max-w-2xl mx-auto rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: '${t.bg}', borderColor: '${t.primary40}' }}>
        {!showSettings ? (
          <div className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <Cookie className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: '${t.primary}' }} />
              <div>
                <h3 className="text-sm font-bold" style={{ color: '${t.text}' }}>Мы используем cookies</h3>
                <p className="text-xs mt-1" style={{ color: '${t.text70}' }}>
                  Мы используем файлы cookie для улучшения работы сайта. Вы можете настроить предпочтения или принять все.{' '}
                  <a href={privacyUrl} className="underline" style={{ color: '${t.primary}' }}>Политика конфиденциальности</a>
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={acceptAll}
                className="px-4 py-2 rounded-xl text-white text-xs font-medium hover:opacity-90 transition-all"
                style={{ background: '${t.gradientPrimary}' }}>
                Принять все
              </button>
              <button onClick={rejectAll}
                className="px-4 py-2 rounded-xl border text-xs font-medium hover:opacity-80 transition-all"
                style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
                Только необходимые
              </button>
              <button onClick={() => setShowSettings(true)}
                className="px-4 py-2 rounded-xl border text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-all"
                style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
                <Settings className="w-3.5 h-3.5" /> Настроить
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: '${t.text}' }}>Настройки cookies</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:opacity-70">
                <X className="w-4 h-4" style={{ color: '${t.text50}' }} />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              {categories.map(cat => (
                <div key={cat.key} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '${t.primary40}' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '${t.text}' }}>{cat.label}</p>
                    <p className="text-xs" style={{ color: '${t.text50}' }}>{cat.desc}</p>
                  </div>
                  <button
                    disabled={cat.locked}
                    onClick={() => setPreferences(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
                    className="w-10 h-6 rounded-full p-0.5 transition-all disabled:opacity-60"
                    style={{ background: preferences[cat.key] ? '${t.primary}' : '${t.primary20}' }}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow transition-all"
                      style={{ marginLeft: preferences[cat.key] ? 16 : 0 }} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={acceptSelected}
                className="flex-1 py-2.5 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-1"
                style={{ background: '${t.gradientPrimary}' }}>
                <Check className="w-3.5 h-3.5" /> Сохранить
              </button>
              <button onClick={acceptAll}
                className="flex-1 py-2.5 rounded-xl border text-xs font-medium"
                style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
                Принять все
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`,
  };
}
