import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens, escapeJsx } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const spec = ctx.product_spec;

  // Build wizard steps from user_flow or derived_features
  const flowSteps = spec.user_flow?.steps || [];
  const magicType = spec.magic_location?.type || 'ai_analysis';

  // Generate default steps if none provided
  const stepsData = flowSteps.length >= 2
    ? flowSteps.slice(0, 8).map((s, i) => ({
        title: escapeJsx(s.action || `Шаг ${i + 1}`),
        description: escapeJsx(s.user_sees || ''),
      }))
    : [
        { title: 'Основная информация', description: 'Укажите базовые данные' },
        { title: 'Детали', description: 'Уточните параметры' },
        { title: 'Дополнительно', description: 'Дополнительные настройки' },
      ];

  const stepsJson = JSON.stringify(stepsData);

  // Health disclaimer flag
  const isHealth = magicType === 'ai_analysis' &&
    (ctx.derived_features || []).some(f =>
      /health|медиц|здоров|симптом|врач|диагноз/i.test(
        `${f.feature_name} ${f.solution} ${f.implementation_hint}`
      )
    );

  return {
    'src/components/InteractiveWizard.tsx': `'use client';

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
    setAnswers(prev => ({ ...prev, [\`step_\${current}\`]: value }));
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

  const currentAnswer = answers[\`step_\${current}\`] || '';
  const progress = ((current + 1) / steps.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium" style={{ color: '${t.text70}' }}>
            Шаг {current + 1} из {steps.length}
          </span>
          <span className="text-sm font-bold" style={{ color: '${t.primary}' }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: '${t.primary20}' }}>
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: \`\${progress}%\`, background: '${t.gradientPrimary}' }}
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
              background: i <= current ? '${t.primary}' : '${t.primary20}',
            }}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-2xl border p-8 mb-6" style={{ borderColor: '${t.primary40}', background: '${t.primary10}' }}>
        <h2 className="text-xl font-heading font-bold mb-2" style={{ color: '${t.text}' }}>
          {steps[current]?.title || 'Вопрос'}
        </h2>
        <p className="text-sm mb-6" style={{ color: '${t.text70}' }}>
          {steps[current]?.description || ''}
        </p>

        <textarea
          value={currentAnswer}
          onChange={(e) => handleAnswer(e.target.value)}
          placeholder="Введите ваш ответ..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none"
          style={{
            background: '${t.bg}',
            borderColor: '${t.primary40}',
            color: '${t.text}',
          }}
        />
      </div>

      {/* Disclaimer */}
      {disclaimer && current === 0 && (
        <div className="rounded-xl border p-4 mb-6 flex items-start gap-3" style={{ borderColor: '#f59e0b40', background: '#f59e0b10' }}>
          <span className="text-lg">⚠️</span>
          <p className="text-sm" style={{ color: '${t.text80}' }}>{disclaimer}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prev}
          disabled={isFirst}
          className="px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 disabled:opacity-30 hover:opacity-80 transition-all"
          style={{ color: '${t.text}', borderColor: '${t.primary40}', border: '1px solid' }}
        >
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>
        <button
          onClick={next}
          disabled={!currentAnswer.trim() || loading}
          className="px-6 py-2.5 rounded-xl font-semibold text-white flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
          style={{ background: '${t.gradientPrimary}' }}
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
`,

    'src/app/dashboard/wizard/page.tsx': `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InteractiveWizard from '@/components/InteractiveWizard';

const WIZARD_STEPS = ${stepsJson};

${isHealth ? `const DISCLAIMER = 'Данный сервис носит исключительно информационный характер и не является медицинской консультацией. Результаты не заменяют визит к квалифицированному специалисту. При наличии серьёзных симптомов обратитесь к врачу.';` : 'const DISCLAIMER: string | undefined = undefined;'}

export default function WizardPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleComplete(answers: Record<string, string>) {
    setLoading(true);
    try {
      // Combine all answers into one query
      const combined = Object.entries(answers)
        .map(([, val]) => val)
        .filter(Boolean)
        .join('\\n\\n');

      router.push(\`/dashboard/analysis?q=\${encodeURIComponent(combined)}\`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '${t.bg}' }}>
      <div className="max-w-4xl mx-auto">
        <InteractiveWizard
          steps={WIZARD_STEPS}
          onComplete={handleComplete}
          loading={loading}
          disclaimer={DISCLAIMER}
        />
      </div>
    </div>
  );
}
`,
  };
}
