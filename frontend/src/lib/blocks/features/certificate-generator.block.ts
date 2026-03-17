import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;

  return {
    'src/components/CertificateGenerator.tsx': `'use client';

import { useRef, useState } from 'react';
import { Download, Award, Share2 } from 'lucide-react';

interface CertificateProps {
  recipientName: string;
  courseName: string;
  completionDate?: string;
  issuerName?: string;
  certificateId?: string;
}

export default function CertificateGenerator({
  recipientName,
  courseName,
  completionDate,
  issuerName = '${projectName}',
  certificateId,
}: CertificateProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);

  const date = completionDate || new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const certId = certificateId || 'CERT-' + Date.now().toString(36).toUpperCase();

  function drawCertificate(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const W = 1200;
    const H = 850;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = '${t.primary}';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    // Inner border
    ctx.strokeStyle = '${t.primary40}';
    ctx.lineWidth = 1;
    ctx.strokeRect(45, 45, W - 90, H - 90);

    // Corner decorations
    const corners = [[60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60]];
    corners.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '${t.primary}';
      ctx.fill();
    });

    // Award icon area
    ctx.beginPath();
    ctx.arc(W / 2, 140, 35, 0, Math.PI * 2);
    ctx.fillStyle = '${t.primary10}';
    ctx.fill();
    ctx.strokeStyle = '${t.primary}';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Star in circle
    ctx.fillStyle = '${t.primary}';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('★', W / 2, 150);

    // Title
    ctx.fillStyle = '${t.primary}';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('СЕРТИФИКАТ', W / 2, 230);

    // Subtitle
    ctx.fillStyle = '#666666';
    ctx.font = '16px Arial';
    ctx.fillText('подтверждает, что', W / 2, 270);

    // Recipient name
    ctx.fillStyle = '${t.text}';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.fillText(recipientName, W / 2, 340);

    // Line under name
    ctx.strokeStyle = '${t.primary}';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 200, 360);
    ctx.lineTo(W / 2 + 200, 360);
    ctx.stroke();

    // Course text
    ctx.fillStyle = '#666666';
    ctx.font = '16px Arial';
    ctx.fillText('успешно завершил(а) курс', W / 2, 410);

    // Course name
    ctx.fillStyle = '${t.text}';
    ctx.font = 'bold 28px Georgia, serif';

    // Word wrap for long course names
    const words = courseName.split(' ');
    let line = '';
    let y = 460;
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > W - 200) {
        ctx.fillText(line, W / 2, y);
        line = word;
        y += 38;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, W / 2, y);

    // Date
    ctx.fillStyle = '#999999';
    ctx.font = '14px Arial';
    ctx.fillText(date, W / 2, H - 170);

    // Issuer
    ctx.fillStyle = '${t.text}';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(issuerName, W / 2, H - 130);

    // Certificate ID
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px monospace';
    ctx.fillText(certId, W / 2, H - 70);

    return canvas;
  }

  function handleDownload() {
    setDownloading(true);
    const canvas = drawCertificate();
    if (!canvas) { setDownloading(false); return; }

    canvas.toBlob(blob => {
      if (!blob) { setDownloading(false); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'certificate-' + recipientName.replace(/\\s+/g, '-').toLowerCase() + '.png';
      a.click();
      URL.revokeObjectURL(url);
      setDownloading(false);
    }, 'image/png');
  }

  // Preview render
  const previewCanvas = drawCertificate();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
        <canvas ref={canvasRef} className="w-full h-auto" style={{ display: 'block' }} />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          style={{ background: '${t.gradientPrimary}' }}
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Скачивание...' : 'Скачать PNG'}
        </button>
      </div>
    </div>
  );
}
`,
  };
}
