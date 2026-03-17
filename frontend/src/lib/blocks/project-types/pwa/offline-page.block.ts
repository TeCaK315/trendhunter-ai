import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  return {
    // ─── Offline Page ───
    'src/app/offline/page.tsx': `import { WifiOff, RefreshCw } from 'lucide-react';

export const metadata = {
  title: 'Offline - ${name}',
};

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '${t.bg}' }}
    >
      <div className="text-center max-w-md">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ background: '${t.primary20}' }}
        >
          <WifiOff className="w-10 h-10" style={{ color: '${t.primary}' }} />
        </div>

        {/* Title */}
        <h1
          className="text-3xl font-bold mb-3"
          style={{ color: '${t.text}', fontFamily: '${t.headingFont}' }}
        >
          You are offline
        </h1>

        {/* Description */}
        <p className="mb-8 leading-relaxed" style={{ color: '${t.text70}' }}>
          It looks like you have lost your internet connection.
          Please check your network settings and try again.
        </p>

        {/* Retry Button */}
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors"
          style={{ background: '${t.primary}', color: 'white' }}
        >
          <RefreshCw className="w-5 h-5" />
          Try Again
        </a>

        {/* Subtle branding */}
        <p className="mt-10 text-xs" style={{ color: '${t.text50}' }}>
          ${name}
        </p>
      </div>
    </div>
  );
}
`,

    // ─── InstallPrompt Component ───
    'src/components/InstallPrompt.tsx': `'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    if (sessionStorage.getItem('pwa-banner-dismissed')) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowBanner(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 rounded-2xl p-4 shadow-2xl border backdrop-blur-xl"
      style={{
        background: '${t.bg}',
        borderColor: '${t.primary40}',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '${t.gradientPrimary}' }}
        >
          <Download className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-sm mb-1"
            style={{ color: '${t.text}', fontFamily: '${t.headingFont}' }}
          >
            Install ${name}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: '${t.text70}' }}>
            Add to your home screen for a faster, app-like experience with offline support.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '${t.primary}', color: 'white' }}
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              style={{ color: '${t.text70}' }}
            >
              Not now
            </button>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" style={{ color: '${t.text50}' }} />
        </button>
      </div>
    </div>
  );
}
`,
  };
}
