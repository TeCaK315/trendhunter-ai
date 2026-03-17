'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Send, Loader2, CheckCircle2 } from 'lucide-react';

interface WizardStep {
  title: string;
  description: string;
}

interface WizardProps {
  steps: WizardStep[];
  onComplete: (answers: Record<string, string>) => void;
  loading?: boolean;
  disclaimer?: string;
}

export default function InteractiveWizard({ steps, onComplete, loading, disclaimer }: WizardProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const isLast = current === steps.length - 1;
  const isFirst = current === 0;

  function handleAnswer(value: string) {
    setAnswers(prev => ({ ...prev, [`step_${current}`]: value }));
  }

  function next() {
    if (isLast) {
      onComplete(answers);
    } else {
      setCurrent(c => c + 1);
    }
  }

  function prev() {
    if (!isFirst) setCurrent(c => c - 1);
  }

  const currentAnswer = answers[`step_${current}`] || '';
  const progress = ((current + 1) / steps.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium" style={{ color: '#e2e8f070' }}>
            Шаг {current + 1} из {steps.length}
          </span>
          <span className="text-sm font-bold" style={{ color: '#6366f1' }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: '#6366f120' }}>
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          />
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex gap-1 mb-6">
        {steps.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all"
            style={{
              background: i <= current ? '#6366f1' : '#6366f120',
            }}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-2xl border p-8 mb-6" style={{ borderColor: '#6366f140', background: '#6366f110' }}>
        <h2 className="text-xl font-heading font-bold mb-2" style={{ color: '#e2e8f0' }}>
          {steps[current]?.title || 'Вопрос'}
        </h2>
        <p className="text-sm mb-6" style={{ color: '#e2e8f070' }}>
          {steps[current]?.description || ''}
        </p>

        <textarea
          value={currentAnswer}
          onChange={(e) => handleAnswer(e.target.value)}
          placeholder="Введите ваш ответ..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none"
          style={{
            background: '#0f0f23',
            borderColor: '#6366f140',
            color: '#e2e8f0',
          }}
        />
      </div>

      {/* Disclaimer */}
      {disclaimer && current === 0 && (
        <div className="rounded-xl border p-4 mb-6 flex items-start gap-3" style={{ borderColor: '#f59e0b40', background: '#f59e0b10' }}>
          <span className="text-lg">⚠️</span>
          <p className="text-sm" style={{ color: '#e2e8f080' }}>{disclaimer}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prev}
          disabled={isFirst}
          className="px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 disabled:opacity-30 hover:opacity-80 transition-all"
          style={{ color: '#e2e8f0', borderColor: '#6366f140', border: '1px solid' }}
        >
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>
        <button
          onClick={next}
          disabled={!currentAnswer.trim() || loading}
          className="px-6 py-2.5 rounded-xl font-semibold text-white flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Обработка...</>
          ) : isLast ? (
            <><Send className="w-4 h-4" /> Получить результат</>
          ) : (
            <>Далее <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
