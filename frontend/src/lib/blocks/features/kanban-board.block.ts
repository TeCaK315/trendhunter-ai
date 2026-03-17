import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/KanbanBoard.tsx': `'use client';

import { useState } from 'react';
import { Plus, GripVertical, X, MoreHorizontal } from 'lucide-react';

interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

interface KanbanBoardProps {
  initialColumns?: KanbanColumn[];
  onCardMove?: (cardId: string, fromCol: string, toCol: string) => void;
  onCardAdd?: (columnId: string, card: KanbanCard) => void;
}

const defaultColumns: KanbanColumn[] = [
  { id: 'todo', title: 'К выполнению', cards: [] },
  { id: 'in-progress', title: 'В работе', cards: [] },
  { id: 'done', title: 'Готово', cards: [] },
];

export default function KanbanBoard({ initialColumns, onCardMove, onCardAdd }: KanbanBoardProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns || defaultColumns);
  const [draggedCard, setDraggedCard] = useState<{ card: KanbanCard; fromCol: string } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  function handleDragStart(card: KanbanCard, colId: string) {
    setDraggedCard({ card, fromCol: colId });
  }

  function handleDrop(toColId: string) {
    if (!draggedCard || draggedCard.fromCol === toColId) {
      setDraggedCard(null);
      return;
    }

    setColumns(prev => prev.map(col => {
      if (col.id === draggedCard.fromCol) {
        return { ...col, cards: col.cards.filter(c => c.id !== draggedCard.card.id) };
      }
      if (col.id === toColId) {
        return { ...col, cards: [...col.cards, draggedCard.card] };
      }
      return col;
    }));

    onCardMove?.(draggedCard.card.id, draggedCard.fromCol, toColId);
    setDraggedCard(null);
  }

  function addCard(colId: string) {
    if (!newTitle.trim()) return;
    const card: KanbanCard = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
    };
    setColumns(prev => prev.map(col =>
      col.id === colId ? { ...col, cards: [...col.cards, card] } : col
    ));
    onCardAdd?.(colId, card);
    setNewTitle('');
    setAddingTo(null);
  }

  function removeCard(colId: string, cardId: string) {
    setColumns(prev => prev.map(col =>
      col.id === colId ? { ...col, cards: col.cards.filter(c => c.id !== cardId) } : col
    ));
  }

  const priorityColors: Record<string, React.CSSProperties> = {
    high: { background: '#fee2e2', color: '#dc2626' },
    medium: { background: '#fef3c7', color: '#d97706' },
    low: { background: '#dcfce7', color: '#16a34a' },
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(col => (
        <div
          key={col.id}
          className="min-w-[280px] w-[280px] rounded-2xl border flex-shrink-0"
          style={{ borderColor: '${t.primary40}', background: '${t.primary10}' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(col.id)}
        >
          {/* Column header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm" style={{ color: '${t.text}' }}>{col.title}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '${t.primary20}', color: '${t.text70}' }}>
                {col.cards.length}
              </span>
            </div>
            <button
              onClick={() => setAddingTo(addingTo === col.id ? null : col.id)}
              className="p-1 rounded hover:opacity-70"
              style={{ color: '${t.primary}' }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add card form */}
          {addingTo === col.id && (
            <div className="px-3 pb-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCard(col.id)}
                placeholder="Название задачи..."
                autoFocus
                className="w-full px-3 py-2 rounded-xl border text-sm"
                style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => addCard(col.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: '${t.primary}' }}
                >
                  Добавить
                </button>
                <button
                  onClick={() => { setAddingTo(null); setNewTitle(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ color: '${t.text70}' }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Cards */}
          <div className="px-3 pb-3 space-y-2">
            {col.cards.map(card => (
              <div
                key={card.id}
                draggable
                onDragStart={() => handleDragStart(card, col.id)}
                className="p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]"
                style={{ background: '${t.bg}', borderColor: '${t.primary20}' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium flex-1" style={{ color: '${t.text}' }}>{card.title}</p>
                  <button onClick={() => removeCard(col.id, card.id)} className="p-0.5 rounded hover:opacity-70 flex-shrink-0" style={{ color: '${t.text50}' }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {card.description && (
                  <p className="text-xs mt-1" style={{ color: '${t.text70}' }}>{card.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {card.priority && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={priorityColors[card.priority]}
                    >
                      {card.priority}
                    </span>
                  )}
                  {card.tags?.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '${t.primary20}', color: '${t.primary}' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
`,
  };
}
