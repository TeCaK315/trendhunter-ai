'use client';

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
        <HelpCircle className="w-6 h-6" style={{ color: '#6366f1' }} />
        <h2 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>{title}</h2>
      </div>

      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#e2e8f050' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по вопросам..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
            style={{ borderColor: '#6366f140', background: '#0f0f23', color: '#e2e8f0' }}
          />
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveCategory('all')}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
            style={{
              borderColor: activeCategory === 'all' ? '#6366f1' : '#6366f140',
              background: activeCategory === 'all' ? '#6366f110' : 'transparent',
              color: activeCategory === 'all' ? '#6366f1' : '#e2e8f070',
            }}>Все</button>
          {categories.map(c => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={{
                borderColor: activeCategory === c ? '#6366f1' : '#6366f140',
                background: activeCategory === c ? '#6366f110' : 'transparent',
                color: activeCategory === c ? '#6366f1' : '#e2e8f070',
              }}>{c}</button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="rounded-xl border overflow-hidden transition-all" style={{ borderColor: isOpen ? '#6366f1' : '#6366f140' }}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium pr-4" style={{ color: '#e2e8f0' }}>{item.question}</span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: '#e2e8f050' }} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: '#e2e8f070' }}>
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm py-8" style={{ color: '#e2e8f050' }}>Вопросы не найдены</p>
      )}
    </div>
  );
}
