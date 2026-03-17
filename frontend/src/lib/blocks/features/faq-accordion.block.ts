import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/FaqAccordion.tsx': `'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Search, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category?: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  title?: string;
  searchable?: boolean;
}

export default function FaqAccordion({ items, title = 'Частые вопросы', searchable = true }: FaqAccordionProps) {
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = useMemo(() => {
    return Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[];
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q));
    }
    if (activeCategory !== 'all') {
      result = result.filter(i => i.category === activeCategory);
    }
    return result;
  }, [items, search, activeCategory]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-6 h-6" style={{ color: '${t.primary}' }} />
        <h2 className="text-xl font-bold" style={{ color: '${t.text}' }}>{title}</h2>
      </div>

      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '${t.text50}' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по вопросам..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
            style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
          />
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveCategory('all')}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
            style={{
              borderColor: activeCategory === 'all' ? '${t.primary}' : '${t.primary40}',
              background: activeCategory === 'all' ? '${t.primary10}' : 'transparent',
              color: activeCategory === 'all' ? '${t.primary}' : '${t.text70}',
            }}>Все</button>
          {categories.map(c => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={{
                borderColor: activeCategory === c ? '${t.primary}' : '${t.primary40}',
                background: activeCategory === c ? '${t.primary10}' : 'transparent',
                color: activeCategory === c ? '${t.primary}' : '${t.text70}',
              }}>{c}</button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="rounded-xl border overflow-hidden transition-all" style={{ borderColor: isOpen ? '${t.primary}' : '${t.primary40}' }}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium pr-4" style={{ color: '${t.text}' }}>{item.question}</span>
                <ChevronDown className={\`w-4 h-4 flex-shrink-0 transition-transform \${isOpen ? 'rotate-180' : ''}\`} style={{ color: '${t.text50}' }} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: '${t.text70}' }}>
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm py-8" style={{ color: '${t.text50}' }}>Вопросы не найдены</p>
      )}
    </div>
  );
}
`,
  };
}
