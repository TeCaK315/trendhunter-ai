import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/VoiceInput.tsx': `'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  language?: string;
  placeholder?: string;
}

export default function VoiceInput({ onTranscript, language = 'ru-RU', placeholder }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [language]);

  function toggleListening() {
    if (!recognitionRef.current) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      if (transcript) {
        onTranscript(transcript);
      }
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setListening(true);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggleListening}
        className={\`p-3 rounded-full transition-all \${listening ? 'animate-pulse' : 'hover:scale-110'}\`}
        style={{
          background: listening ? '#ef4444' : '${t.gradientPrimary}',
          color: 'white',
        }}
        title={listening ? 'Остановить запись' : 'Начать запись'}
      >
        {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {listening && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-4 rounded-full animate-pulse" style={{ background: '#ef4444', animationDelay: '0ms' }} />
            <span className="w-1.5 h-6 rounded-full animate-pulse" style={{ background: '#ef4444', animationDelay: '150ms' }} />
            <span className="w-1.5 h-3 rounded-full animate-pulse" style={{ background: '#ef4444', animationDelay: '300ms' }} />
            <span className="w-1.5 h-5 rounded-full animate-pulse" style={{ background: '#ef4444', animationDelay: '450ms' }} />
          </div>
          <span className="text-sm" style={{ color: '${t.text70}' }}>Слушаю...</span>
        </div>
      )}

      {transcript && !listening && (
        <p className="text-sm truncate max-w-[200px]" style={{ color: '${t.text80}' }}>{transcript}</p>
      )}
    </div>
  );
}
`,
  };
}
