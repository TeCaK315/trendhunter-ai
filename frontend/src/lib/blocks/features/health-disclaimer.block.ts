import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/HealthDisclaimer.tsx': `'use client';

import { useState } from 'react';
import { AlertTriangle, X, ShieldCheck } from 'lucide-react';

interface HealthDisclaimerProps {
  variant?: 'banner' | 'modal' | 'inline';
  onAccept?: () => void;
}

export default function HealthDisclaimer({ variant = 'banner', onAccept }: HealthDisclaimerProps) {
  const [visible, setVisible] = useState(true);
  const [accepted, setAccepted] = useState(false);

  function handleAccept() {
    setAccepted(true);
    setVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('health_disclaimer_accepted', 'true');
    }
    onAccept?.();
  }

  if (!visible && variant !== 'inline') return null;

  if (variant === 'inline') {
    return (
      <div className="rounded-xl border p-4 flex gap-3" style={{ borderColor: '#f59e0b', background: '#fffbeb' }}>
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: '#92400e' }}>Важное предупреждение</p>
          <p className="text-xs mt-1" style={{ color: '#a16207' }}>
            Данный сервис предоставляет информацию исключительно в образовательных целях и не является заменой
            профессиональной медицинской консультации, диагностики или лечения. Всегда обращайтесь к квалифицированному
            врачу по любым вопросам, связанным со здоровьем.
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="w-full max-w-md mx-4 rounded-2xl border p-6 shadow-2xl" style={{ background: '${t.bg}', borderColor: '${t.primary40}' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#fef3c7' }}>
              <ShieldCheck className="w-5 h-5" style={{ color: '#f59e0b' }} />
            </div>
            <h3 className="text-lg font-bold" style={{ color: '${t.text}' }}>Медицинский дисклеймер</h3>
          </div>
          <p className="text-sm mb-4" style={{ color: '${t.text70}' }}>
            Информация, предоставляемая данным сервисом, носит исключительно ознакомительный характер и не может
            рассматриваться как медицинская рекомендация, диагноз или назначение лечения.
          </p>
          <ul className="text-xs space-y-2 mb-6" style={{ color: '${t.text70}' }}>
            <li>• Не заменяет консультацию квалифицированного врача</li>
            <li>• Не используйте для самодиагностики серьёзных заболеваний</li>
            <li>• При ухудшении состояния немедленно обратитесь к врачу</li>
            <li>• Результаты AI-анализа не являются медицинским заключением</li>
          </ul>
          <button
            onClick={handleAccept}
            className="w-full py-3 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90"
            style={{ background: '${t.gradientPrimary}' }}
          >
            Я понимаю и принимаю
          </button>
        </div>
      </div>
    );
  }

  // banner variant
  return (
    <div className="w-full py-3 px-4 flex items-center justify-between gap-4" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
        <p className="text-xs" style={{ color: '#92400e' }}>
          Информация на сайте не является медицинской рекомендацией. Проконсультируйтесь с врачом.
        </p>
      </div>
      <button onClick={() => setVisible(false)} className="p-1 rounded hover:opacity-70">
        <X className="w-4 h-4" style={{ color: '#92400e' }} />
      </button>
    </div>
  );
}
`,
  };
}
