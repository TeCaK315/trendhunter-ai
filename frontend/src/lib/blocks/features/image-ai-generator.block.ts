import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/ImageGenerator.tsx': `'use client';

import { useState } from 'react';
import { Image, Loader2, Download, Wand2 } from 'lucide-react';

interface ImageGeneratorProps {
  placeholder?: string;
}

export default function ImageGenerator({ placeholder }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setImageUrl('');

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) throw new Error('Generation failed');

      const data = await res.json();
      setImageUrl(data.url || '');
    } catch (err) {
      setError('Не удалось сгенерировать изображение. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  async function downloadImage() {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-image.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder || 'Опишите изображение, которое хотите создать...'}
          rows={2}
          className="flex-1 px-4 py-3 rounded-xl border text-sm resize-none"
          style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
        />
        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="px-6 rounded-xl text-white font-medium flex items-center gap-2 disabled:opacity-50 transition-all self-end"
          style={{ background: '${t.gradientPrimary}' }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
        </button>
      </div>

      {error && (
        <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
      )}

      {loading && (
        <div className="rounded-2xl border p-12 text-center" style={{ borderColor: '${t.primary40}' }}>
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: '${t.primary}' }} />
          <p className="text-sm" style={{ color: '${t.text70}' }}>Генерируем изображение...</p>
        </div>
      )}

      {imageUrl && !loading && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
          <img src={imageUrl} alt="Generated" className="w-full h-auto" />
          <div className="flex gap-2 p-4">
            <button
              onClick={downloadImage}
              className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 hover:opacity-80 transition-all"
              style={{ borderColor: '${t.primary40}', color: '${t.text}' }}
            >
              <Download className="w-4 h-4" /> Скачать
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
`,

    'src/app/api/generate-image/route.ts': `import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return NextResponse.json({ error: 'Image generation failed', details: error }, { status: 502 });
    }

    const data = await res.json();
    const url = data.data?.[0]?.url;

    return NextResponse.json({ url });
  } catch (err) {
    console.error('Image generation error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`,
  };
}
