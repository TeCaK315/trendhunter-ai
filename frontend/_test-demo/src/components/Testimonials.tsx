'use client';

import { useState } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

interface Testimonial {
  name: string;
  role?: string;
  company?: string;
  avatar?: string;
  text: string;
  rating?: number;
}

interface TestimonialsProps {
  items: Testimonial[];
  variant?: 'carousel' | 'grid';
  title?: string;
}

export default function Testimonials({ items, variant = 'carousel', title = 'Отзывы клиентов' }: TestimonialsProps) {
  const [current, setCurrent] = useState(0);

  function prev() { setCurrent(current > 0 ? current - 1 : items.length - 1); }
  function next() { setCurrent(current < items.length - 1 ? current + 1 : 0); }

  function renderStars(rating: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <Star key={s} className="w-4 h-4" fill={s <= rating ? '#eab308' : 'none'} style={{ color: s <= rating ? '#eab308' : '#e2e8f050' }} />
        ))}
      </div>
    );
  }

  function renderAvatar(t_item: Testimonial) {
    if (t_item.avatar) {
      return <img src={t_item.avatar} alt={t_item.name} className="w-12 h-12 rounded-full object-cover" />;
    }
    return (
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        {t_item.name.charAt(0)}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <div key={i} className="rounded-2xl border p-5 space-y-3" style={{ borderColor: '#6366f140' }}>
              <Quote className="w-6 h-6" style={{ color: '#6366f120' }} />
              <p className="text-sm leading-relaxed" style={{ color: '#e2e8f070' }}>{item.text}</p>
              {item.rating && renderStars(item.rating)}
              <div className="flex items-center gap-3 pt-2">
                {renderAvatar(item)}
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{item.name}</p>
                  {(item.role || item.company) && (
                    <p className="text-xs" style={{ color: '#e2e8f050' }}>
                      {item.role}{item.role && item.company ? ', ' : ''}{item.company}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Carousel
  const item = items[current];
  if (!item) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>{title}</h2>
      <div className="rounded-2xl border p-8 text-center relative" style={{ borderColor: '#6366f140' }}>
        <Quote className="w-8 h-8 mx-auto mb-4" style={{ color: '#6366f120' }} />
        <p className="text-base leading-relaxed max-w-2xl mx-auto mb-4" style={{ color: '#e2e8f070' }}>
          "{item.text}"
        </p>
        {item.rating && <div className="flex justify-center mb-4">{renderStars(item.rating)}</div>}
        <div className="flex items-center justify-center gap-3">
          {renderAvatar(item)}
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{item.name}</p>
            {(item.role || item.company) && (
              <p className="text-xs" style={{ color: '#e2e8f050' }}>
                {item.role}{item.role && item.company ? ', ' : ''}{item.company}
              </p>
            )}
          </div>
        </div>

        {items.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full border hover:opacity-70"
              style={{ borderColor: '#6366f140', color: '#e2e8f050' }}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full border hover:opacity-70"
              style={{ borderColor: '#6366f140', color: '#e2e8f050' }}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-2">
          {items.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="w-2.5 h-2.5 rounded-full transition-all"
              style={{ background: i === current ? '#6366f1' : '#6366f120' }} />
          ))}
        </div>
      )}
    </div>
  );
}
