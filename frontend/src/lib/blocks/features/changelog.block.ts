import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/Changelog.tsx': `'use client';

import { useState } from 'react';
import { Sparkles, Bug, Wrench, Zap, Tag } from 'lucide-react';

type ChangeType = 'feature' | 'fix' | 'improvement' | 'breaking';

interface ChangeEntry {
  type: ChangeType;
  text: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  title?: string;
  changes: ChangeEntry[];
}

interface ChangelogProps {
  entries: ChangelogEntry[];
  title?: string;
}

const TYPE_CONFIG: Record<ChangeType, { label: string; color: string; bg: string; Icon: any }> = {
  feature: { label: 'Новое', color: '#22c55e', bg: '#f0fdf4', Icon: Sparkles },
  fix: { label: 'Исправление', color: '#ef4444', bg: '#fef2f2', Icon: Bug },
  improvement: { label: 'Улучшение', color: '#3b82f6', bg: '#eff6ff', Icon: Zap },
  breaking: { label: 'Breaking', color: '#f59e0b', bg: '#fffbeb', Icon: Wrench },
};

export default function Changelog({ entries, title = 'Что нового' }: ChangelogProps) {
  const [filter, setFilter] = useState<ChangeType | 'all'>('all');

  const filtered = filter === 'all'
    ? entries
    : entries.map(e => ({
        ...e,
        changes: e.changes.filter(c => c.type === filter),
      })).filter(e => e.changes.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold" style={{ color: '${t.text}' }}>{title}</h2>
        <div className="flex gap-2">
          {(['all', 'feature', 'fix', 'improvement', 'breaking'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                borderColor: filter === f ? '${t.primary}' : '${t.primary40}',
                background: filter === f ? '${t.primary10}' : 'transparent',
                color: filter === f ? '${t.primary}' : '${t.text70}',
              }}>
              {f === 'all' ? 'Все' : TYPE_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: '${t.primary20}' }} />

        <div className="space-y-6">
          {filtered.map((entry, i) => (
            <div key={i} className="relative pl-12">
              {/* Dot */}
              <div className="absolute left-3 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: '${t.primary}', background: '${t.bg}' }}>
                <Tag className="w-2.5 h-2.5" style={{ color: '${t.primary}' }} />
              </div>

              <div className="rounded-xl border p-4" style={{ borderColor: '${t.primary40}' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: '${t.primary10}', color: '${t.primary}' }}>
                    v{entry.version}
                  </span>
                  <span className="text-xs" style={{ color: '${t.text50}' }}>{entry.date}</span>
                  {entry.title && <span className="text-sm font-medium" style={{ color: '${t.text}' }}>{entry.title}</span>}
                </div>

                <div className="space-y-2">
                  {entry.changes.map((change, ci) => {
                    const cfg = TYPE_CONFIG[change.type];
                    const Icon = cfg.Icon;
                    return (
                      <div key={ci} className="flex items-start gap-2">
                        <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </span>
                        <span className="text-sm" style={{ color: '${t.text70}' }}>{change.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`,
  };
}
