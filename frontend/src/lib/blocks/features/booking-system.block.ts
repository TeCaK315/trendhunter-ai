import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/BookingSystem.tsx': `'use client';

import { useState, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Check, User, Loader2 } from 'lucide-react';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface BookingSystemProps {
  slots?: TimeSlot[];
  onBook?: (date: string, time: string, name: string, email: string, note: string) => Promise<void>;
  minDate?: Date;
  daysAhead?: number;
  duration?: string;
}

const DEFAULT_SLOTS: TimeSlot[] = [
  { time: '09:00', available: true },
  { time: '10:00', available: true },
  { time: '11:00', available: true },
  { time: '12:00', available: false },
  { time: '13:00', available: true },
  { time: '14:00', available: true },
  { time: '15:00', available: true },
  { time: '16:00', available: true },
  { time: '17:00', available: true },
  { time: '18:00', available: true },
];

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export default function BookingSystem({
  slots = DEFAULT_SLOTS,
  onBook,
  minDate,
  daysAhead = 30,
  duration = '60 мин',
}: BookingSystemProps) {
  const [step, setStep] = useState<'date' | 'time' | 'info' | 'done'>('date');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());

  const today = minDate || new Date();
  const maxDate = new Date(today.getTime() + daysAhead * 86400000);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [viewDate]);

  function isDateSelectable(date: Date): boolean {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d >= t && d <= maxDate && d.getDay() !== 0;
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function handleSubmit() {
    if (!name || !email) return;
    setLoading(true);
    try {
      await onBook?.(selectedDate, selectedTime, name, email, note);
      setStep('done');
    } catch {
      alert('Ошибка при бронировании. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('date');
    setSelectedDate('');
    setSelectedTime('');
    setName('');
    setEmail('');
    setNote('');
  }

  if (step === 'done') {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: '#22c55e' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#f0fdf4' }}>
          <Check className="w-8 h-8" style={{ color: '#22c55e' }} />
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: '${t.text}' }}>Бронирование подтверждено!</h3>
        <p className="text-sm mb-1" style={{ color: '${t.text70}' }}>{formatDate(selectedDate)}, {selectedTime}</p>
        <p className="text-sm mb-4" style={{ color: '${t.text50}' }}>Подтверждение отправлено на {email}</p>
        <button onClick={reset} className="px-6 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
          Новое бронирование
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: '${t.primary40}' }}>
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-2">
        {['Дата', 'Время', 'Данные'].map((s, i) => {
          const steps = ['date', 'time', 'info'];
          const isActive = steps.indexOf(step) >= i;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: isActive ? '${t.primary}' : '${t.primary10}', color: isActive ? '#fff' : '${t.text50}' }}>
                {i + 1}
              </div>
              <span className="text-xs font-medium" style={{ color: isActive ? '${t.text}' : '${t.text50}' }}>{s}</span>
              {i < 2 && <div className="w-8 h-px" style={{ background: '${t.primary40}' }} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Date */}
      {step === 'date' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
              className="p-1 rounded hover:opacity-70"><ChevronLeft className="w-5 h-5" style={{ color: '${t.text70}' }} /></button>
            <h4 className="text-sm font-semibold" style={{ color: '${t.text}' }}>
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </h4>
            <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}
              className="p-1 rounded hover:opacity-70"><ChevronRight className="w-5 h-5" style={{ color: '${t.text70}' }} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map(d => <div key={d} className="text-xs font-medium py-1" style={{ color: '${t.text50}' }}>{d}</div>)}
            {calendarDays.map((date, i) => {
              if (!date) return <div key={'e' + i} />;
              const dateStr = date.toISOString().split('T')[0];
              const selectable = isDateSelectable(date);
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={dateStr}
                  disabled={!selectable}
                  onClick={() => { setSelectedDate(dateStr); setStep('time'); }}
                  className="h-9 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
                  style={{
                    background: isSelected ? '${t.primary}' : 'transparent',
                    color: isSelected ? '#fff' : '${t.text}',
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Time */}
      {step === 'time' && (
        <div>
          <p className="text-sm mb-3" style={{ color: '${t.text70}' }}>
            <Calendar className="w-4 h-4 inline mr-1" /> {formatDate(selectedDate)} • {duration}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {slots.map(slot => (
              <button
                key={slot.time}
                disabled={!slot.available}
                onClick={() => { setSelectedTime(slot.time); setStep('info'); }}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all disabled:opacity-30"
                style={{
                  borderColor: selectedTime === slot.time ? '${t.primary}' : '${t.primary40}',
                  background: selectedTime === slot.time ? '${t.primary10}' : 'transparent',
                  color: selectedTime === slot.time ? '${t.primary}' : '${t.text}',
                }}
              >
                {slot.time}
              </button>
            ))}
          </div>
          <button onClick={() => setStep('date')} className="mt-3 text-xs flex items-center gap-1" style={{ color: '${t.text50}' }}>
            <ChevronLeft className="w-3.5 h-3.5" /> Назад
          </button>
        </div>
      )}

      {/* Step 3: Info */}
      {step === 'info' && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: '${t.text70}' }}>
            <Calendar className="w-4 h-4 inline mr-1" /> {formatDate(selectedDate)}, <Clock className="w-4 h-4 inline mr-1" /> {selectedTime}
          </p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя *"
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email *"
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Комментарий (необяз.)" rows={2}
            className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none" style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          <div className="flex gap-2">
            <button onClick={() => setStep('time')} className="px-4 py-2.5 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
              Назад
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name || !email || loading}
              className="flex-1 py-2.5 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '${t.gradientPrimary}' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Забронировать
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
`,
  };
}
