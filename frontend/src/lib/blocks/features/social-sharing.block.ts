import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;

  return {
    'src/components/SocialShare.tsx': `'use client';

import { useState } from 'react';
import { Share2, Link, Check, Twitter, Facebook, Linkedin } from 'lucide-react';

interface SocialShareProps {
  url?: string;
  title?: string;
  description?: string;
}

// Simple social icon components (no external deps)
function TwitterIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
}

function FacebookIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
}

function LinkedinIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
}

export default function SocialShare({ url, title, description }: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareTitle = title || '${projectName}';
  const shareDesc = description || '';

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const socials = [
    {
      name: 'Twitter',
      icon: <TwitterIcon />,
      color: '#1DA1F2',
      url: \`https://twitter.com/intent/tweet?text=\${encodeURIComponent(shareTitle)}&url=\${encodeURIComponent(shareUrl)}\`,
    },
    {
      name: 'Facebook',
      icon: <FacebookIcon />,
      color: '#1877F2',
      url: \`https://www.facebook.com/sharer/sharer.php?u=\${encodeURIComponent(shareUrl)}\`,
    },
    {
      name: 'LinkedIn',
      icon: <LinkedinIcon />,
      color: '#0A66C2',
      url: \`https://www.linkedin.com/sharing/share-offsite/?url=\${encodeURIComponent(shareUrl)}\`,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {socials.map(s => (
        <a
          key={s.name}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg transition-all hover:scale-110"
          style={{ color: s.color }}
          title={s.name}
        >
          {s.icon}
        </a>
      ))}
      <button
        onClick={copyLink}
        className="p-2 rounded-lg transition-all hover:opacity-70 flex items-center gap-1.5"
        style={{ color: '${t.text70}' }}
        title="Копировать ссылку"
      >
        {copied ? <Check className="w-5 h-5" style={{ color: '#22c55e' }} /> : <Link className="w-5 h-5" />}
      </button>
    </div>
  );
}
`,
  };
}
