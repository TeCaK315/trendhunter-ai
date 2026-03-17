'use client';

import { useState, useEffect } from 'react';
import type { Trend } from '@/types/trend';

type KanbanStage = 'new' | 'interesting' | 'analyzing' | 'launching';

interface KanbanItem {
  trendId: string;
  stage: KanbanStage;
}

interface KanbanViewProps {
  trends: Trend[];
  onAnalyze: (trend: Trend) => void;
}

const stages: { id: KanbanStage; label: string; icon: string; color: string; description: string }[] = [
  { id: 'new', label: 'Новые', icon: '✨', color: 'border-zinc-600', description: 'Только что обнаружены' },
  { id: 'interesting', label: 'Интересные', icon: '👀', color: 'border-yellow-500/50', description: 'Стоит присмотреться' },
  { id: 'analyzing', label: 'Анализирую', icon: '🔬', color: 'border-indigo-500/50', description: 'Глубокий анализ' },
  { id: 'launching', label: 'Запускаю', icon: '🚀', color: 'border-green-500/50', description: 'Готов к запуску' },
];

const STORAGE_KEY = 'trendhunter_kanban';

export default function KanbanView({ trends, onAnalyze }: KanbanViewProps) {
  const [kanbanItems, setKanbanItems] = useState<KanbanItem[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setKanbanItems(JSON.parse(saved));
    } catch {}
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (kanbanItems.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kanbanItems));
    }
  }, [kanbanItems]);

  const getStage = (trendId: string): KanbanStage => {
    return kanbanItems.find(k => k.trendId === trendId)?.stage || 'new';
  };

  const moveToStage = (trendId: string, stage: KanbanStage) => {
    setKanbanItems(prev => {
      const existing = prev.find(k => k.trendId === trendId);
      if (existing) {
        return prev.map(k => k.trendId === trendId ? { ...k, stage } : k);
      }
      return [...prev, { trendId, stage }];
    });
  };

  const getTrendsForStage = (stage: KanbanStage): Trend[] => {
    if (stage === 'new') {
      const movedIds = kanbanItems.filter(k => k.stage !== 'new').map(k => k.trendId);
      return trends.filter(t => !movedIds.includes(t.id));
    }
    const ids = kanbanItems.filter(k => k.stage === stage).map(k => k.trendId);
    return trends.filter(t => ids.includes(t.id));
  };

  // Drag handlers
  const handleDragStart = (trendId: string) => {
    setDraggedId(trendId);
  };

  const handleDragOver = (e: React.DragEvent, stage: KanbanStage) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (stage: KanbanStage) => {
    if (draggedId) {
      moveToStage(draggedId, stage);
    }
    setDraggedId(null);
    setDragOverStage(null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stages.map(stage => {
        const stageTrends = getTrendsForStage(stage.id);
        const isDragOver = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            className={`rounded-2xl border-2 transition-all duration-200 ${stage.color} ${
              isDragOver ? 'bg-indigo-500/5 scale-[1.01]' : 'bg-zinc-900/30'
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(stage.id)}
          >
            {/* Column header */}
            <div className="px-4 py-3 border-b border-zinc-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{stage.icon}</span>
                  <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
                </div>
                <span className="text-xs text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                  {stageTrends.length}
                </span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-0.5">{stage.description}</p>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[120px] max-h-[60vh] overflow-y-auto scrollbar-hide">
              {stageTrends.length === 0 && (
                <div className="flex items-center justify-center py-8 text-zinc-700 text-xs">
                  Перетащите сюда
                </div>
              )}
              {stageTrends.map(trend => (
                <div
                  key={trend.id}
                  draggable
                  onDragStart={() => handleDragStart(trend.id)}
                  className={`p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 cursor-grab active:cursor-grabbing hover:bg-zinc-800/70 transition-all group ${
                    draggedId === trend.id ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="text-sm font-medium text-white leading-tight line-clamp-2">{trend.title}</h4>
                    {trend.growth_rate > 0 && (
                      <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        +{trend.growth_rate}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">{trend.category}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Move buttons */}
                      {stage.id !== 'new' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); moveToStage(trend.id, stages[stages.findIndex(s => s.id === stage.id) - 1]?.id || 'new'); }}
                          className="w-5 h-5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400 flex items-center justify-center text-[10px]"
                          title="Назад"
                        >
                          ←
                        </button>
                      )}
                      {stage.id !== 'launching' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); moveToStage(trend.id, stages[stages.findIndex(s => s.id === stage.id) + 1]?.id || 'launching'); }}
                          className="w-5 h-5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400 flex items-center justify-center text-[10px]"
                          title="Далее"
                        >
                          →
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onAnalyze(trend); }}
                        className="w-5 h-5 rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-[10px]"
                        title="Анализировать"
                      >
                        ⚡
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
