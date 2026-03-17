import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/CalendarScheduler.tsx': `'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  color?: string;
}

interface CalendarSchedulerProps {
  events?: CalendarEvent[];
  onDateSelect?: (date: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export default function CalendarScheduler({ events = [], onDateSelect, onEventClick }: CalendarSchedulerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function getDateStr(day: number): string {
    return \`\${year}-\${String(month + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`;
  }

  function getEventsForDay(day: number): CalendarEvent[] {
    const dateStr = getDateStr(day);
    return events.filter(e => e.date === dateStr);
  }

  // Adjust for Monday start (0=Mon, 6=Sun)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ background: '${t.primary10}' }}>
        <button onClick={prevMonth} className="p-1 rounded-lg hover:opacity-70" style={{ color: '${t.text}' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-heading font-semibold" style={{ color: '${t.text}' }}>
          {monthNames[month]} {year}
        </h3>
        <button onClick={nextMonth} className="p-1 rounded-lg hover:opacity-70" style={{ color: '${t.text}' }}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: '${t.primary20}' }}>
        {dayNames.map(d => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold" style={{ color: '${t.text70}' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="min-h-[80px] border-b border-r" style={{ borderColor: '${t.primary10}' }} />;
          }

          const dateStr = getDateStr(day);
          const isToday = dateStr === today;
          const dayEvents = getEventsForDay(day);

          return (
            <div
              key={i}
              onClick={() => onDateSelect?.(dateStr)}
              className="min-h-[80px] p-1.5 border-b border-r cursor-pointer transition-all hover:opacity-80"
              style={{
                borderColor: '${t.primary10}',
                background: isToday ? '${t.primary10}' : 'transparent',
              }}
            >
              <span
                className={\`text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full \${isToday ? 'text-white' : ''}\`}
                style={{
                  background: isToday ? '${t.primary}' : 'transparent',
                  color: isToday ? 'white' : '${t.text80}',
                }}
              >
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 2).map(ev => (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick?.(ev); }}
                    className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer"
                    style={{ background: ev.color || '${t.primary}', color: 'white' }}
                  >
                    {ev.time && <span className="opacity-80">{ev.time} </span>}
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-xs px-1" style={{ color: '${t.text50}' }}>+{dayEvents.length - 2}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`,
  };
}
