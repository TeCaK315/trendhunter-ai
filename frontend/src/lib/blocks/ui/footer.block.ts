import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  return {
    'src/components/Footer.tsx': `'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useT } from '@/lib/i18n';

export default function Footer() {
  const t = useT();

  return (
    <footer
      className="border-t py-8"
      style={{
        background: '${t.bg}',
        borderColor: '${t.primary10}',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: '${t.gradientPrimary}' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span
              className="text-sm font-heading font-semibold"
              style={{ color: '${t.text}' }}
            >
              ${name}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs transition-opacity hover:opacity-70" style={{ color: '${t.text50}' }}>{t('legal.privacyPolicy')}</Link>
            <Link href="/terms" className="text-xs transition-opacity hover:opacity-70" style={{ color: '${t.text50}' }}>{t('legal.termsOfService')}</Link>
            <Link href="/about" className="text-xs transition-opacity hover:opacity-70" style={{ color: '${t.text50}' }}>{t('legal.aboutUs')}</Link>
            <Link href="/faq" className="text-xs transition-opacity hover:opacity-70" style={{ color: '${t.text50}' }}>{t('legal.faq')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
`,
  };
}
