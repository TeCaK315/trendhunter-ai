import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/VideoPlayer.tsx': `'use client';

import { useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  title?: string;
  thumbnail?: string;
  autoplay?: boolean;
}

function getVideoInfo(url: string): { type: 'youtube' | 'vimeo' | 'html5'; id?: string } {
  // YouTube
  const ytMatch = url.match(/(?:youtube\\.com\\/(?:watch\\?v=|embed\\/)|youtu\\.be\\/)([\\w-]+)/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };

  // Vimeo
  const vimeoMatch = url.match(/vimeo\\.com\\/(?:video\\/)?(\\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };

  return { type: 'html5' };
}

export default function VideoPlayer({ url, title, thumbnail, autoplay = false }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(autoplay);
  const info = getVideoInfo(url);

  if (!playing && thumbnail) {
    return (
      <div className="relative rounded-2xl overflow-hidden border group cursor-pointer" style={{ borderColor: '${t.primary40}' }}
        onClick={() => setPlaying(true)}>
        <img src={thumbnail} alt={title || 'Video'} className="w-full aspect-video object-cover" />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-all">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/90 group-hover:scale-110 transition-transform">
            <Play className="w-7 h-7 ml-1" style={{ color: '${t.primary}' }} />
          </div>
        </div>
        {title && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
            <p className="text-white text-sm font-medium">{title}</p>
          </div>
        )}
      </div>
    );
  }

  if (info.type === 'youtube' && info.id) {
    return (
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '${t.primary40}' }}>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={\`https://www.youtube-nocookie.com/embed/\${info.id}?autoplay=\${playing ? 1 : 0}&rel=0\`}
            title={title || 'YouTube Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
        {title && (
          <div className="p-3 flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: '${t.text}' }}>{title}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:opacity-70" style={{ color: '${t.text50}' }}>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    );
  }

  if (info.type === 'vimeo' && info.id) {
    return (
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '${t.primary40}' }}>
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={\`https://player.vimeo.com/video/\${info.id}?autoplay=\${playing ? 1 : 0}\`}
            title={title || 'Vimeo Video'}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
        {title && <div className="p-3"><p className="text-sm font-medium" style={{ color: '${t.text}' }}>{title}</p></div>}
      </div>
    );
  }

  // HTML5 video
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '${t.primary40}' }}>
      <video src={url} controls autoPlay={playing} className="w-full" />
      {title && <div className="p-3"><p className="text-sm font-medium" style={{ color: '${t.text}' }}>{title}</p></div>}
    </div>
  );
}
`,
  };
}
