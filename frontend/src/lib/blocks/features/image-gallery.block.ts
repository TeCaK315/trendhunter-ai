import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/ImageGallery.tsx': `'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, Download, Grid3X3 } from 'lucide-react';

interface GalleryImage {
  src: string;
  alt?: string;
  thumbnail?: string;
  caption?: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  columns?: 2 | 3 | 4;
}

export default function ImageGallery({ images, columns = 3 }: ImageGalleryProps) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const openLightbox = (index: number) => setLightbox(index);
  const closeLightbox = () => setLightbox(null);

  const prev = useCallback(() => {
    if (lightbox === null) return;
    setLightbox(lightbox > 0 ? lightbox - 1 : images.length - 1);
  }, [lightbox, images.length]);

  const next = useCallback(() => {
    if (lightbox === null) return;
    setLightbox(lightbox < images.length - 1 ? lightbox + 1 : 0);
  }, [lightbox, images.length]);

  useEffect(() => {
    if (lightbox === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox, prev, next]);

  const colClass = columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <>
      <div className={\`grid \${colClass} gap-3\`}>
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => openLightbox(i)}
            className="group relative overflow-hidden rounded-xl border aspect-square"
            style={{ borderColor: '${t.primary40}' }}
          >
            <img
              src={img.thumbnail || img.src}
              alt={img.alt || ''}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {img.caption && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-xs text-white truncate">{img.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }}>
          {/* Close */}
          <button onClick={closeLightbox} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white z-10">
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white/70 text-sm z-10">
            {lightbox + 1} / {images.length}
          </div>

          {/* Prev */}
          <button onClick={prev} className="absolute left-4 p-2 text-white/70 hover:text-white z-10">
            <ChevronLeft className="w-8 h-8" />
          </button>

          {/* Image */}
          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center">
            <img
              src={images[lightbox].src}
              alt={images[lightbox].alt || ''}
              className="max-w-full max-h-[80vh] object-contain"
            />
            {images[lightbox].caption && (
              <p className="text-white/80 text-sm mt-3 text-center">{images[lightbox].caption}</p>
            )}
          </div>

          {/* Next */}
          <button onClick={next} className="absolute right-4 p-2 text-white/70 hover:text-white z-10">
            <ChevronRight className="w-8 h-8" />
          </button>

          {/* Thumbnails */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[80vw] overflow-x-auto pb-2">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setLightbox(i)}
                className={\`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all \${i === lightbox ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}\`}
              >
                <img src={img.thumbnail || img.src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
`,
  };
}
