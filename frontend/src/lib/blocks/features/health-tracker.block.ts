import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/HealthTracker.tsx': `'use client';

import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, Minus, Trash2 } from 'lucide-react';

interface Metric {
  id: string;
  name: string;
  unit: string;
  icon: string;
}

interface Entry {
  id: string;
  metric_id: string;
  value: number;
  date: string;
  note?: string;
}

const DEFAULT_METRICS: Metric[] = [
  { id: 'weight', name: 'Вес', unit: 'кг', icon: '⚖️' },
  { id: 'pressure_sys', name: 'Давление (сист.)', unit: 'мм рт.ст.', icon: '❤️' },
  { id: 'pressure_dia', name: 'Давление (диаст.)', unit: 'мм рт.ст.', icon: '💗' },
  { id: 'sugar', name: 'Сахар в крови', unit: 'ммоль/л', icon: '🩸' },
  { id: 'steps', name: 'Шаги', unit: 'шагов', icon: '🚶' },
  { id: 'sleep', name: 'Сон', unit: 'часов', icon: '😴' },
  { id: 'water', name: 'Вода', unit: 'мл', icon: '💧' },
  { id: 'calories', name: 'Калории', unit: 'ккал', icon: '🔥' },
];

interface HealthTrackerProps {
  metrics?: Metric[];
  onSave?: (entry: Entry) => void;
}

export default function HealthTracker({ metrics = DEFAULT_METRICS, onSave }: HealthTrackerProps) {
  const [selected, setSelected] = useState(metrics[0]?.id || '');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('health_tracker_entries');
    if (saved) {
      try { setEntries(JSON.parse(saved)); } catch {}
    }
  }, []);

  function addEntry() {
    if (!value || !selected) return;
    const entry: Entry = {
      id: Date.now().toString(),
      metric_id: selected,
      value: parseFloat(value),
      date: new Date().toISOString(),
      note: note || undefined,
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    localStorage.setItem('health_tracker_entries', JSON.stringify(updated));
    onSave?.(entry);
    setValue('');
    setNote('');
  }

  function removeEntry(id: string) {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    localStorage.setItem('health_tracker_entries', JSON.stringify(updated));
  }

  const metricEntries = entries.filter(e => e.metric_id === selected);
  const currentMetric = metrics.find(m => m.id === selected);

  function getTrend(): 'up' | 'down' | 'flat' {
    if (metricEntries.length < 2) return 'flat';
    const latest = metricEntries[0].value;
    const prev = metricEntries[1].value;
    if (latest > prev) return 'up';
    if (latest < prev) return 'down';
    return 'flat';
  }

  const trend = getTrend();
  const maxVal = metricEntries.length > 0 ? Math.max(...metricEntries.slice(0, 14).map(e => e.value)) : 1;

  return (
    <div className="space-y-4">
      {/* Metric selector */}
      <div className="flex gap-2 flex-wrap">
        {metrics.map(m => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            className="px-3 py-2 rounded-xl text-xs font-medium border transition-all"
            style={{
              borderColor: selected === m.id ? '${t.primary}' : '${t.primary40}',
              background: selected === m.id ? '${t.primary10}' : 'transparent',
              color: selected === m.id ? '${t.primary}' : '${t.text70}',
            }}
          >
            {m.icon} {m.name}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={currentMetric ? currentMetric.unit : 'Значение'}
          className="flex-1 px-4 py-2.5 rounded-xl border text-sm"
          style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
        />
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Заметка (необяз.)"
          className="flex-1 px-4 py-2.5 rounded-xl border text-sm"
          style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
        />
        <button
          onClick={addEntry}
          disabled={!value}
          className="px-4 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 flex items-center gap-1"
          style={{ background: '${t.gradientPrimary}' }}
        >
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      {/* Stats */}
      {metricEntries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border p-3 text-center" style={{ borderColor: '${t.primary40}' }}>
            <p className="text-xs" style={{ color: '${t.text50}' }}>Последнее</p>
            <p className="text-lg font-bold" style={{ color: '${t.text}' }}>{metricEntries[0].value}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {trend === 'up' && <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />}
              {trend === 'down' && <TrendingDown className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />}
              {trend === 'flat' && <Minus className="w-3.5 h-3.5" style={{ color: '${t.text50}' }} />}
            </div>
          </div>
          <div className="rounded-xl border p-3 text-center" style={{ borderColor: '${t.primary40}' }}>
            <p className="text-xs" style={{ color: '${t.text50}' }}>Мин</p>
            <p className="text-lg font-bold" style={{ color: '${t.text}' }}>
              {Math.min(...metricEntries.map(e => e.value))}
            </p>
          </div>
          <div className="rounded-xl border p-3 text-center" style={{ borderColor: '${t.primary40}' }}>
            <p className="text-xs" style={{ color: '${t.text50}' }}>Макс</p>
            <p className="text-lg font-bold" style={{ color: '${t.text}' }}>
              {Math.max(...metricEntries.map(e => e.value))}
            </p>
          </div>
        </div>
      )}

      {/* Mini bar chart (last 14 entries) */}
      {metricEntries.length > 1 && (
        <div className="rounded-xl border p-4" style={{ borderColor: '${t.primary40}' }}>
          <p className="text-xs font-medium mb-3" style={{ color: '${t.text70}' }}>
            Последние {Math.min(metricEntries.length, 14)} записей
          </p>
          <div className="flex items-end gap-1 h-24">
            {metricEntries.slice(0, 14).reverse().map((e, i) => (
              <div
                key={e.id}
                className="flex-1 rounded-t transition-all"
                style={{
                  height: maxVal > 0 ? (e.value / maxVal * 100) + '%' : '10%',
                  background: '${t.gradientPrimary}',
                  minHeight: 4,
                  opacity: 0.5 + (i / 14) * 0.5,
                }}
                title={e.value + ' ' + (currentMetric?.unit || '')}
              />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        {metricEntries.slice(0, 20).map(e => (
          <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '${t.primary40}' }}>
            <div>
              <span className="font-medium" style={{ color: '${t.text}' }}>{e.value} {currentMetric?.unit}</span>
              {e.note && <span className="ml-2 text-xs" style={{ color: '${t.text50}' }}>— {e.note}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '${t.text50}' }}>
                {new Date(e.date).toLocaleDateString('ru-RU')}
              </span>
              <button onClick={() => removeEntry(e.id)} className="p-1 rounded hover:opacity-70">
                <Trash2 className="w-3.5 h-3.5" style={{ color: '${t.text50}' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`,
  };
}
