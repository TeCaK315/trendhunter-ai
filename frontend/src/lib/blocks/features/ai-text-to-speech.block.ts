import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/TextToSpeech.tsx': `'use client';

import { useState, useRef } from 'react';
import { Volume2, Loader2, Download, Pause, Play, Square } from 'lucide-react';

interface TextToSpeechProps {
  defaultText?: string;
  voices?: { id: string; name: string }[];
}

const DEFAULT_VOICES = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'echo', name: 'Echo' },
  { id: 'fable', name: 'Fable' },
  { id: 'onyx', name: 'Onyx' },
  { id: 'nova', name: 'Nova' },
  { id: 'shimmer', name: 'Shimmer' },
];

export default function TextToSpeech({ defaultText = '', voices = DEFAULT_VOICES }: TextToSpeechProps) {
  const [text, setText] = useState(defaultText);
  const [voice, setVoice] = useState(voices[0]?.id || 'alloy');
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function generate() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setAudioUrl('');

    try {
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), voice }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play();
      setPlaying(true);
    } catch {
      setError('Не удалось озвучить текст. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  function stop() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaying(false);
  }

  function downloadAudio() {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'speech.mp3';
    a.click();
  }

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Введите текст для озвучки..."
        rows={4}
        className="w-full px-4 py-3 rounded-xl border text-sm resize-none"
        style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
      />

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: '${t.text70}' }}>Голос</label>
          <select value={voice} onChange={e => setVoice(e.target.value)}
            className="px-3 py-2.5 rounded-xl border text-sm"
            style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}>
            {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <button onClick={generate} disabled={loading || !text.trim()}
          className="px-6 py-2.5 rounded-xl text-white font-medium text-sm flex items-center gap-2 disabled:opacity-50"
          style={{ background: '${t.gradientPrimary}' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
          {loading ? 'Генерация...' : 'Озвучить'}
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

      {audioUrl && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: '${t.primary40}' }}>
          <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ background: '${t.primary}' }}>
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={stop} className="p-2 rounded-lg border" style={{ borderColor: '${t.primary40}', color: '${t.text50}' }}>
            <Square className="w-4 h-4" />
          </button>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '${t.primary10}' }}>
            <div className="h-full rounded-full" style={{ width: playing ? '60%' : '0%', background: '${t.gradientPrimary}', transition: 'width 0.3s' }} />
          </div>
          <button onClick={downloadAudio} className="p-2 rounded-lg border" style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}>
            <Download className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
`,

    'src/app/api/text-to-speech/route.ts': `import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'alloy' } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.slice(0, 4096),
        voice,
        response_format: 'mp3',
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'TTS failed' }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`,
  };
}
