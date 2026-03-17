import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/QrCodeGenerator.tsx': `'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, Copy, Check } from 'lucide-react';

interface QrCodeGeneratorProps {
  value?: string;
  size?: number;
  showInput?: boolean;
}

// Simple QR code via Google Charts API (no deps needed)
export default function QrCodeGenerator({ value: initialValue, size = 200, showInput = true }: QrCodeGeneratorProps) {
  const [value, setValue] = useState(initialValue || '');
  const [copied, setCopied] = useState(false);

  const qrUrl = value
    ? \`https://api.qrserver.com/v1/create-qr-code/?size=\${size}x\${size}&data=\${encodeURIComponent(value)}&format=png\`
    : '';

  async function downloadQR() {
    if (!qrUrl) return;
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-code.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('QR download error:', err);
    }
  }

  async function copyQR() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border p-6 text-center" style={{ borderColor: '${t.primary40}' }}>
      {showInput && (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Введите текст или URL..."
          className="w-full px-4 py-3 rounded-xl border mb-4 text-sm"
          style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
        />
      )}

      {qrUrl ? (
        <div className="space-y-4">
          <div className="inline-block p-4 rounded-2xl" style={{ background: 'white' }}>
            <img src={qrUrl} alt="QR Code" width={size} height={size} className="block" />
          </div>

          <div className="flex justify-center gap-2">
            <button
              onClick={downloadQR}
              className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 hover:opacity-80 transition-all"
              style={{ borderColor: '${t.primary40}', color: '${t.text}' }}
            >
              <Download className="w-4 h-4" /> Скачать
            </button>
            <button
              onClick={copyQR}
              className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 hover:opacity-80 transition-all"
              style={{ borderColor: '${t.primary40}', color: '${t.text}' }}
            >
              {copied ? <Check className="w-4 h-4" style={{ color: '#22c55e' }} /> : <Copy className="w-4 h-4" />}
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm py-8" style={{ color: '${t.text50}' }}>
          Введите данные для генерации QR-кода
        </p>
      )}
    </div>
  );
}
`,
  };
}
