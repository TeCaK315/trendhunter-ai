import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;
  const headline = ctx.safe.headline || 'Coming Soon';

  return {
    'src/app/waitlist/page.tsx': `'use client';

import { useState } from 'react';
import { Rocket, Mail, Check, Loader2, ArrowRight } from 'lucide-react';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.position) setCount(data.position);
      setSubmitted(true);
    } catch (err) {
      console.error('Waitlist error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '${t.bg}' }}>
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '${t.gradientPrimary}' }}>
          <Rocket className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-4xl font-heading font-bold mb-4" style={{ color: '${t.text}' }}>
          ${projectName}
        </h1>
        <p className="text-lg mb-8" style={{ color: '${t.text70}' }}>
          ${headline}
        </p>

        {submitted ? (
          <div className="rounded-2xl border p-8" style={{ borderColor: '${t.primary40}', background: '${t.primary10}' }}>
            <Check className="w-12 h-12 mx-auto mb-4" style={{ color: '#22c55e' }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: '${t.text}' }}>Вы в списке!</h2>
            <p className="text-sm mb-2" style={{ color: '${t.text70}' }}>
              Мы уведомим вас, когда ${projectName} будет готов.
            </p>
            {count > 0 && (
              <p className="text-sm font-medium" style={{ color: '${t.primary}' }}>
                Вы #{count} в очереди
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '${t.text50}' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ваш email"
                  required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border text-sm"
                  style={{ borderColor: '${t.primary40}', background: '${t.primary10}', color: '${t.text}' }}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3.5 rounded-xl font-semibold text-white flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '${t.gradientPrimary}' }}
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs" style={{ color: '${t.text50}' }}>
              Без спама. Только уведомление о запуске.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
`,

    'src/app/api/waitlist/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if already registered
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id, position')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ already: true, position: existing.position });
    }

    // Get current count for position
    const { count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    const position = (count || 0) + 1;

    await supabase.from('waitlist').insert({
      email: email.toLowerCase(),
      position,
    });

    return NextResponse.json({ success: true, position });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`,
  };
}
