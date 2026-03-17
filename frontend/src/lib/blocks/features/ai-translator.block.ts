import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/AiTranslator.tsx': `'use client';

import { useState } from 'react';
import { Languages, Loader2, Copy, Check, ArrowLeftRight } from 'lucide-react';

const LANGUAGES = [
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
];

export default function AiTranslator() {
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [fromLang, setFromLang] = useState('auto');
  const [toLang, setToLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function translate() {
    if (!source.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: source.trim(), from: fromLang, to: toLang }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setResult(data.translation || '');
    } catch {
      setError('Не удалось перевести. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  function swapLanguages() {
    if (fromLang === 'auto') return;
    const temp = fromLang;
    setFromLang(toLang);
    setToLang(temp);
    setSource(result);
    setResult(source);
  }

  function copyResult() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Language selectors */}
      <div className="flex items-center gap-3">
        <select value={fromLang} onChange={e => setFromLang(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-xl border text-sm"
          style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}>
          <option value="auto">Авто-определение</option>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>

        <button onClick={swapLanguages}
          className="p-2.5 rounded-xl border hover:opacity-70 transition-all"
          style={{ borderColor: '${t.primary40}', color: '${t.primary}' }}>
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        <select value={toLang} onChange={e => setToLang(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-xl border text-sm"
          style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </div>

      {/* Input/output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <textarea
            value={source}
            onChange={e => setSource(e.target.value)}
            placeholder="Введите текст для перевода..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl border text-sm resize-none"
            style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: '${t.text50}' }}>{source.length} символов</span>
          </div>
        </div>

        <div>
          <div className="relative">
            <textarea
              value={result}
              readOnly
              placeholder="Перевод появится здесь..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border text-sm resize-none"
              style={{ borderColor: result ? '${t.primary}' : '${t.primary40}', background: result ? '${t.primary10}' : '${t.bg}', color: '${t.text}' }}
            />
            {result && (
              <button onClick={copyResult}
                className="absolute top-2 right-2 p-1.5 rounded-lg border"
                style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text50}' }}>
                {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

      <button onClick={translate} disabled={loading || !source.trim()}
        className="w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
        style={{ background: '${t.gradientPrimary}' }}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
        {loading ? 'Переводим...' : 'Перевести'}
      </button>
    </div>
  );
}
`,

    'src/app/api/translate/route.ts': `import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { text, from = 'auto', to = 'en' } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const fromInstr = from === 'auto' ? 'auto-detect the source language' : \`translate from \${from}\`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: \`You are a professional translator. \${fromInstr} and translate to \${to}. Return ONLY the translated text, no explanations.\` },
          { role: 'user', content: text.slice(0, 8000) },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: 'Translation failed' }, { status: 502 });

    const data = await res.json();
    const translation = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ translation });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`,
  };
}
