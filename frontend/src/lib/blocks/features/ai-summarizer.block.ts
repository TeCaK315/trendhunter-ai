import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/AiSummarizer.tsx': `'use client';

import { useState } from 'react';
import { FileText, Loader2, Copy, Check, Sparkles, RotateCcw } from 'lucide-react';

type SummaryStyle = 'brief' | 'detailed' | 'bullets' | 'key_points';

export default function AiSummarizer() {
  const [text, setText] = useState('');
  const [style, setStyle] = useState<SummaryStyle>('brief');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function summarize() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setSummary('');

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), style }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSummary(data.summary || '');
    } catch {
      setError('Не удалось создать саммари. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const styles: { id: SummaryStyle; label: string }[] = [
    { id: 'brief', label: 'Кратко' },
    { id: 'detailed', label: 'Подробно' },
    { id: 'bullets', label: 'Список' },
    { id: 'key_points', label: 'Ключевые мысли' },
  ];

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Вставьте текст для суммаризации..."
        rows={8}
        className="w-full px-4 py-3 rounded-xl border text-sm resize-none"
        style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 border rounded-xl p-1" style={{ borderColor: '${t.primary40}' }}>
          {styles.map(s => (
            <button key={s.id} onClick={() => setStyle(s.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: style === s.id ? '${t.primary}' : 'transparent',
                color: style === s.id ? '#fff' : '${t.text70}',
              }}>
              {s.label}
            </button>
          ))}
        </div>

        <button onClick={summarize} disabled={loading || !text.trim()}
          className="px-6 py-2.5 rounded-xl text-white font-medium text-sm flex items-center gap-2 disabled:opacity-50"
          style={{ background: '${t.gradientPrimary}' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Анализ...' : 'Суммаризировать'}
        </button>

        {text && (
          <span className="text-xs" style={{ color: '${t.text50}' }}>
            {text.split(/\\s+/).length} слов
          </span>
        )}
      </div>

      {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

      {summary && (
        <div className="rounded-xl border p-5" style={{ borderColor: '${t.primary}', background: '${t.primary10}' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: '${t.primary}' }} />
              <span className="text-sm font-semibold" style={{ color: '${t.text}' }}>Саммари</span>
            </div>
            <div className="flex gap-2">
              <button onClick={copyToClipboard} className="p-1.5 rounded-lg border text-xs flex items-center gap-1"
                style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
                {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setSummary('')} className="p-1.5 rounded-lg border"
                style={{ borderColor: '${t.primary40}', color: '${t.text50}' }}>
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '${t.text}' }}>
            {summary}
          </div>
        </div>
      )}
    </div>
  );
}
`,

    'src/app/api/summarize/route.ts': `import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { text, style = 'brief' } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const styleInstructions: Record<string, string> = {
      brief: 'Provide a brief 2-3 sentence summary.',
      detailed: 'Provide a detailed summary covering all main points.',
      bullets: 'Summarize as a bullet-point list of key points.',
      key_points: 'Extract and list the 5-7 most important key points.',
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a text summarization expert. Respond in the same language as the input text. ' + (styleInstructions[style] || styleInstructions.brief) },
          { role: 'user', content: text.slice(0, 16000) },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: 'AI failed' }, { status: 502 });

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`,
  };
}
