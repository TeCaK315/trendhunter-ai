import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/OnboardingChecklist.tsx': `'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Circle, ChevronDown, ChevronUp, X, Rocket, ArrowRight } from 'lucide-react';

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  action?: string;
  actionUrl?: string;
}

interface OnboardingChecklistProps {
  items: ChecklistItem[];
  storageKey?: string;
  title?: string;
  onComplete?: () => void;
  onAction?: (itemId: string) => void;
}

export default function OnboardingChecklist({
  items,
  storageKey = 'onboarding_progress',
  title = 'Начало работы',
  onComplete,
  onAction,
}: OnboardingChecklistProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.completed) setCompleted(new Set(parsed.completed));
        if (parsed.dismissed) setDismissed(true);
      } catch {}
    }
  }, [storageKey]);

  function save(comp: Set<string>, dismiss = false) {
    localStorage.setItem(storageKey, JSON.stringify({
      completed: Array.from(comp),
      dismissed: dismiss,
    }));
  }

  function toggleItem(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
      if (next.size === items.length) onComplete?.();
      return next;
    });
  }

  function dismiss() {
    setDismissed(true);
    save(completed, true);
  }

  if (dismissed) return null;

  const progress = items.length > 0 ? Math.round((completed.size / items.length) * 100) : 0;
  const allDone = completed.size === items.length;

  if (allDone) {
    return (
      <div className="rounded-2xl border p-5 text-center" style={{ borderColor: '#22c55e', background: '#f0fdf4' }}>
        <Rocket className="w-10 h-10 mx-auto mb-2" style={{ color: '#22c55e' }} />
        <h3 className="text-lg font-bold" style={{ color: '#166534' }}>Всё готово!</h3>
        <p className="text-sm mt-1" style={{ color: '#15803d' }}>Вы завершили настройку. Отличная работа!</p>
        <button onClick={dismiss} className="mt-3 text-xs underline" style={{ color: '#15803d' }}>Скрыть</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Rocket className="w-5 h-5" style={{ color: '${t.primary}' }} />
          <div className="text-left">
            <h3 className="text-sm font-bold" style={{ color: '${t.text}' }}>{title}</h3>
            <p className="text-xs" style={{ color: '${t.text50}' }}>{completed.size} из {items.length} выполнено</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: '${t.primary10}' }}>
            <div className="h-full rounded-full transition-all" style={{ width: progress + '%', background: '${t.gradientPrimary}' }} />
          </div>
          <span className="text-xs font-bold" style={{ color: '${t.primary}' }}>{progress}%</span>
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: '${t.text50}' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '${t.text50}' }} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4" style={{ borderColor: '${t.primary40}' }}>
          {items.map((item, i) => {
            const isDone = completed.has(item.id);
            return (
              <div key={item.id} className="flex items-start gap-3 py-3 border-b last:border-b-0" style={{ borderColor: '${t.primary40}' }}>
                <button onClick={() => toggleItem(item.id)} className="mt-0.5 flex-shrink-0">
                  {isDone ? (
                    <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />
                  ) : (
                    <Circle className="w-5 h-5" style={{ color: '${t.text50}' }} />
                  )}
                </button>
                <div className="flex-1">
                  <p className={\`text-sm font-medium \${isDone ? 'line-through opacity-50' : ''}\`} style={{ color: '${t.text}' }}>
                    {item.title}
                  </p>
                  {item.description && !isDone && (
                    <p className="text-xs mt-0.5" style={{ color: '${t.text50}' }}>{item.description}</p>
                  )}
                </div>
                {item.action && !isDone && (
                  <button onClick={() => { onAction?.(item.id); if (item.actionUrl) window.location.href = item.actionUrl; }}
                    className="px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 flex-shrink-0"
                    style={{ background: '${t.primary10}', color: '${t.primary}' }}>
                    {item.action} <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={dismiss} className="mt-2 text-xs" style={{ color: '${t.text50}' }}>Скрыть чеклист</button>
        </div>
      )}
    </div>
  );
}
`,
  };
}
