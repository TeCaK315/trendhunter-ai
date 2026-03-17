import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/FeedbackWidget.tsx': `'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageCircle, Star, Send, X, Check, Loader2 } from 'lucide-react';

interface FeedbackWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
  context?: string;
}

export default function FeedbackWidget({ position = 'bottom-right', context }: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function submit() {
    if (!rating && !message.trim()) return;
    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('feedback').insert({
        user_id: user?.id || null,
        rating,
        message: message.trim(),
        category,
        context: context || null,
        page_url: typeof window !== 'undefined' ? window.location.pathname : null,
      });

      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setRating(0);
        setMessage('');
      }, 2000);
    } catch (err) {
      console.error('Feedback error:', err);
    } finally {
      setSending(false);
    }
  }

  const posClass = position === 'bottom-right' ? 'right-6 bottom-6' : 'left-6 bottom-6';

  return (
    <>
      {/* Trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={\`fixed \${posClass} z-50 p-3.5 rounded-full shadow-lg transition-all hover:scale-110\`}
          style={{ background: '${t.gradientPrimary}', color: 'white' }}
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Feedback panel */}
      {open && (
        <div
          className={\`fixed \${posClass} z-50 w-80 rounded-2xl border shadow-xl\`}
          style={{ background: '${t.bg}', borderColor: '${t.primary40}' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '${t.primary20}' }}>
            <h3 className="font-semibold text-sm" style={{ color: '${t.text}' }}>Обратная связь</h3>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:opacity-70" style={{ color: '${t.text70}' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {sent ? (
            <div className="p-6 text-center">
              <Check className="w-12 h-12 mx-auto mb-3" style={{ color: '#22c55e' }} />
              <p className="font-semibold" style={{ color: '${t.text}' }}>Спасибо!</p>
              <p className="text-sm mt-1" style={{ color: '${t.text70}' }}>Ваш отзыв помогает нам стать лучше</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Star rating */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: '${t.text}' }}>Оцените опыт</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-125"
                    >
                      <Star
                        className="w-6 h-6"
                        fill={(hoverRating || rating) >= star ? '#f59e0b' : 'none'}
                        style={{ color: (hoverRating || rating) >= star ? '#f59e0b' : '${t.text50}' }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="flex gap-2 flex-wrap">
                {['general', 'bug', 'feature', 'ux'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: category === cat ? '${t.primary}' : '${t.primary10}',
                      color: category === cat ? 'white' : '${t.text70}',
                    }}
                  >
                    {cat === 'general' ? 'Общее' : cat === 'bug' ? 'Баг' : cat === 'feature' ? 'Идея' : 'UX'}
                  </button>
                ))}
              </div>

              {/* Message */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Расскажите подробнее..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none"
                style={{ borderColor: '${t.primary40}', background: '${t.primary10}', color: '${t.text}' }}
              />

              {/* Submit */}
              <button
                onClick={submit}
                disabled={sending || (!rating && !message.trim())}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                style={{ background: '${t.gradientPrimary}' }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Отправить
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
`,
  };
}
