'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GLOSSARY, type GlossaryKey } from '@/lib/glossary';

interface MetricTooltipProps {
  term: GlossaryKey;
  value?: string | number;
}

const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

export default function MetricTooltip({ term, value }: MetricTooltipProps) {
  const [open, setOpen] = useState(false);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiText, setWikiText] = useState<string | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiUrl, setWikiUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const entry = GLOSSARY[term];
  if (!entry) return null;

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const fetchWiki = async () => {
    if (wikiText || wikiLoading) { setWikiOpen(!wikiOpen); return; }
    setWikiOpen(true);
    setWikiLoading(true);
    try {
      const res = await fetch(WIKI_API + encodeURIComponent(entry.wiki_slug));
      const data = await res.json();
      setWikiText(data.extract ?? 'Статья не найдена');
      setWikiUrl(data.content_urls?.desktop?.page ?? `https://ru.wikipedia.org/wiki/${entry.wiki_slug}`);
    } catch {
      setWikiText('Статья временно недоступна');
    } finally {
      setWikiLoading(false);
    }
  };

  // Context text from glossary
  let contextText: string | null = null;
  if (value != null && entry.context) {
    try {
      contextText = (entry.context as any)(value);
    } catch { /* context function mismatch — skip */ }
  }

  return (
    <div className="relative inline-flex" ref={ref}>
      {/* Info icon */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full ml-1 align-middle transition-colors shrink-0"
        style={{
          background: '#162435', border: '1px solid #243C55',
          color: '#3E6480', fontSize: 9, cursor: 'pointer',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = '#00D4FF'; (e.target as HTMLElement).style.color = '#00D4FF'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = '#243C55'; (e.target as HTMLElement).style.color = '#3E6480'; }}
      >
        i
      </button>

      {/* Popup */}
      {open && (
        <div
          className="fixed z-[1000] w-[320px]"
          style={{
            background: '#111D2A', border: '1px solid #243C55', borderRadius: 14,
            padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeUp 0.2s ease both',
            top: (() => {
              const rect = ref.current?.getBoundingClientRect();
              if (!rect) return '50%';
              // Show below if near top of viewport, above otherwise
              return rect.top < 300 ? `${rect.bottom + 8}px` : `${rect.top - 8}px`;
            })(),
            left: (() => {
              const rect = ref.current?.getBoundingClientRect();
              if (!rect) return '50%';
              return `${Math.max(16, Math.min(rect.left - 140, window.innerWidth - 336))}px`;
            })(),
            transform: (() => {
              const rect = ref.current?.getBoundingClientRect();
              if (!rect) return 'translateY(-100%)';
              return rect.top < 300 ? 'none' : 'translateY(-100%)';
            })(),
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-bold text-[#EAF2FF]" style={{ fontFamily: 'Syne, sans-serif' }}>{entry.title}</span>
            <button onClick={() => setOpen(false)} className="text-[#3E6480] hover:text-[#7AAAC8] text-[12px]">✕</button>
          </div>
          <div className="text-[11px] text-[#7AAAC8] mb-3">{entry.short}</div>

          {/* Plain explanation */}
          <div className="border-t border-[#1A2E42] pt-3 mb-3">
            <div className="text-[10px] text-[#3E6480] mb-1 font-semibold">Простыми словами:</div>
            <p className="text-[11px] text-[#7AAAC8] leading-relaxed">{entry.plain}</p>
          </div>

          {/* Context with real data */}
          {contextText && (
            <div className="border-t border-[#1A2E42] pt-3 mb-3">
              <div className="text-[10px] text-[#3E6480] mb-1 font-semibold">В твоём случае:</div>
              <p className="text-[11px] text-[#EAF2FF] leading-relaxed">{contextText}</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
