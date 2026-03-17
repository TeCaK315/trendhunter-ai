import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/AiContentWriter.tsx': `'use client';

import { useState } from 'react';
import { PenTool, Loader2, Copy, Check, RotateCcw, Sparkles } from 'lucide-react';

type ContentType = 'blog_post' | 'product_desc' | 'social_post' | 'email' | 'headline' | 'ad_copy';

const CONTENT_TYPES: { id: ContentType; label: string; placeholder: string }[] = [
  { id: 'blog_post', label: 'Статья для блога', placeholder: 'Тема статьи, ключевые моменты...' },
  { id: 'product_desc', label: 'Описание товара', placeholder: 'Название, характеристики, преимущества...' },
  { id: 'social_post', label: 'Пост в соцсети', placeholder: 'Тема, целевая аудитория, платформа...' },
  { id: 'email', label: 'Email-рассылка', placeholder: 'Тема письма, оффер, CTA...' },
  { id: 'headline', label: 'Заголовки', placeholder: 'Тема, ключевые слова...' },
  { id: 'ad_copy', label: 'Рекламный текст', placeholder: 'Продукт, УТП, целевая аудитория...' },
];

type Tone = 'professional' | 'casual' | 'creative' | 'formal';

export default function AiContentWriter() {
  const [contentType, setContentType] = useState<ContentType>('blog_post');
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const currentType = CONTENT_TYPES.find(t => t.id === contentType)!;

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult('');

    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), contentType, tone }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setResult(data.content || '');
    } catch {
      setError('Не удалось сгенерировать контент. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  function copyResult() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tones: { id: Tone; label: string }[] = [
    { id: 'professional', label: 'Профессиональный' },
    { id: 'casual', label: 'Неформальный' },
    { id: 'creative', label: 'Креативный' },
    { id: 'formal', label: 'Официальный' },
  ];

  return (
    <div className="space-y-4">
      {/* Content type */}
      <div className="flex gap-2 flex-wrap">
        {CONTENT_TYPES.map(ct => (
          <button key={ct.id} onClick={() => setContentType(ct.id)}
            className="px-3 py-2 rounded-xl text-xs font-medium border transition-all"
            style={{
              borderColor: contentType === ct.id ? '${t.primary}' : '${t.primary40}',
              background: contentType === ct.id ? '${t.primary10}' : 'transparent',
              color: contentType === ct.id ? '${t.primary}' : '${t.text70}',
            }}>
            {ct.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder={currentType.placeholder}
        rows={4}
        className="w-full px-4 py-3 rounded-xl border text-sm resize-none"
        style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
      />

      {/* Tone + generate */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: '${t.text70}' }}>Тон</label>
          <div className="flex gap-1 border rounded-xl p-1" style={{ borderColor: '${t.primary40}' }}>
            {tones.map(t_tone => (
              <button key={t_tone.id} onClick={() => setTone(t_tone.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tone === t_tone.id ? '${t.primary}' : 'transparent',
                  color: tone === t_tone.id ? '#fff' : '${t.text70}',
                }}>
                {t_tone.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={loading || !prompt.trim()}
          className="px-6 py-2.5 rounded-xl text-white font-medium text-sm flex items-center gap-2 disabled:opacity-50 self-end"
          style={{ background: '${t.gradientPrimary}' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
          {loading ? 'Генерация...' : 'Сгенерировать'}
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

      {result && (
        <div className="rounded-xl border p-5" style={{ borderColor: '${t.primary}', background: '${t.primary10}' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: '${t.primary}' }} />
              <span className="text-sm font-semibold" style={{ color: '${t.text}' }}>Результат</span>
            </div>
            <div className="flex gap-2">
              <button onClick={copyResult} className="p-1.5 rounded-lg border flex items-center gap-1 text-xs"
                style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
                {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
              <button onClick={generate} disabled={loading}
                className="p-1.5 rounded-lg border" style={{ borderColor: '${t.primary40}', color: '${t.text50}' }}>
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '${t.text}' }}>
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
`,

    'src/app/api/generate-content/route.ts': `import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { prompt, contentType = 'blog_post', tone = 'professional' } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const typeInstructions: Record<string, string> = {
      blog_post: 'Write a blog post (800-1200 words) with a catchy title, introduction, main sections, and conclusion.',
      product_desc: 'Write a compelling product description with features, benefits, and a call to action.',
      social_post: 'Write an engaging social media post optimized for engagement. Include hashtags.',
      email: 'Write a professional email with subject line, body, and call to action.',
      headline: 'Generate 10 different catchy headlines/titles. Number them.',
      ad_copy: 'Write advertising copy with headline, body text, and call to action. Keep it punchy.',
    };

    const toneInstructions: Record<string, string> = {
      professional: 'Use a professional, business-appropriate tone.',
      casual: 'Use a casual, friendly, conversational tone.',
      creative: 'Use a creative, unique, attention-grabbing style.',
      formal: 'Use a formal, authoritative tone.',
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
          {
            role: 'system',
            content: \`You are an expert content writer. \${typeInstructions[contentType] || typeInstructions.blog_post} \${toneInstructions[tone] || toneInstructions.professional} Write in the same language as the user's prompt.\`,
          },
          { role: 'user', content: prompt.slice(0, 4000) },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: 'Generation failed' }, { status: 502 });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`,
  };
}
