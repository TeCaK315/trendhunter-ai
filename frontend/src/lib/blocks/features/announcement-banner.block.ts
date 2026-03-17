import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/AnnouncementBanner.tsx': `'use client';

import { useState, useEffect } from 'react';
import { X, Megaphone, ArrowRight, Sparkles } from 'lucide-react';

interface AnnouncementBannerProps {
  id: string;
  text: string;
  linkText?: string;
  linkUrl?: string;
  variant?: 'primary' | 'gradient' | 'warning' | 'info';
  dismissible?: boolean;
  icon?: 'megaphone' | 'sparkles' | 'none';
}

export default function AnnouncementBanner({
  id,
  text,
  linkText,
  linkUrl,
  variant = 'primary',
  dismissible = true,
  icon = 'megaphone',
}: AnnouncementBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem('banner_dismissed_' + id);
    if (!dismissed) setVisible(true);
  }, [id]);

  function dismiss() {
    setVisible(false);
    localStorage.setItem('banner_dismissed_' + id, 'true');
  }

  if (!visible) return null;

  const styles: Record<string, { bg: string; color: string; border?: string }> = {
    primary: { bg: '${t.primary}', color: '#ffffff' },
    gradient: { bg: '${t.gradientPrimary}', color: '#ffffff' },
    warning: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    info: { bg: '${t.primary10}', color: '${t.primary}', border: '${t.primary40}' },
  };

  const s = styles[variant];
  const IconComponent = icon === 'sparkles' ? Sparkles : icon === 'megaphone' ? Megaphone : null;

  return (
    <div className="w-full py-2.5 px-4 flex items-center justify-center gap-3 text-sm"
      style={{ background: s.bg, color: s.color, borderBottom: s.border ? '1px solid ' + s.border : undefined }}>
      {IconComponent && <IconComponent className="w-4 h-4 flex-shrink-0" />}
      <span className="font-medium">{text}</span>
      {linkText && linkUrl && (
        <a href={linkUrl} className="font-bold flex items-center gap-1 hover:underline" style={{ color: s.color }}>
          {linkText} <ArrowRight className="w-3.5 h-3.5" />
        </a>
      )}
      {dismissible && (
        <button onClick={dismiss} className="ml-2 p-0.5 rounded hover:opacity-70 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
`,
  };
}
