import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/ContactForm.tsx': `'use client';

import { useState } from 'react';
import { Send, Loader2, Check, Mail, User, MessageSquare } from 'lucide-react';

interface ContactFormProps {
  onSubmit?: (data: { name: string; email: string; subject: string; message: string }) => Promise<void>;
  apiEndpoint?: string;
  title?: string;
  subtitle?: string;
}

export default function ContactForm({
  onSubmit,
  apiEndpoint = '/api/contact',
  title = 'Свяжитесь с нами',
  subtitle = 'Мы ответим в течение 24 часов',
}: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !message) return;

    setLoading(true);
    setError('');

    try {
      if (onSubmit) {
        await onSubmit({ name, email, subject, message });
      } else {
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, subject, message }),
        });
        if (!res.ok) throw new Error('Failed to send');
      }
      setSent(true);
    } catch {
      setError('Не удалось отправить сообщение. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: '#22c55e' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#f0fdf4' }}>
          <Check className="w-8 h-8" style={{ color: '#22c55e' }} />
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: '${t.text}' }}>Сообщение отправлено!</h3>
        <p className="text-sm" style={{ color: '${t.text70}' }}>Мы свяжемся с вами в ближайшее время.</p>
        <button onClick={() => { setSent(false); setName(''); setEmail(''); setSubject(''); setMessage(''); }}
          className="mt-4 px-4 py-2 rounded-xl border text-sm" style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
          Отправить ещё
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: '${t.primary40}' }}>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: '${t.text}' }}>{title}</h2>
        {subtitle && <p className="text-sm mt-1" style={{ color: '${t.text50}' }}>{subtitle}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: '${t.text70}' }}>
              <User className="w-3.5 h-3.5" /> Имя *
            </label>
            <input value={name} onChange={e => setName(e.target.value)} required
              placeholder="Ваше имя"
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: '${t.text70}' }}>
              <Mail className="w-3.5 h-3.5" /> Email *
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="your@email.com"
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: '${t.text70}' }}>Тема</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="О чём хотите написать?"
            className="w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
        </div>

        <div>
          <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: '${t.text70}' }}>
            <MessageSquare className="w-3.5 h-3.5" /> Сообщение *
          </label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} required
            rows={5} placeholder="Ваше сообщение..."
            className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none"
            style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
        </div>

        {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

        <button type="submit" disabled={loading || !name || !email || !message}
          className="w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          style={{ background: '${t.gradientPrimary}' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading ? 'Отправка...' : 'Отправить'}
        </button>
      </form>
    </div>
  );
}
`,

    'src/app/api/contact/route.ts': `import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // TODO: integrate with email service (Resend, SendGrid, etc.)
    // For now, just log
    console.log('[Contact Form]', { name, email, subject, message, date: new Date().toISOString() });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`,
  };
}
